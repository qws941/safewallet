import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, gte, lt, isNull, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { attendance, users, sites } from "../../db/schema";
import { success, error } from "../../lib/response";
import { AppContext, requireManagerOrAdmin, parseDateParam } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// GET /attendance-logs - 출근 기록 조회 (관리자)
app.get("/attendance-logs", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;
  const dateStr = c.req.query("date");
  const search = c.req.query("search");
  const resultFilter = c.req.query("result");

  if (!siteId) {
    return error(c, "MISSING_SITE", "현장을 선택해주세요", 400);
  }

  const conditions = [eq(attendance.siteId, siteId)];

  if (dateStr) {
    const date = parseDateParam(dateStr);
    if (date) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      conditions.push(gte(attendance.checkinAt, date));
      conditions.push(lt(attendance.checkinAt, nextDay));
    }
  }

  if (resultFilter && (resultFilter === "SUCCESS" || resultFilter === "FAIL")) {
    conditions.push(eq(attendance.result, resultFilter));
  }

  const baseWhere = and(...conditions);

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendance)
    .where(baseWhere);

  let query = db
    .select({
      id: attendance.id,
      siteId: attendance.siteId,
      userId: attendance.userId,
      externalWorkerId: attendance.externalWorkerId,
      checkinAt: attendance.checkinAt,
      result: attendance.result,
      source: attendance.source,
      createdAt: attendance.createdAt,
      userName: users.nameMasked,
    })
    .from(attendance)
    .leftJoin(users, eq(attendance.userId, users.id))
    .where(baseWhere)
    .orderBy(desc(attendance.checkinAt))
    .limit(limit)
    .offset(offset);

  const logs = await query;

  return success(c, {
    logs,
    pagination: {
      page,
      limit,
      total: totalResult?.count || 0,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    },
  });
});

// GET /attendance/unmatched - 사용자 매칭 실패 출근 기록 조회 (관리자)
app.get("/attendance/unmatched", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;
  const dateStr = c.req.query("date");

  if (!siteId) {
    return error(c, "MISSING_SITE", "현장을 선택해주세요", 400);
  }

  const conditions = [eq(attendance.siteId, siteId), isNull(attendance.userId)];

  if (dateStr) {
    const date = parseDateParam(dateStr);
    if (date) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      conditions.push(gte(attendance.checkinAt, date));
      conditions.push(lt(attendance.checkinAt, nextDay));
    }
  }

  const baseWhere = and(...conditions);

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendance)
    .where(baseWhere);

  const unmatchedRecords = await db
    .select({
      id: attendance.id,
      externalWorkerId: attendance.externalWorkerId,
      siteId: attendance.siteId,
      siteName: sites.name,
      checkinAt: attendance.checkinAt,
      source: attendance.source,
      createdAt: attendance.createdAt,
    })
    .from(attendance)
    .leftJoin(sites, eq(attendance.siteId, sites.id))
    .where(baseWhere)
    .orderBy(desc(attendance.checkinAt))
    .limit(limit)
    .offset(offset);

  return success(c, {
    records: unmatchedRecords,
    pagination: {
      page,
      limit,
      total: totalResult?.count || 0,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    },
  });
});

export default app;
