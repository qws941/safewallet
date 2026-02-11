import type { Context } from "hono";
import type { Env } from "../types";

/**
 * Analytics Engine middleware for API monitoring
 * Tracks request count, latency, status codes, and errors
 *
 * Usage:
 *   app.use("*", analyticsMiddleware);
 *
 * IMPORTANT: writeDataPoint() is non-blocking, never await it
 * Follows production pattern from Cloudflare docs
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

    // Track metrics only if Analytics Engine is configured
    if (c.env.ANALYTICS) {
      // IMPORTANT: Do NOT await writeDataPoint - it's non-blocking
      c.env.ANALYTICS.writeDataPoint({
        indexes: [endpoint], // Indexed for filtering
        blobs: [method, status, errorType || ""], // String dimensions
        doubles: [1, duration, timestamp], // count, latency, timestamp
      });
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
