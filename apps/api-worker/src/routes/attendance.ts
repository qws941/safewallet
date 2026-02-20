import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt, inArray, or } from "drizzle-orm";
import { attendance, users } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { fasAuthMiddleware } from "../middleware/fas-auth";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import type { Env, AuthContext } from "../types";
import { getTodayRange } from "../utils/common";
import {
  AttendanceSyncBodySchema,
  type AttendanceSyncEvent,
} from "../validators/fas-sync";
import { createLogger } from "../lib/logger";
import { dbBatchChunked } from "../db/helpers";

// KV-based idempotency cache (CF Workers isolates don't share memory,
// so in-memory Map is useless — each request runs in a fresh isolate)
const IDEMPOTENCY_TTL = 3600; // 1 hour in seconds
const IN_QUERY_CHUNK_SIZE = 50;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const attendanceRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

attendanceRoute.post(
  "/sync",
  fasAuthMiddleware,
  zValidator("json", AttendanceSyncBodySchema),
  async (c) => {
    const logger = createLogger("attendance");
    const idempotencyKey = c.req.header("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await c.env.KV.get(
        `attendance:idempotency:${idempotencyKey}`,
      );
      if (cached) {
        return success(c, JSON.parse(cached));
      }
    }

    const validatedBody = c.req.valid("json") as
      | { events?: AttendanceSyncEvent[] }
      | undefined;
    const body =
      validatedBody ??
      ((await c.req.raw.clone().json()) as {
        events?: AttendanceSyncEvent[];
      });

    if (!body.events || !Array.isArray(body.events)) {
      return error(c, "MISSING_EVENTS", "events array is required", 400);
    }

    const { events } = body;
    const db = drizzle(c.env.DB);

    const results = [];
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    // BATCH FIX: Load all users at once instead of per-event
    const uniqueWorkerIds = [...new Set(events.map((e) => e.fasUserId))];
    const userMap = new Map<string, typeof users.$inferSelect>();

    if (uniqueWorkerIds.length > 0) {
      for (const workerIdChunk of chunkArray(
        uniqueWorkerIds,
        IN_QUERY_CHUNK_SIZE,
      )) {
        const userRecords = await db
          .select()
          .from(users)
          .where(inArray(users.externalWorkerId, workerIdChunk));

        for (const user of userRecords) {
          if (user.externalWorkerId) {
            userMap.set(user.externalWorkerId, user);
          }
        }
      }
    }

    // BATCH FIX: Check all existing attendance at once
    const attendanceKeys = events
      .filter((e) => e.siteId) // Filter out events without siteId
      .map((e) => ({
        workerId: e.fasUserId,
        siteId: e.siteId as string, // Guaranteed non-null by filter
        checkinAt: new Date(e.checkinAt),
      }));

    const existingSet = new Set<string>();
    if (attendanceKeys.length > 0) {
      for (const attendanceChunk of chunkArray(
        attendanceKeys,
        IN_QUERY_CHUNK_SIZE,
      )) {
        const conditions = attendanceChunk.map((key) =>
          and(
            eq(attendance.externalWorkerId, key.workerId),
            eq(attendance.siteId, key.siteId),
            eq(attendance.checkinAt, key.checkinAt),
          ),
        );

        const existing = await db
          .select({
            workerId: attendance.externalWorkerId,
            siteId: attendance.siteId,
            checkinAt: attendance.checkinAt,
          })
          .from(attendance)
          .where(or(...conditions));

        for (const record of existing) {
          if (record.workerId && record.siteId && record.checkinAt) {
            existingSet.add(
              `${record.workerId}|${record.siteId}|${record.checkinAt.getTime()}`,
            );
          }
        }
      }
    }

    // BATCH FIX: Prepare batch insert instead of individual inserts
    const insertBatch: (typeof attendance.$inferInsert)[] = [];
    for (const event of events) {
      const user = userMap.get(event.fasUserId);
      if (!user) {
        results.push({ fasEventId: event.fasEventId, result: "NOT_FOUND" });
        failed++;
        continue;
      }

      if (!event.siteId) {
        results.push({ fasEventId: event.fasEventId, result: "MISSING_SITE" });
        failed++;
        continue;
      }

      const checkinTime = new Date(event.checkinAt);
      const key = `${event.fasUserId}|${event.siteId}|${checkinTime.getTime()}`;

      if (existingSet.has(key)) {
        results.push({ fasEventId: event.fasEventId, result: "DUPLICATE" });
        skipped++;
        logger.debug(
          `[Attendance] Duplicate skipped: ${event.fasUserId} @ ${event.siteId} @ ${checkinTime.toISOString()}`,
        );
      } else {
        insertBatch.push({
          siteId: event.siteId,
          userId: user.id,
          externalWorkerId: event.fasUserId,
          result: "SUCCESS",
          source: "FAS",
          checkinAt: checkinTime,
        });
        results.push({ fasEventId: event.fasEventId, result: "SUCCESS" });
        inserted++;
      }
    }

    // Batch insert all at once
    if (insertBatch.length > 0) {
      try {
        const ops = insertBatch.map((values) =>
          db
            .insert(attendance)
            .values(values)
            .onConflictDoNothing({
              target: [
                attendance.externalWorkerId,
                attendance.siteId,
                attendance.checkinAt,
              ],
            }),
        );
        await dbBatchChunked(db, ops);
      } catch (err) {
        logger.error("Batch insert failed", {
          count: insertBatch.length,
          error: err instanceof Error ? err.message : String(err),
        });
        failed += insertBatch.length;
      }
    }

    const response = {
      processed: results.length,
      inserted,
      skipped,
      failed,
      results,
    };

    if (idempotencyKey) {
      await c.env.KV.put(
        `attendance:idempotency:${idempotencyKey}`,
        JSON.stringify(response),
        { expirationTtl: IDEMPOTENCY_TTL },
      );
    }

    try {
      await logAuditWithContext(
        c,
        db,
        "ATTENDANCE_SYNCED",
        "system",
        "ATTENDANCE",
        idempotencyKey || `attendance-sync:${Date.now()}`,
        {
          processed: response.processed,
          inserted: response.inserted,
          skipped: response.skipped,
          failed: response.failed,
        },
      );
    } catch {
      // Do not block successful sync response on audit failure.
    }

    return success(c, response);
  },
);

attendanceRoute.get("/today", authMiddleware, async (c) => {
  const auth = c.get("auth");
  const db = drizzle(c.env.DB);
  const { start, end } = getTodayRange();

  const records = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.userId, auth.user.id),
        gte(attendance.checkinAt, start),
        lt(attendance.checkinAt, end),
      ),
    )
    .orderBy(attendance.checkinAt);

  const hasAttendance = records.some((r) => r.result === "SUCCESS");

  return success(c, {
    hasAttendance,
    records: records.map((r) => ({
      id: r.id,
      result: r.result,
      source: r.source,
      checkinAt: r.checkinAt?.toISOString(),
    })),
  });
});

export default attendanceRoute;
