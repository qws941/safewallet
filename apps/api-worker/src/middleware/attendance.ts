import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt } from "drizzle-orm";
import { attendance } from "../db/schema";
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
) {
  const auth = c.get("auth");
  if (!auth) {
    throw new HTTPException(401, { message: "인증이 필요합니다." });
  }

  const db = drizzle(c.env.DB);
  const { start, end } = getTodayRange();

  const record = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.userId, auth.user.id),
        eq(attendance.result, "SUCCESS"),
        gte(attendance.checkinAt, start),
        lt(attendance.checkinAt, end),
      ),
    )
    .limit(1);

  if (record.length === 0) {
    throw new HTTPException(403, {
      message: "오늘 출근 확인 후 이용 가능합니다.",
    });
  }

  await next();
}
