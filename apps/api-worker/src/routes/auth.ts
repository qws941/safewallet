import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { users, attendance } from "../db/schema";
import { hmac } from "../lib/crypto";
import { signJwt } from "../lib/jwt";
import { success, error } from "../lib/response";
import type { Env } from "../types";

const ACCESS_TOKEN_EXPIRY_SECONDS = 86400;
const DAY_CUTOFF_HOUR = 5;

interface LoginBody {
  name: string;
  phone: string;
  dob: string;
}

interface RefreshBody {
  refreshToken: string;
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

const auth = new Hono<{ Bindings: Env }>();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

auth.post("/login", async (c) => {
  let body: LoginBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.name || !body.phone || !body.dob) {
    return error(c, "MISSING_FIELDS", "name, phone, and dob are required", 400);
  }

  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";

  const now = Date.now();
  const rateLimit = rateLimitMap.get(clientIp);
  if (rateLimit && rateLimit.resetAt > now && rateLimit.count >= 5) {
    return error(
      c,
      "RATE_LIMIT_EXCEEDED",
      "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
      429,
    );
  }

  if (!rateLimit || rateLimit.resetAt <= now) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60000 });
  } else {
    rateLimit.count++;
  }

  const db = drizzle(c.env.DB);
  const normalizedPhone = body.phone.replace(/[^0-9]/g, "");
  const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
  const dobHash = await hmac(c.env.HMAC_SECRET, body.dob);

  const userResults = await db
    .select()
    .from(users)
    .where(and(eq(users.phoneHash, phoneHash), eq(users.dobHash, dobHash)))
    .limit(1);

  if (userResults.length === 0) {
    return error(
      c,
      "USER_NOT_FOUND",
      "등록되지 않은 사용자입니다. 현장 관리자에게 문의하세요.",
      401,
    );
  }

  const user = userResults[0];
  const normalizedInputName = body.name.trim().toLowerCase();
  const normalizedUserName = (user.name || "").trim().toLowerCase();

  if (normalizedUserName !== normalizedInputName) {
    return error(c, "NAME_MISMATCH", "이름이 일치하지 않습니다.", 401);
  }

  const requireAttendance = c.env.REQUIRE_ATTENDANCE_FOR_LOGIN !== "false";
  if (requireAttendance) {
    const { start, end } = getTodayRange();
    const attendanceRecords = await db
      .select()
      .from(attendance)
      .where(
        and(eq(attendance.userId, user.id), eq(attendance.result, "SUCCESS")),
      )
      .limit(100);

    const attended = attendanceRecords.some((record) => {
      const checkinTime = record.checkinAt;
      return checkinTime && checkinTime >= start && checkinTime < end;
    });

    if (!attended) {
      return error(
        c,
        "ATTENDANCE_NOT_VERIFIED",
        "오늘 출근 인증이 확인되지 않습니다. 게이트 안면인식 출근 후 이용 가능합니다.",
        403,
      );
    }
  }

  const accessToken = await signJwt(
    { sub: user.id, phone: user.phone || "", role: user.role },
    c.env.JWT_SECRET,
  );
  const refreshToken = crypto.randomUUID();

  await db
    .update(users)
    .set({ refreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return success(
    c,
    {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        nameMasked: user.nameMasked,
      },
    },
    200,
  );
});

auth.post("/refresh", async (c) => {
  let body: RefreshBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.refreshToken) {
    return error(c, "MISSING_REFRESH_TOKEN", "refreshToken is required", 400);
  }

  const db = drizzle(c.env.DB);

  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.refreshToken, body.refreshToken))
    .limit(1);

  if (userResults.length === 0) {
    return error(c, "INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
  }

  const user = userResults[0];
  const newRefreshToken = crypto.randomUUID();
  const accessToken = await signJwt(
    { sub: user.id, phone: user.phone || "", role: user.role },
    c.env.JWT_SECRET,
  );

  await db
    .update(users)
    .set({ refreshToken: newRefreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return success(
    c,
    {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    },
    200,
  );
});

auth.post("/logout", async (c) => {
  let body: RefreshBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.refreshToken) {
    return error(c, "MISSING_REFRESH_TOKEN", "refreshToken is required", 400);
  }

  const db = drizzle(c.env.DB);

  await db
    .update(users)
    .set({ refreshToken: null, updatedAt: new Date() })
    .where(eq(users.refreshToken, body.refreshToken));

  return success(c, { message: "Logged out successfully" }, 200);
});

export default auth;
