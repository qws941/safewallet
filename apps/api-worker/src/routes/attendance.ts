import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt } from "drizzle-orm";
import { attendance, users } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { fasAuthMiddleware } from "../middleware/fas-auth";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import type { Env, AuthContext } from "../types";
import { getTodayRange } from "../utils/common";
import { ManualCheckinSchema } from "../validators/schemas";

interface SyncEvent {
  fasEventId: string;
  fasUserId: string;
  checkinAt: string;
  siteId?: string;
}

interface SyncBody {
  events: SyncEvent[];
}

// KV-based idempotency cache (CF Workers isolates don't share memory,
// so in-memory Map is useless — each request runs in a fresh isolate)
const IDEMPOTENCY_TTL = 3600; // 1 hour in seconds

const attendanceRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

attendanceRoute.post(
  "/sync",
  fasAuthMiddleware,
  zValidator("json", ManualCheckinSchema as never),
  async (c) => {
    const idempotencyKey = c.req.header("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await c.env.KV.get(
        `attendance:idempotency:${idempotencyKey}`,
      );
      if (cached) {
        return success(c, JSON.parse(cached));
      }
    }

    c.req.valid("json");
    const body = (await c.req.raw.clone().json()) as SyncBody;

    if (!body.events || !Array.isArray(body.events)) {
      return error(c, "MISSING_EVENTS", "events array is required", 400);
    }

    const { events } = body;
    const db = drizzle(c.env.DB);

    const results = [];
    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of events) {
      // Validate user exists
      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.externalWorkerId, event.fasUserId))
        .limit(1);

      if (userResults.length === 0) {
        results.push({ fasEventId: event.fasEventId, result: "NOT_FOUND" });
        failed++;
        continue;
      }

      // Validate siteId
      if (!event.siteId) {
        results.push({ fasEventId: event.fasEventId, result: "MISSING_SITE" });
        failed++;
        continue;
      }

      const checkinTime = new Date(event.checkinAt);

      try {
        // Check if record already exists before insert
        const existingBefore = await db
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.externalWorkerId, event.fasUserId),
              eq(attendance.siteId, event.siteId as string),
              eq(attendance.checkinAt, checkinTime),
            ),
          )
          .limit(1);

        if (existingBefore.length > 0) {
          // Duplicate - record already existed
          results.push({ fasEventId: event.fasEventId, result: "DUPLICATE" });
          skipped++;
          console.debug(
            `[Attendance] Duplicate skipped: ${event.fasUserId} @ ${event.siteId} @ ${checkinTime.toISOString()}`,
          );
        } else {
          // Idempotent insert: onConflictDoNothing silently skips if race condition occurs
          await db
            .insert(attendance)
            .values({
              siteId: event.siteId as string,
              externalWorkerId: event.fasUserId,
              result: "SUCCESS",
              source: "FAS",
              checkinAt: checkinTime,
            })
            .onConflictDoNothing({
              target: [
                attendance.externalWorkerId,
                attendance.siteId,
                attendance.checkinAt,
              ],
            });

          results.push({ fasEventId: event.fasEventId, result: "SUCCESS" });
          inserted++;
        }
      } catch (err) {
        results.push({ fasEventId: event.fasEventId, result: "ERROR" });
        failed++;
        console.error(
          `[Attendance] Insert error for ${event.fasEventId}:`,
          err,
        );
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
