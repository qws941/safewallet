import { Hono, type Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  users,
  attendance,
  siteMemberships,
  auditLogs,
  deviceRegistrations,
} from "../db/schema";
import { hmac, decrypt, encrypt } from "../lib/crypto";
import { signJwt } from "../lib/jwt";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import {
  fasSearchEmployeeByPhone,
  fasGetEmployeeInfo,
} from "../lib/fas-mariadb";
import { authMiddleware } from "../middleware/auth";
import {
  checkDeviceRegistrationLimit,
  normalizeDeviceId,
  recordDeviceRegistration,
} from "../lib/device-registrations";
import { checkRateLimit } from "../lib/rate-limit";
import type { Env, AuthContext } from "../types";

const ACCESS_TOKEN_EXPIRY_SECONDS = 86400;
const DAY_CUTOFF_HOUR = 5;
const LOGIN_LOCKOUT_KEY_PREFIX = "login:lockout:";
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_ATTEMPT_TTL_SECONDS = 15 * 60;
const LOGIN_LOCKOUT_TTL_SECONDS = 30 * 60;
const LOGIN_LOCKOUT_MS = LOGIN_LOCKOUT_TTL_SECONDS * 1000;
const LOGIN_MIN_RESPONSE_MS = 350;

interface LoginBody {
  name: string;
  phone: string;
  dob: string;
}

interface RegisterBody {
  name: string;
  phone: string;
  dob: string;
  deviceId?: string;
}

interface RefreshBody {
  refreshToken: string;
}

interface LoginLockoutRecord {
  attempts: number;
  lockedUntil?: number;
}

function getLoginLockoutKey(phoneHash: string): string {
  return `${LOGIN_LOCKOUT_KEY_PREFIX}${phoneHash}`;
}

function parseLoginLockoutRecord(
  value: string | null,
): LoginLockoutRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as LoginLockoutRecord;
    if (
      typeof parsed.attempts === "number" &&
      Number.isFinite(parsed.attempts) &&
      parsed.attempts >= 0 &&
      (typeof parsed.lockedUntil === "number" ||
        typeof parsed.lockedUntil === "undefined")
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function isExpiredLock(
  record: LoginLockoutRecord | null,
  nowMs: number,
): boolean {
  return typeof record?.lockedUntil === "number" && record.lockedUntil <= nowMs;
}

function getRetryAfterSeconds(lockedUntil: number, nowMs: number): number {
  return Math.max(1, Math.ceil((lockedUntil - nowMs) / 1000));
}

function accountLockedResponse(c: Context, lockedUntil: number, nowMs: number) {
  const retryAfter = getRetryAfterSeconds(lockedUntil, nowMs);
  return c.json(
    {
      success: false,
      error: {
        code: "ACCOUNT_LOCKED",
        message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
        lockedUntil,
        retryAfter,
      },
      timestamp: new Date().toISOString(),
    },
    429,
    {
      "Retry-After": retryAfter.toString(),
    },
  );
}

async function recordFailedLoginAttempt(
  kv: Env["KV"],
  key: string,
  record: LoginLockoutRecord | null,
  nowMs: number,
): Promise<LoginLockoutRecord> {
  const attempts = (record?.attempts ?? 0) + 1;
  const updated: LoginLockoutRecord = { attempts };

  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    updated.lockedUntil = nowMs + LOGIN_LOCKOUT_MS;
    await kv.put(key, JSON.stringify(updated), {
      expirationTtl: LOGIN_LOCKOUT_TTL_SECONDS,
    });
    return updated;
  }

  await kv.put(key, JSON.stringify(updated), {
    expirationTtl: LOGIN_ATTEMPT_TTL_SECONDS,
  });
  return updated;
}

async function resolveLockoutActorId(
  db: ReturnType<typeof drizzle>,
  phoneHash: string,
): Promise<string | null> {
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phoneHash, phoneHash))
    .get();

  return existingUser?.id ?? null;
}

async function logLoginLockoutEvent(
  db: ReturnType<typeof drizzle>,
  c: Context,
  actorId: string,
  phoneHash: string,
  attempts: number,
  lockedUntil: number,
) {
  await db.insert(auditLogs).values({
    action: "LOGIN_LOCKOUT",
    actorId,
    targetType: "LOGIN_LOCKOUT",
    targetId: phoneHash,
    reason: JSON.stringify({ attempts, lockedUntil }),
    ip: c.req.header("CF-Connecting-IP") || undefined,
    userAgent: c.req.header("User-Agent") || undefined,
  });
}

async function enforceMinimumResponseTime(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const remaining = LOGIN_MIN_RESPONSE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
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

function maskName(name: string): string {
  if (name.length <= 1) return "*";
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

function resolveDeviceId(c: Context, bodyDeviceId?: string): string | null {
  const headerDeviceId =
    c.req.header("device-id") ||
    c.req.header("x-device-id") ||
    c.req.header("deviceid") ||
    c.req.header("deviceId");
  return normalizeDeviceId(bodyDeviceId ?? headerDeviceId);
}

const auth = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

auth.post("/register", async (c) => {
  let body: RegisterBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.name || !body.phone || !body.dob) {
    return error(c, "MISSING_FIELDS", "name, phone, and dob are required", 400);
  }

  const deviceId = resolveDeviceId(c, body.deviceId);
  const deviceCheck = deviceId
    ? await checkDeviceRegistrationLimit(c.env.KV, deviceId, Date.now())
    : null;
  if (deviceCheck && !deviceCheck.allowed) {
    return error(c, "DEVICE_LIMIT", "Too many accounts from this device", 429);
  }

  const db = drizzle(c.env.DB);
  const normalizedPhone = body.phone.replace(/[^0-9]/g, "");
  const normalizedDob = body.dob.replace(/[^0-9]/g, "");
  const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
  const dobHash = await hmac(c.env.HMAC_SECRET, normalizedDob);

  const existingUser = await db
    .select()
    .from(users)
    .where(and(eq(users.phoneHash, phoneHash), eq(users.dobHash, dobHash)))
    .get();

  if (existingUser) {
    return error(c, "USER_EXISTS", "User already registered", 409);
  }

  const phoneEncrypted = await encrypt(c.env.ENCRYPTION_KEY, normalizedPhone);
  const dobEncrypted = await encrypt(c.env.ENCRYPTION_KEY, normalizedDob);
  const nameMasked = maskName(body.name);

  const newUser = await db
    .insert(users)
    .values({
      name: body.name,
      nameMasked,
      phone: phoneHash,
      phoneHash,
      phoneEncrypted,
      dob: null,
      dobHash,
      dobEncrypted,
      role: "WORKER",
    })
    .returning()
    .get();

  if (deviceId) {
    await recordDeviceRegistration(
      c.env.KV,
      deviceId,
      newUser.id,
      Date.now(),
      deviceCheck?.recent,
    );

    // Also store in D1 for persistent tracking
    const existingDevice = await db
      .select()
      .from(deviceRegistrations)
      .where(
        and(
          eq(deviceRegistrations.userId, newUser.id),
          eq(deviceRegistrations.deviceId, deviceId),
        ),
      )
      .get();

    if (!existingDevice) {
      await db.insert(deviceRegistrations).values({
        userId: newUser.id,
        deviceId,
        deviceInfo: c.req.header("User-Agent") || null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isTrusted: true,
        isBanned: false,
      });
    }

    await db.insert(auditLogs).values({
      action: "DEVICE_REGISTRATION",
      actorId: newUser.id,
      targetType: "DEVICE",
      targetId: deviceId,
      reason: "User registration",
      ip: c.req.header("CF-Connecting-IP") || undefined,
      userAgent: c.req.header("User-Agent") || undefined,
    });
  }

  return success(c, { userId: newUser.id }, 201);
});

auth.post("/login", async (c) => {
  const startedAt = Date.now();
  const respondWithDelay = async (response: Response) => {
    await enforceMinimumResponseTime(startedAt);
    return response;
  };

  let body: LoginBody;
  try {
    body = await c.req.json();
  } catch {
    return respondWithDelay(error(c, "INVALID_JSON", "Invalid JSON", 400));
  }

  if (!body.name || !body.phone || !body.dob) {
    return respondWithDelay(
      error(c, "MISSING_FIELDS", "name, phone, and dob are required", 400),
    );
  }

  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";

  const rateLimitKey = `auth:login:ip:${clientIp}`;
  const rateLimit = await checkRateLimit(c.env, rateLimitKey, 5, 60 * 1000);

  if (!rateLimit.allowed) {
    return respondWithDelay(
      error(
        c,
        "RATE_LIMIT_EXCEEDED",
        "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
        429,
      ),
    );
  }

  const db = drizzle(c.env.DB);
  const normalizedPhone = body.phone.replace(/[^0-9]/g, "");
  const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
  const attemptKey = getLoginLockoutKey(phoneHash);
  const nowMs = Date.now();
  const existingAttempt = parseLoginLockoutRecord(
    await c.env.KV.get(attemptKey),
  );
  if (isExpiredLock(existingAttempt, nowMs)) {
    await c.env.KV.delete(attemptKey);
  }
  const currentAttempt = isExpiredLock(existingAttempt, nowMs)
    ? null
    : existingAttempt;

  if (
    typeof currentAttempt?.lockedUntil === "number" &&
    currentAttempt.lockedUntil > nowMs
  ) {
    return respondWithDelay(
      accountLockedResponse(c, currentAttempt.lockedUntil, nowMs),
    );
  }
  const normalizedDob = body.dob.replace(/[^0-9]/g, "");
  const dobHash = await hmac(c.env.HMAC_SECRET, normalizedDob);

  // Try D1 first
  let userResults = await db
    .select()
    .from(users)
    .where(and(eq(users.phoneHash, phoneHash), eq(users.dobHash, dobHash)))
    .limit(1);

  // If not found in D1 and FAS_HYPERDRIVE is available, try MariaDB
  if (userResults.length === 0 && c.env.FAS_HYPERDRIVE) {
    try {
      const fasCompanyId = parseInt(c.env.FAS_COMPANY_ID || "1", 10);
      const fasEmployee = await fasSearchEmployeeByPhone(
        c.env.FAS_HYPERDRIVE,
        fasCompanyId,
        normalizedPhone,
      );

      if (fasEmployee && fasEmployee.birthDate) {
        // Verify DOB matches
        const fasDobNormalized = fasEmployee.birthDate.replace(/[^0-9]/g, "");
        if (fasDobNormalized === normalizedDob) {
          // Cache in D1 for future logins
          const phoneEncrypted = await encrypt(
            c.env.ENCRYPTION_KEY,
            normalizedPhone,
          );
          const dobEncrypted = await encrypt(
            c.env.ENCRYPTION_KEY,
            normalizedDob,
          );
          const nameMasked = maskName(fasEmployee.name);

          const newUser = await db
            .insert(users)
            .values({
              name: fasEmployee.name,
              nameMasked,
              phone: phoneHash,
              phoneHash,
              phoneEncrypted,
              dob: null,
              dobHash,
              dobEncrypted,
              role: "WORKER",
            })
            .returning()
            .get();

          userResults = [newUser];
        }
      }
    } catch (fasError) {
      // MariaDB connection failed - continue with D1-only flow
      console.error("FAS MariaDB lookup failed:", fasError);
    }
  }

  if (userResults.length === 0) {
    const updatedAttempt = await recordFailedLoginAttempt(
      c.env.KV,
      attemptKey,
      currentAttempt,
      Date.now(),
    );
    try {
      await logAuditWithContext(
        c,
        db,
        "LOGIN_FAILED",
        phoneHash,
        "LOGIN_LOCKOUT",
        attemptKey,
        {
          reason: "USER_NOT_FOUND",
          attempts: updatedAttempt.attempts,
        },
      );
    } catch {
      // Do not block failed login response on audit failure.
    }

    if (typeof updatedAttempt.lockedUntil === "number") {
      const actorId = await resolveLockoutActorId(db, phoneHash);
      if (actorId) {
        await logLoginLockoutEvent(
          db,
          c,
          actorId,
          phoneHash,
          updatedAttempt.attempts,
          updatedAttempt.lockedUntil,
        );
      }
      return respondWithDelay(
        accountLockedResponse(c, updatedAttempt.lockedUntil, Date.now()),
      );
    }

    return respondWithDelay(
      error(
        c,
        "USER_NOT_FOUND",
        "등록되지 않은 사용자입니다. 현장 관리자에게 문의하세요.",
        401,
      ),
    );
  }

  const user = userResults[0];
  const normalizedInputName = body.name.trim().toLowerCase();
  const normalizedUserName = (user.name || "").trim().toLowerCase();

  if (normalizedUserName !== normalizedInputName) {
    const updatedAttempt = await recordFailedLoginAttempt(
      c.env.KV,
      attemptKey,
      currentAttempt,
      Date.now(),
    );
    try {
      await logAuditWithContext(
        c,
        db,
        "LOGIN_FAILED",
        user.id,
        "USER",
        user.id,
        {
          reason: "NAME_MISMATCH",
          attempts: updatedAttempt.attempts,
        },
      );
    } catch {
      // Do not block failed login response on audit failure.
    }

    if (typeof updatedAttempt.lockedUntil === "number") {
      await logLoginLockoutEvent(
        db,
        c,
        user.id,
        phoneHash,
        updatedAttempt.attempts,
        updatedAttempt.lockedUntil,
      );
      return respondWithDelay(
        accountLockedResponse(c, updatedAttempt.lockedUntil, Date.now()),
      );
    }

    return respondWithDelay(
      error(c, "NAME_MISMATCH", "이름이 일치하지 않습니다.", 401),
    );
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
      return respondWithDelay(
        error(
          c,
          "ATTENDANCE_NOT_VERIFIED",
          "오늘 출근 인증이 확인되지 않습니다. 게이트 안면인식 출근 후 이용 가능합니다.",
          403,
        ),
      );
    }
  }

  const phoneForToken =
    user.piiViewFull && user.phoneEncrypted
      ? await decrypt(c.env.ENCRYPTION_KEY, user.phoneEncrypted)
      : "";
  const accessToken = await signJwt(
    { sub: user.id, phone: phoneForToken, role: user.role },
    c.env.JWT_SECRET,
  );
  const refreshToken = crypto.randomUUID();

  await db
    .update(users)
    .set({ refreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const loginDeviceId = resolveDeviceId(c);
  if (loginDeviceId) {
    const existingDevice = await db
      .select()
      .from(deviceRegistrations)
      .where(
        and(
          eq(deviceRegistrations.userId, user.id),
          eq(deviceRegistrations.deviceId, loginDeviceId),
        ),
      )
      .get();

    if (existingDevice) {
      await db
        .update(deviceRegistrations)
        .set({ lastSeenAt: new Date() })
        .where(eq(deviceRegistrations.id, existingDevice.id));
    } else {
      await db.insert(deviceRegistrations).values({
        userId: user.id,
        deviceId: loginDeviceId,
        deviceInfo: c.req.header("User-Agent") || null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isTrusted: true,
        isBanned: false,
      });
    }
  }

  await c.env.KV.delete(attemptKey);

  try {
    await logAuditWithContext(
      c,
      db,
      "LOGIN_SUCCESS",
      user.id,
      "USER",
      user.id,
      {
        method: "PHONE_DOB",
      },
    );
  } catch {
    // Do not block successful login response on audit failure.
  }

  return respondWithDelay(
    success(
      c,
      {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        user: {
          id: user.id,
          phone: phoneForToken,
          role: user.role,
          name: user.name,
          nameMasked: user.nameMasked,
        },
      },
      200,
    ),
  );
});

// AceTime login: employee code + name (no phone/dob required)
auth.post("/acetime-login", async (c) => {
  const startedAt = Date.now();
  const respondWithDelay = async (response: Response) => {
    await enforceMinimumResponseTime(startedAt);
    return response;
  };

  let body: { employeeCode: string; name: string };
  try {
    body = await c.req.json();
  } catch {
    return respondWithDelay(error(c, "INVALID_JSON", "Invalid JSON", 400));
  }

  if (!body.employeeCode || !body.name) {
    return respondWithDelay(
      error(
        c,
        "MISSING_FIELDS",
        "사번(employeeCode)과 이름(name)을 입력해주세요.",
        400,
      ),
    );
  }

  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const rateLimitKey = `auth:acetime:ip:${clientIp}`;
  const rateLimit = await checkRateLimit(c.env, rateLimitKey, 5, 60 * 1000);

  if (!rateLimit.allowed) {
    return respondWithDelay(
      error(
        c,
        "RATE_LIMIT_EXCEEDED",
        "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
        429,
      ),
    );
  }

  const db = drizzle(c.env.DB);
  const normalizedCode = body.employeeCode.trim();

  const attemptKey = `login:lockout:acetime:${normalizedCode}`;
  const nowMs = Date.now();
  const existingAttempt = parseLoginLockoutRecord(
    await c.env.KV.get(attemptKey),
  );
  if (isExpiredLock(existingAttempt, nowMs)) {
    await c.env.KV.delete(attemptKey);
  }
  const currentAttempt = isExpiredLock(existingAttempt, nowMs)
    ? null
    : existingAttempt;

  if (
    typeof currentAttempt?.lockedUntil === "number" &&
    currentAttempt.lockedUntil > nowMs
  ) {
    return respondWithDelay(
      accountLockedResponse(c, currentAttempt.lockedUntil, nowMs),
    );
  }

  const userResults = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.externalSystem, "FAS"),
        eq(users.externalWorkerId, normalizedCode),
      ),
    )
    .limit(1);

  if (userResults.length === 0) {
    const updatedAttempt = await recordFailedLoginAttempt(
      c.env.KV,
      attemptKey,
      currentAttempt,
      Date.now(),
    );
    if (typeof updatedAttempt.lockedUntil === "number") {
      return respondWithDelay(
        accountLockedResponse(c, updatedAttempt.lockedUntil, Date.now()),
      );
    }

    return respondWithDelay(
      error(
        c,
        "USER_NOT_FOUND",
        "등록되지 않은 사번입니다. 현장 관리자에게 문의하세요.",
        401,
      ),
    );
  }

  const user = userResults[0];
  const normalizedInputName = body.name.trim().toLowerCase();
  const normalizedUserName = (user.name || "").trim().toLowerCase();

  if (normalizedUserName !== normalizedInputName) {
    const updatedAttempt = await recordFailedLoginAttempt(
      c.env.KV,
      attemptKey,
      currentAttempt,
      Date.now(),
    );
    if (typeof updatedAttempt.lockedUntil === "number") {
      await logLoginLockoutEvent(
        db,
        c,
        user.id,
        `acetime:${normalizedCode}`,
        updatedAttempt.attempts,
        updatedAttempt.lockedUntil,
      );
      return respondWithDelay(
        accountLockedResponse(c, updatedAttempt.lockedUntil, Date.now()),
      );
    }

    return respondWithDelay(
      error(c, "NAME_MISMATCH", "이름이 일치하지 않습니다.", 401),
    );
  }

  // AceTime login skips attendance check - FAS-imported users
  // may not have attendance data yet

  // If user is missing phone info, fetch from FAS and update
  if (!user.phoneHash && c.env.FAS_HYPERDRIVE) {
    try {
      const companyId = c.env.FAS_COMPANY_ID
        ? parseInt(c.env.FAS_COMPANY_ID, 10)
        : 1;
      const fasEmployee = await fasGetEmployeeInfo(
        c.env.FAS_HYPERDRIVE,
        companyId,
        parseInt(normalizedCode, 10),
      );
      if (fasEmployee?.phone) {
        const normalizedPhone = fasEmployee.phone.replace(/[^0-9]/g, "");
        if (normalizedPhone) {
          const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
          const phoneEncrypted = await encrypt(
            c.env.ENCRYPTION_KEY,
            normalizedPhone,
          );
          const dob = fasEmployee.birthDate
            ? fasEmployee.birthDate.replace(/-/g, "")
            : null;
          const dobHash = dob ? await hmac(c.env.HMAC_SECRET, dob) : null;
          const dobEncrypted = dob
            ? await encrypt(c.env.ENCRYPTION_KEY, dob)
            : null;
          const nameMasked =
            fasEmployee.name.length > 1
              ? fasEmployee.name[0] + "*".repeat(fasEmployee.name.length - 1)
              : fasEmployee.name;

          await db
            .update(users)
            .set({
              phone: phoneHash,
              phoneHash,
              phoneEncrypted,
              ...(dobHash ? { dobHash, dobEncrypted } : {}),
              nameMasked,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
        }
      }
    } catch (fasErr) {
      console.error(
        "Failed to fetch FAS employee info for phone update:",
        fasErr,
      );
      // Non-blocking: login still succeeds even if FAS lookup fails
    }
  }

  const accessToken = await signJwt(
    { sub: user.id, phone: "", role: user.role },
    c.env.JWT_SECRET,
  );
  const refreshToken = crypto.randomUUID();

  await db
    .update(users)
    .set({ refreshToken, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await c.env.KV.delete(attemptKey);

  return respondWithDelay(
    success(
      c,
      {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        user: {
          id: user.id,
          phone: "",
          role: user.role,
          name: user.name,
          nameMasked: user.nameMasked,
        },
      },
      200,
    ),
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

  // Rate limit refresh attempts by IP
  const clientIp =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const refreshRateLimit = await checkRateLimit(
    c.env,
    `refresh:${clientIp}`,
    10,
    60 * 1000,
  );
  if (!refreshRateLimit.allowed) {
    return error(
      c,
      "RATE_LIMITED",
      "Too many refresh attempts. Please try again later.",
      429,
    );
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
  const phoneForToken =
    user.piiViewFull && user.phoneEncrypted
      ? await decrypt(c.env.ENCRYPTION_KEY, user.phoneEncrypted)
      : "";
  const accessToken = await signJwt(
    { sub: user.id, phone: phoneForToken, role: user.role },
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

// Admin login with username/password
auth.post("/admin/login", async (c) => {
  const startedAt = Date.now();
  const respondWithDelay = async (response: Response) => {
    await enforceMinimumResponseTime(startedAt);
    return response;
  };

  let body: { username: string; password: string };
  try {
    body = await c.req.json();
  } catch {
    return respondWithDelay(error(c, "INVALID_JSON", "Invalid JSON", 400));
  }

  if (!body.username || !body.password) {
    return respondWithDelay(
      error(c, "MISSING_FIELDS", "username and password are required", 400),
    );
  }

  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const rateLimitKey = `auth:admin:login:ip:${clientIp}`;
  const rateLimit = await checkRateLimit(c.env, rateLimitKey, 5, 60 * 1000);

  if (!rateLimit.allowed) {
    return respondWithDelay(
      error(
        c,
        "RATE_LIMIT_EXCEEDED",
        "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
        429,
      ),
    );
  }

  // Admin credentials from environment variables (required)
  const ADMIN_USERNAME = c.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = c.env.ADMIN_PASSWORD;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return respondWithDelay(
      error(
        c,
        "SERVER_ERROR",
        "서버 설정 오류입니다. 관리자에게 문의하세요.",
        500,
      ),
    );
  }

  if (body.username !== ADMIN_USERNAME || body.password !== ADMIN_PASSWORD) {
    return respondWithDelay(
      error(
        c,
        "INVALID_CREDENTIALS",
        "아이디 또는 비밀번호가 올바르지 않습니다",
        401,
      ),
    );
  }

  const db = drizzle(c.env.DB);

  // Find or create admin user
  let adminUser = await db
    .select()
    .from(users)
    .where(eq(users.role, "SUPER_ADMIN"))
    .get();

  if (!adminUser) {
    // Create default super admin user
    adminUser = await db
      .insert(users)
      .values({
        name: "관리자",
        nameMasked: "관*자",
        phone: "admin",
        phoneHash: await hmac(c.env.HMAC_SECRET, "admin"),
        role: "SUPER_ADMIN",
        piiViewFull: true,
        canAwardPoints: true,
        canManageUsers: true,
      })
      .returning()
      .get();
  }

  const accessToken = await signJwt(
    { sub: adminUser.id, phone: "", role: adminUser.role },
    c.env.JWT_SECRET,
  );
  const refreshToken = crypto.randomUUID();

  await db
    .update(users)
    .set({ refreshToken, updatedAt: new Date() })
    .where(eq(users.id, adminUser.id));

  return respondWithDelay(
    success(
      c,
      {
        user: {
          id: adminUser.id,
          phone: "",
          nameMasked: adminUser.nameMasked || "관리자",
          role: adminUser.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      200,
    ),
  );
});

auth.get("/me", authMiddleware, async (c) => {
  const authContext = c.get("auth");
  if (!authContext) {
    throw new HTTPException(401, { message: "인증이 필요합니다." });
  }

  const db = drizzle(c.env.DB);
  const userId = authContext.user.id;

  const userResults = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userResults.length === 0) {
    throw new HTTPException(404, { message: "사용자를 찾을 수 없습니다." });
  }

  const user = userResults[0];

  const membershipResults = await db
    .select()
    .from(siteMemberships)
    .where(eq(siteMemberships.userId, userId))
    .limit(1);

  const siteId =
    membershipResults.length > 0 ? membershipResults[0].siteId : "";

  const { start, end } = getTodayRange();
  const attendanceRecords = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, userId), eq(attendance.result, "SUCCESS")))
    .limit(100);

  const todayAttendance = attendanceRecords.find((record) => {
    const checkinTime = record.checkinAt;
    return checkinTime && checkinTime >= start && checkinTime < end;
  });

  return success(
    c,
    {
      id: user.id,
      name: user.name || "",
      nameMasked: user.nameMasked || "",
      role: user.role,
      siteId,
      permissions: [
        user.piiViewFull ? "PII_VIEW_FULL" : "PII_VIEW_MASKED",
        user.canAwardPoints ? "AWARD_POINTS" : "",
        user.canManageUsers ? "MANAGE_USERS" : "",
      ].filter(Boolean),
      todayAttendance: todayAttendance
        ? { checkinAt: todayAttendance.checkinAt.toISOString() }
        : null,
    },
    200,
  );
});

export default auth;
