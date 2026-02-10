import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../types";
import { recommendations, users, sites } from "../../db/schema";
import * as schema from "../../db/schema";
import { requireAdmin, buildCsv, csvResponse } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// GET /recommendations - List with filters
app.get(
  "/recommendations",
  requireAdmin,
  zValidator(
    "query",
    z.object({
      siteId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const { siteId, startDate, endDate, page, limit } = c.req.valid("query");

    const conditions: ReturnType<typeof eq>[] = [];
    if (siteId) conditions.push(eq(recommendations.siteId, siteId));
    if (startDate)
      conditions.push(gte(recommendations.recommendationDate, startDate));
    if (endDate)
      conditions.push(lte(recommendations.recommendationDate, endDate));

    const offset = (page - 1) * limit;
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: recommendations.id,
          siteId: recommendations.siteId,
          siteName: sites.name,
          recommenderId: recommendations.recommenderId,
          recommenderName: users.name,
          recommenderCompany: users.companyName,
          recommendedName: recommendations.recommendedName,
          tradeType: recommendations.tradeType,
          reason: recommendations.reason,
          recommendationDate: recommendations.recommendationDate,
          createdAt: recommendations.createdAt,
        })
        .from(recommendations)
        .leftJoin(users, eq(recommendations.recommenderId, users.id))
        .leftJoin(sites, eq(recommendations.siteId, sites.id))
        .where(where)
        .orderBy(desc(recommendations.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(recommendations).where(where),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return c.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /recommendations/stats - Aggregation stats
app.get(
  "/recommendations/stats",
  requireAdmin,
  zValidator(
    "query",
    z.object({
      siteId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const { siteId, startDate, endDate } = c.req.valid("query");

    const conditions: ReturnType<typeof eq>[] = [];
    if (siteId) conditions.push(eq(recommendations.siteId, siteId));
    if (startDate)
      conditions.push(gte(recommendations.recommendationDate, startDate));
    if (endDate)
      conditions.push(lte(recommendations.recommendationDate, endDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, topRecommended, dailyCounts] = await Promise.all([
      db.select({ count: count() }).from(recommendations).where(where),
      db
        .select({
          recommendedName: recommendations.recommendedName,
          tradeType: recommendations.tradeType,
          count: count(),
        })
        .from(recommendations)
        .where(where)
        .groupBy(recommendations.recommendedName, recommendations.tradeType)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({
          date: recommendations.recommendationDate,
          count: count(),
        })
        .from(recommendations)
        .where(where)
        .groupBy(recommendations.recommendationDate)
        .orderBy(desc(recommendations.recommendationDate))
        .limit(30),
    ]);

    return c.json({
      success: true,
      data: {
        totalRecommendations: totalResult[0]?.count ?? 0,
        topRecommended,
        dailyCounts,
      },
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /recommendations/export - CSV export
app.get(
  "/recommendations/export",
  requireAdmin,
  zValidator(
    "query",
    z.object({
      siteId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const { siteId, startDate, endDate } = c.req.valid("query");

    const conditions: ReturnType<typeof eq>[] = [];
    if (siteId) conditions.push(eq(recommendations.siteId, siteId));
    if (startDate)
      conditions.push(gte(recommendations.recommendationDate, startDate));
    if (endDate)
      conditions.push(lte(recommendations.recommendationDate, endDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        recommendationDate: recommendations.recommendationDate,
        recommenderName: users.name,
        recommenderCompany: users.companyName,
        recommendedName: recommendations.recommendedName,
        tradeType: recommendations.tradeType,
        reason: recommendations.reason,
        siteName: sites.name,
      })
      .from(recommendations)
      .leftJoin(users, eq(recommendations.recommenderId, users.id))
      .leftJoin(sites, eq(recommendations.siteId, sites.id))
      .where(where)
      .orderBy(desc(recommendations.createdAt));

    const csv = buildCsv(
      ["추천일", "추천자", "소속", "피추천자", "공종", "추천 사유", "현장"],
      rows.map((r) => [
        r.recommendationDate,
        r.recommenderName ?? "",
        r.recommenderCompany ?? "",
        r.recommendedName,
        r.tradeType,
        r.reason,
        r.siteName ?? "",
      ]),
    );

    return csvResponse(
      c,
      csv,
      `recommendations-export-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  },
);

export default app;
