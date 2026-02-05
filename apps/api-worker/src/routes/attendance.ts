import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt } from "drizzle-orm";
import { attendance, users } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { success, error } from "../lib/response";
import type { Env, AuthContext } from "../types";

const DAY_CUTOFF_HOUR = 5;

interface SyncEvent {
  fasEventId: string;
  fasUserId: string;
  checkinAt: string;
  siteId?: string;
}

interface SyncBody {
  events: SyncEvent[];
}

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const koreaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );

  if (koreaTime.getHours() < DAY_CUTOFF_HOUR) {
    koreaTime.setDate(koreaTime.getDate() - 1);
  }

  const start = new Date(koreaTime);
  start.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);

  const end = new Date(koreaTime);
  end.setDate(end.getDate() + 1);
  end.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);

  return { start, end };
}

const attendanceRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

attendanceRoute.post("/sync", async (c) => {
  let body: SyncBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.events || !Array.isArray(body.events)) {
    return error(c, "MISSING_EVENTS", "events array is required", 400);
  }

  const { events } = body;
  const db = drizzle(c.env.DB);

  const results = [];

  for (const event of events) {
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.externalWorkerId, event.fasUserId))
      .limit(1);

    if (userResults.length === 0) {
      results.push({ fasEventId: event.fasEventId, result: "NOT_FOUND" });
      continue;
    }

    // Check for duplicate by externalWorkerId + checkinAt
    const checkinTime = new Date(event.checkinAt);
    const existingRecords = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.externalWorkerId, event.fasUserId),
          eq(attendance.checkinAt, checkinTime),
        ),
      )
      .limit(1);

    if (existingRecords.length > 0) {
      results.push({ fasEventId: event.fasEventId, result: "DUPLICATE" });
      continue;
    }

    if (!event.siteId) {
      results.push({ fasEventId: event.fasEventId, result: "MISSING_SITE" });
      continue;
    }

    await db.insert(attendance).values({
      siteId: event.siteId as string,
      externalWorkerId: event.fasUserId,
      result: "SUCCESS",
      source: "FAS",
      checkinAt: checkinTime,
    });

    results.push({ fasEventId: event.fasEventId, result: "SUCCESS" });
  }

  return success(c, {
    processed: results.length,
    results,
  });
});

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
