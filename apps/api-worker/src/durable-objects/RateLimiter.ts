import type { Env } from "../types";

interface LimitState {
  count: number;
  resetAt: number;
}

interface FailureState {
  failures: number;
  lockedUntil: number | null;
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

type RateLimiterRequest =
  | { action: "checkLimit"; key: string; limit: number; windowMs: number }
  | { action: "recordFailure"; key: string }
  | { action: "resetFailures"; key: string };

const OTP_LOCK_MS = 15 * 60 * 1000;

export class RateLimiter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    void env;
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

    return new Response("Unknown action", { status: 400 });
  }
}
