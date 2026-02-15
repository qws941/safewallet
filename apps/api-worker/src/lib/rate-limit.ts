import type { Env } from "../types";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface OtpRateLimitResult {
  allowed: boolean;
  hourlyRemaining: number;
  dailyRemaining: number;
  resetAt: number;
  reason?: "HOURLY_LIMIT" | "DAILY_LIMIT";
}

export interface FailureResult {
  failures: number;
  lockedUntil: number | null;
}

interface InMemoryRateLimitState {
  count: number;
  resetAt: number;
}

const inMemoryFallback = new Map<string, InMemoryRateLimitState>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastCleanupTime = Date.now();

/**
 * Cleanup expired entries from in-memory fallback map.
 * Runs periodically to prevent unbounded memory growth.
 * Should be called before checking limits to ensure stale entries are removed.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupTime = now;
  const expiredKeys: string[] = [];

  // Identify expired entries
  for (const [key, state] of inMemoryFallback.entries()) {
    if (state.resetAt <= now) {
      expiredKeys.push(key);
    }
  }

  // Delete expired entries
  for (const key of expiredKeys) {
    inMemoryFallback.delete(key);
  }
}

async function callDurableObject<T>(
  env: Env,
  key: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  if (!env.RATE_LIMITER) {
    return null;
  }

  try {
    const id = env.RATE_LIMITER.idFromName(key);
    const stub = env.RATE_LIMITER.get(id);
    const response = await stub.fetch("https://rate-limiter/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function checkInMemoryLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanupExpiredEntries();  // Clean up before checking
  const now = Date.now();
  const record = inMemoryFallback.get(key);

  if (!record || record.resetAt <= now) {
    const next: InMemoryRateLimitState = { count: 1, resetAt: now + windowMs };
    inMemoryFallback.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(0, limit - next.count),
      resetAt: next.resetAt,
    };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt,
  };
}

export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const durableResult = await callDurableObject<RateLimitResult>(env, key, {
    action: "checkLimit",
    key,
    limit,
    windowMs,
  });

  if (durableResult) {
    return durableResult;
  }

  return checkInMemoryLimit(key, limit, windowMs);
}

export async function checkOtpRateLimit(
  env: Env,
  phoneKey: string,
): Promise<OtpRateLimitResult> {
  const durableResult = await callDurableObject<OtpRateLimitResult>(
    env,
    `otp:${phoneKey}`,
    {
      action: "checkOtpLimit",
      key: phoneKey,
    },
  );

  if (durableResult) {
    return durableResult;
  }

  const genericResult = checkInMemoryLimit(
    `otp:${phoneKey}`,
    5,
    60 * 60 * 1000,
  );
  return {
    allowed: genericResult.allowed,
    hourlyRemaining: genericResult.remaining,
    dailyRemaining: 10,
    resetAt: genericResult.resetAt,
  };
}

export async function recordLoginFailure(
  env: Env,
  key: string,
): Promise<FailureResult | null> {
  return callDurableObject<FailureResult>(env, key, {
    action: "recordFailure",
    key,
  });
}

export async function resetLoginFailures(env: Env, key: string): Promise<void> {
  await callDurableObject(env, key, {
    action: "resetFailures",
    key,
  });
}

export async function resetOtpLimit(env: Env, phoneKey: string): Promise<void> {
  await callDurableObject(env, `otp:${phoneKey}`, {
    action: "resetOtpLimit",
    key: phoneKey,
  });
}
