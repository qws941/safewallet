import type { Context, Next } from "hono";
import type { Env } from "../types";

interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  keyGenerator?: (c: Context) => string;
}

const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_WINDOW_MS = 60 * 1000;

export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  const {
    maxRequests = DEFAULT_MAX_REQUESTS,
    windowMs = DEFAULT_WINDOW_MS,
    keyGenerator = defaultKeyGenerator,
  } = options;

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const rateLimiter = c.env.RATE_LIMITER;

    if (!rateLimiter) {
      console.warn("Rate limiter DO not configured, skipping rate limit");
      return next();
    }

    const key = keyGenerator(c);
    const id = rateLimiter.idFromName(key);
    const stub = rateLimiter.get(id);

    try {
      const response = await stub.fetch("https://rate-limiter/check", {
        method: "POST",
        body: JSON.stringify({ maxRequests, windowMs }),
      });

      const result = await response.json<{
        allowed: boolean;
        remaining: number;
        resetAt: number;
      }>();

      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", String(result.remaining));
      c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

      if (!result.allowed) {
        return c.json(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests, please try again later",
            },
            timestamp: new Date().toISOString(),
          },
          429,
        );
      }

      return next();
    } catch (err) {
      console.error("Rate limiter error:", err);
      return next();
    }
  };
}

function defaultKeyGenerator(c: Context): string {
  const auth = c.get("auth");
  if (auth?.user?.id) {
    return `user:${auth.user.id}`;
  }

  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "anonymous";
  return `ip:${ip}`;
}

export function authRateLimitMiddleware() {
  return rateLimitMiddleware({
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyGenerator: (c) => {
      const ip =
        c.req.header("CF-Connecting-IP") ||
        c.req.header("X-Forwarded-For") ||
        "anonymous";
      return `auth:${ip}`;
    },
  });
}
