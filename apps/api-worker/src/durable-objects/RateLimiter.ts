import type { Env } from "../types";

interface LimitState {
  count: number;
  resetAt: number;
}

interface FailureState {
  failures: number;
  lockedUntil: number | null;
}

interface OtpLimitState {
  hourlyCount: number;
  hourlyResetAt: number;
  dailyCount: number;
  dailyResetAt: number;
}

type CheckLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type FailureResult = {
  failures: number;
  lockedUntil: number | null;
};

type OtpLimitResult = {
  allowed: boolean;
  hourlyRemaining: number;
  dailyRemaining: number;
  resetAt: number;
  reason?: "HOURLY_LIMIT" | "DAILY_LIMIT";
};

type RateLimiterRequest =
  | { action: "checkLimit"; key: string; limit: number; windowMs: number }
  | { action: "recordFailure"; key: string }
  | { action: "resetFailures"; key: string }
  | { action: "checkOtpLimit"; key: string }
  | { action: "resetOtpLimit"; key: string };

const OTP_LOCK_MS = 15 * 60 * 1000;
const OTP_HOURLY_LIMIT = 5;
const OTP_DAILY_LIMIT = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const CLEANUP_ALARM_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class RateLimiter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    void env;

    // Initialize alarm for cleanup on first access
    state.blockConcurrencyWhile(async () => {
      const currentAlarm = await state.storage.getAlarm();
      if (currentAlarm === null) {
        await state.storage.setAlarm(Date.now() + CLEANUP_ALARM_MS);
      }
    });
  }

  async alarm(): Promise<void> {
    // Clean up expired entries older than 7 days
    const now = Date.now();
    const cutoff = now - CLEANUP_ALARM_MS;
    
    const allKeys = await this.state.storage.list();
    const keysToDelete: string[] = [];

    for (const [key, value] of allKeys) {
      if (typeof value === "object" && value !== null) {
        // Check LimitState entries
        if ("resetAt" in value && typeof value.resetAt === "number") {
          if (value.resetAt < cutoff) {
            keysToDelete.push(key);
          }
        }
        // Check OtpLimitState entries
        else if ("dailyResetAt" in value && typeof value.dailyResetAt === "number") {
          if (value.dailyResetAt < cutoff) {
            keysToDelete.push(key);
          }
        }
      }
    }

    if (keysToDelete.length > 0) {
      await this.state.storage.delete(keysToDelete);
    }

    // Schedule next cleanup
    await this.state.storage.setAlarm(Date.now() + CLEANUP_ALARM_MS);
  }

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<CheckLimitResult> {
    const now = Date.now();
    const record = await this.state.storage.get<LimitState>(key);

    if (!record || record.resetAt <= now) {
      const next: LimitState = { count: 1, resetAt: now + windowMs };
      await this.state.storage.put(key, next);
      return {
        allowed: true,
        remaining: Math.max(0, limit - next.count),
        resetAt: next.resetAt,
      };
    }

    if (record.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
      };
    }

    const updated: LimitState = {
      count: record.count + 1,
      resetAt: record.resetAt,
    };
    await this.state.storage.put(key, updated);

    return {
      allowed: true,
      remaining: Math.max(0, limit - updated.count),
      resetAt: updated.resetAt,
    };
  }

  async recordFailure(key: string): Promise<FailureResult> {
    const now = Date.now();
    const record = await this.state.storage.get<FailureState>(key);

    let failures = record?.failures ?? 0;
    let lockedUntil = record?.lockedUntil ?? null;

    if (lockedUntil !== null && lockedUntil <= now) {
      failures = 0;
      lockedUntil = null;
    }

    failures += 1;

    if (failures >= 5) {
      lockedUntil = now + OTP_LOCK_MS;
    }

    const updated: FailureState = { failures, lockedUntil };
    await this.state.storage.put(key, updated);
    return updated;
  }

  async resetFailures(key: string): Promise<void> {
    await this.state.storage.delete(key);
  }

  async checkOtpLimit(key: string): Promise<OtpLimitResult> {
    const now = Date.now();
    const storageKey = `otp:${key}`;
    const record = await this.state.storage.get<OtpLimitState>(storageKey);

    let hourlyCount = 0;
    let hourlyResetAt = now + ONE_HOUR_MS;
    let dailyCount = 0;
    let dailyResetAt = now + TWENTY_FOUR_HOURS_MS;

    if (record) {
      // Reset hourly if window expired
      if (record.hourlyResetAt <= now) {
        hourlyCount = 0;
        hourlyResetAt = now + ONE_HOUR_MS;
      } else {
        hourlyCount = record.hourlyCount;
        hourlyResetAt = record.hourlyResetAt;
      }

      // Reset daily if window expired
      if (record.dailyResetAt <= now) {
        dailyCount = 0;
        dailyResetAt = now + TWENTY_FOUR_HOURS_MS;
      } else {
        dailyCount = record.dailyCount;
        dailyResetAt = record.dailyResetAt;
      }
    }

    // Check daily limit first (stricter)
    if (dailyCount >= OTP_DAILY_LIMIT) {
      return {
        allowed: false,
        hourlyRemaining: Math.max(0, OTP_HOURLY_LIMIT - hourlyCount),
        dailyRemaining: 0,
        resetAt: dailyResetAt,
        reason: "DAILY_LIMIT",
      };
    }

    // Check hourly limit
    if (hourlyCount >= OTP_HOURLY_LIMIT) {
      return {
        allowed: false,
        hourlyRemaining: 0,
        dailyRemaining: Math.max(0, OTP_DAILY_LIMIT - dailyCount),
        resetAt: hourlyResetAt,
        reason: "HOURLY_LIMIT",
      };
    }

    // Increment both counters
    const updated: OtpLimitState = {
      hourlyCount: hourlyCount + 1,
      hourlyResetAt,
      dailyCount: dailyCount + 1,
      dailyResetAt,
    };
    await this.state.storage.put(storageKey, updated);

    return {
      allowed: true,
      hourlyRemaining: Math.max(0, OTP_HOURLY_LIMIT - updated.hourlyCount),
      dailyRemaining: Math.max(0, OTP_DAILY_LIMIT - updated.dailyCount),
      resetAt: hourlyResetAt,
    };
  }

  async resetOtpLimit(key: string): Promise<void> {
    await this.state.storage.delete(`otp:${key}`);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let payload: RateLimiterRequest;
    try {
      payload = (await request.json()) as RateLimiterRequest;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!payload || typeof payload !== "object") {
      return new Response("Invalid payload", { status: 400 });
    }

    if (payload.action === "checkLimit") {
      const result = await this.checkLimit(
        payload.key,
        payload.limit,
        payload.windowMs,
      );
      return Response.json(result);
    }

    if (payload.action === "recordFailure") {
      const result = await this.recordFailure(payload.key);
      return Response.json(result);
    }

    if (payload.action === "resetFailures") {
      await this.resetFailures(payload.key);
      return Response.json({ ok: true });
    }

    if (payload.action === "checkOtpLimit") {
      const result = await this.checkOtpLimit(payload.key);
      return Response.json(result);
    }

    if (payload.action === "resetOtpLimit") {
      await this.resetOtpLimit(payload.key);
      return Response.json({ ok: true });
    }

    return new Response("Unknown action", { status: 400 });
  }
}
