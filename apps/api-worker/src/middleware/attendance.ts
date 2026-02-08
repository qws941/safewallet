import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt } from "drizzle-orm";
import {
  attendance,
  manualApprovals,
  siteMemberships,
  accessPolicies,
} from "../db/schema";
import { error } from "../lib/response";
import type { Env, AuthContext } from "../types";

const DAY_CUTOFF_HOUR = 5;

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

export async function attendanceMiddleware(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next,
  siteId?: string,
) {
  const auth = c.get("auth");
  const resolvedSiteId = siteId?.trim() || undefined;
  const db = drizzle(c.env.DB);

  if (resolvedSiteId) {
    if (!auth) {
      throw new HTTPException(401, { message: "인증이 필요합니다." });
    }

    const membership = await db
      .select({ id: siteMemberships.id })
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, auth.user.id),
          eq(siteMemberships.siteId, resolvedSiteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "FORBIDDEN", "해당 현장의 멤버가 아닙니다", 403);
    }
  }

  if (c.env.REQUIRE_ATTENDANCE_FOR_POST === "false") {
    if (resolvedSiteId) {
      const policy = await db
        .select({ requireCheckin: accessPolicies.requireCheckin })
        .from(accessPolicies)
        .where(eq(accessPolicies.siteId, resolvedSiteId))
        .get();

      if (!policy?.requireCheckin) {
        return next();
      }
    } else {
      return next();
    }
  }

  if (!auth) {
    throw new HTTPException(401, { message: "인증이 필요합니다." });
  }

  const { start, end } = getTodayRange();

  const attendanceConditions = [
    eq(attendance.userId, auth.user.id),
    eq(attendance.result, "SUCCESS"),
    gte(attendance.checkinAt, start),
    lt(attendance.checkinAt, end),
  ];

  if (resolvedSiteId) {
    attendanceConditions.push(eq(attendance.siteId, resolvedSiteId));
  }

  const record = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(and(...attendanceConditions))
    .get();

  let hasAttendance = !!record;

  if (!hasAttendance && resolvedSiteId) {
    const approval = await db
      .select({ id: manualApprovals.id })
      .from(manualApprovals)
      .where(
        and(
          eq(manualApprovals.userId, auth.user.id),
          eq(manualApprovals.siteId, resolvedSiteId),
          gte(manualApprovals.validDate, start),
          lt(manualApprovals.validDate, end),
        ),
      )
      .get();

    hasAttendance = !!approval;
  }

  if (!hasAttendance) {
    throw new HTTPException(403, {
      message: "해당 현장에 오늘 출근 기록이 없습니다",
    });
  }

  await next();
}
