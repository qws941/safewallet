import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { drizzle } from "drizzle-orm/d1";
import { sql, gte, lte, and, desc } from "drizzle-orm";
import { apiMetrics } from "../../db/schema";
import { success } from "../../lib/response";
import { requireAdmin, type AppContext } from "./helpers";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

/**
 * GET /monitoring/metrics
 * Query time-series metrics with date range.
 * Query params: from, to (ISO bucket strings), groupBy ("endpoint" | "bucket")
 */
app.get("/monitoring/metrics", requireAdmin, async (c: AppContext) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  const groupBy = c.req.query("groupBy") || "bucket";

  // Default: last 24 hours
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fromBucket =
    from || defaultFrom.toISOString().slice(0, 16).replace("T", "T");
  const toBucket = to || now.toISOString().slice(0, 16);

  const db = drizzle(c.env.DB);

  const conditions = and(
    gte(apiMetrics.bucket, fromBucket),
    lte(apiMetrics.bucket, toBucket),
  );

  if (groupBy === "endpoint") {
    // Aggregate by endpoint across all buckets
    const rows = await db
      .select({
        endpoint: apiMetrics.endpoint,
        method: apiMetrics.method,
        totalRequests: sql<number>`sum(${apiMetrics.requestCount})`,
        totalErrors: sql<number>`sum(${apiMetrics.errorCount})`,
        avgDurationMs: sql<number>`cast(sum(${apiMetrics.totalDurationMs}) as real) / sum(${apiMetrics.requestCount})`,
        maxDurationMs: sql<number>`max(${apiMetrics.maxDurationMs})`,
        total2xx: sql<number>`sum(${apiMetrics.status2xx})`,
        total4xx: sql<number>`sum(${apiMetrics.status4xx})`,
        total5xx: sql<number>`sum(${apiMetrics.status5xx})`,
      })
      .from(apiMetrics)
      .where(conditions)
      .groupBy(apiMetrics.endpoint, apiMetrics.method)
      .orderBy(desc(sql`sum(${apiMetrics.requestCount})`));

    return success(c, { groupBy, from: fromBucket, to: toBucket, rows });
  }

  // Default: group by bucket (time series)
  const rows = await db
    .select({
      bucket: apiMetrics.bucket,
      totalRequests: sql<number>`sum(${apiMetrics.requestCount})`,
      totalErrors: sql<number>`sum(${apiMetrics.errorCount})`,
      avgDurationMs: sql<number>`cast(sum(${apiMetrics.totalDurationMs}) as real) / sum(${apiMetrics.requestCount})`,
      maxDurationMs: sql<number>`max(${apiMetrics.maxDurationMs})`,
      total2xx: sql<number>`sum(${apiMetrics.status2xx})`,
      total4xx: sql<number>`sum(${apiMetrics.status4xx})`,
      total5xx: sql<number>`sum(${apiMetrics.status5xx})`,
    })
    .from(apiMetrics)
    .where(conditions)
    .groupBy(apiMetrics.bucket)
    .orderBy(apiMetrics.bucket);

  return success(c, { groupBy, from: fromBucket, to: toBucket, rows });
});

/**
 * GET /monitoring/top-errors
 * Top endpoints by error rate in a given period.
 * Query params: from, to, limit (default 10)
 */
app.get("/monitoring/top-errors", requireAdmin, async (c: AppContext) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  const limit = Math.min(parseInt(c.req.query("limit") || "10", 10), 100);

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fromBucket = from || defaultFrom.toISOString().slice(0, 16);
  const toBucket = to || now.toISOString().slice(0, 16);

  const db = drizzle(c.env.DB);

  const rows = await db
    .select({
      endpoint: apiMetrics.endpoint,
      method: apiMetrics.method,
      totalRequests: sql<number>`sum(${apiMetrics.requestCount})`,
      totalErrors: sql<number>`sum(${apiMetrics.errorCount})`,
      errorRate: sql<number>`cast(sum(${apiMetrics.errorCount}) as real) / sum(${apiMetrics.requestCount})`,
      total5xx: sql<number>`sum(${apiMetrics.status5xx})`,
    })
    .from(apiMetrics)
    .where(
      and(gte(apiMetrics.bucket, fromBucket), lte(apiMetrics.bucket, toBucket)),
    )
    .groupBy(apiMetrics.endpoint, apiMetrics.method)
    .having(sql`sum(${apiMetrics.errorCount}) > 0`)
    .orderBy(
      desc(
        sql`cast(sum(${apiMetrics.errorCount}) as real) / sum(${apiMetrics.requestCount})`,
      ),
    )
    .limit(limit);

  return success(c, { from: fromBucket, to: toBucket, rows });
});

/**
 * GET /monitoring/summary
 * Quick health overview for dashboard card.
 * Query params: minutes (default 60)
 */
app.get("/monitoring/summary", requireAdmin, async (c: AppContext) => {
  const minutes = Math.min(parseInt(c.req.query("minutes") || "60", 10), 1440);

  const now = new Date();
  const from = new Date(now.getTime() - minutes * 60 * 1000);
  const fromBucket = from.toISOString().slice(0, 16);

  const db = drizzle(c.env.DB);

  const [summary] = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${apiMetrics.requestCount}), 0)`,
      totalErrors: sql<number>`coalesce(sum(${apiMetrics.errorCount}), 0)`,
      avgDurationMs: sql<number>`coalesce(cast(sum(${apiMetrics.totalDurationMs}) as real) / nullif(sum(${apiMetrics.requestCount}), 0), 0)`,
      maxDurationMs: sql<number>`coalesce(max(${apiMetrics.maxDurationMs}), 0)`,
      total2xx: sql<number>`coalesce(sum(${apiMetrics.status2xx}), 0)`,
      total4xx: sql<number>`coalesce(sum(${apiMetrics.status4xx}), 0)`,
      total5xx: sql<number>`coalesce(sum(${apiMetrics.status5xx}), 0)`,
    })
    .from(apiMetrics)
    .where(gte(apiMetrics.bucket, fromBucket));

  const totalRequests = summary?.totalRequests ?? 0;
  const totalErrors = summary?.totalErrors ?? 0;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  return success(c, {
    periodMinutes: minutes,
    from: fromBucket,
    totalRequests,
    totalErrors,
    errorRate: Math.round(errorRate * 10000) / 100, // percentage with 2 decimals
    avgDurationMs: Math.round(summary?.avgDurationMs ?? 0),
    maxDurationMs: summary?.maxDurationMs ?? 0,
    statusBreakdown: {
      "2xx": summary?.total2xx ?? 0,
      "4xx": summary?.total4xx ?? 0,
      "5xx": summary?.total5xx ?? 0,
    },
  });
});

export default app;
