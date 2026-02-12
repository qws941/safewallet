import type { Context } from "hono";
import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import { apiMetrics } from "../db/schema";

/**
 * Compute 5-minute bucket key for metrics aggregation.
 * Uses UTC to avoid timezone issues in aggregation.
 */
function computeBucket(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const mins = Math.floor(now.getUTCMinutes() / 5) * 5;
  const mm = String(mins).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${mm}`;
}

/**
 * Analytics Engine middleware for API monitoring
 * Tracks request count, latency, status codes, and errors
 *
 * Dual-write:
 *   1. Analytics Engine — non-blocking writeDataPoint (if configured)
 *   2. D1 apiMetrics table — 5-min bucketed aggregates via waitUntil
 *
 * IMPORTANT: writeDataPoint() is non-blocking, never await it
 */
export async function analyticsMiddleware(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>,
): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  // Extract endpoint pattern (remove IDs for aggregation)
  const endpoint = path
    .replace(/\/[a-f0-9-]{36}/gi, "/:id") // UUID
    .replace(/\/\d+/g, "/:id"); // Numeric IDs

  let status = "200";
  let errorType: string | null = null;

  try {
    await next();
    status = c.res.status.toString();
  } catch (err) {
    status = "500";
    errorType = err instanceof Error ? err.name : "UnknownError";
    throw err;
  } finally {
    const duration = Date.now() - start;
    const timestamp = Math.floor(Date.now() / 1000);

    // 1. Analytics Engine (non-blocking, fire-and-forget)
    if (c.env.ANALYTICS) {
      // IMPORTANT: Do NOT await writeDataPoint - it's non-blocking
      c.env.ANALYTICS.writeDataPoint({
        indexes: [endpoint], // Indexed for filtering
        blobs: [method, status, errorType || ""], // String dimensions
        doubles: [1, duration, timestamp], // count, latency, timestamp
      });
    }

    // 2. D1 dual-write for admin monitoring dashboard (API routes only)
    if (endpoint.startsWith("/api/")) {
      try {
        const statusCode = parseInt(status, 10);
        const bucket = computeBucket();
        const is2xx = statusCode >= 200 && statusCode < 300 ? 1 : 0;
        const is4xx = statusCode >= 400 && statusCode < 500 ? 1 : 0;
        const is5xx = statusCode >= 500 ? 1 : 0;
        const isError = statusCode >= 400 ? 1 : 0;

        const db = drizzle(c.env.DB);
        const writePromise = db
          .insert(apiMetrics)
          .values({
            bucket,
            endpoint,
            method,
            requestCount: 1,
            errorCount: isError,
            totalDurationMs: duration,
            maxDurationMs: duration,
            status2xx: is2xx,
            status4xx: is4xx,
            status5xx: is5xx,
          })
          .onConflictDoUpdate({
            target: [apiMetrics.bucket, apiMetrics.endpoint, apiMetrics.method],
            set: {
              requestCount: sql`${apiMetrics.requestCount} + 1`,
              errorCount: sql`${apiMetrics.errorCount} + ${isError}`,
              totalDurationMs: sql`${apiMetrics.totalDurationMs} + ${duration}`,
              maxDurationMs: sql`max(${apiMetrics.maxDurationMs}, ${duration})`,
              status2xx: sql`${apiMetrics.status2xx} + ${is2xx}`,
              status4xx: sql`${apiMetrics.status4xx} + ${is4xx}`,
              status5xx: sql`${apiMetrics.status5xx} + ${is5xx}`,
            },
          })
          .catch(() => {}); // Silently ignore — monitoring must not break the API

        // Non-blocking: continue response delivery while D1 write completes
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(writePromise);
        }
      } catch {
        // D1 write setup failure — silently ignore
      }
    }
  }
}

/**
 * Track custom business events to Analytics Engine
 * Use for domain-specific metrics beyond HTTP requests
 *
 * Example:
 *   trackEvent(c, "post_created", { category: "HAZARD", siteId });
 */
export function trackEvent<E extends { Bindings: Env }>(
  c: Context<E>,
  eventName: string,
  data: {
    category?: string;
    siteId?: string;
    userId?: string;
    count?: number;
    value?: number;
  } = {},
): void {
  if (!c.env.ANALYTICS) return;

  const timestamp = Math.floor(Date.now() / 1000);

  // Do NOT await - non-blocking
  c.env.ANALYTICS.writeDataPoint({
    indexes: [eventName],
    blobs: [data.category || "", data.siteId || "", data.userId || ""],
    doubles: [data.count || 1, data.value || 0, timestamp],
  });
}
