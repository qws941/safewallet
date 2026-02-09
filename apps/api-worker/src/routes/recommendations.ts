import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { recommendations, siteMemberships } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
import { success, error } from "../lib/response";
import type { Env, AuthContext } from "../types";

const recommendationsRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

const CreateRecommendationSchema = z.object({
  siteId: z.string(),
  recommendedName: z.string().min(1).max(50),
  tradeType: z.string().min(1).max(50),
  reason: z.string().min(1).max(500),
});

/**
 * Get today's KST date string (YYYY-MM-DD) using 5AM boundary
 */
function getTodayKSTDate(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const dayBoundaryOffset = 5 * 60 * 60 * 1000;
  const kstTime = new Date(now.getTime() + kstOffset - dayBoundaryOffset);
  const year = kstTime.getUTCFullYear();
  const month = String(kstTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kstTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// POST / - Create a recommendation (1/day/site limit)
recommendationsRoute.post(
  "/",
  authMiddleware,
  zValidator("json", CreateRecommendationSchema),
  async (c) => {
    const { siteId, recommendedName, tradeType, reason } = c.req.valid("json");
    const { user } = c.get("auth");

    // FAS attendance guard
    await attendanceMiddleware(c, async () => {}, siteId);

    const db = drizzle(c.env.DB);

    // Verify site membership
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "NO_MEMBERSHIP", "현장 소속이 없습니다.", 403);
    }

    const todayDate = getTodayKSTDate();

    // Check if already recommended today
    const existing = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.siteId, siteId),
          eq(recommendations.recommenderId, user.id),
          eq(recommendations.recommendationDate, todayDate),
        ),
      )
      .get();

    if (existing) {
      return error(
        c,
        "ALREADY_RECOMMENDED",
        "오늘 이미 추천하셨습니다. 내일 다시 추천해주세요.",
        409,
      );
    }

    const result = await db
      .insert(recommendations)
      .values({
        siteId,
        recommenderId: user.id,
        recommendedName: recommendedName.trim(),
        tradeType: tradeType.trim(),
        reason: reason.trim(),
        recommendationDate: todayDate,
      })
      .returning()
      .get();

    return success(c, result, 201);
  },
);

// GET /today - Check if user already recommended today
recommendationsRoute.get("/today", authMiddleware, async (c) => {
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");

  if (!siteId) {
    return error(c, "MISSING_SITE_ID", "siteId가 필요합니다.", 400);
  }

  const db = drizzle(c.env.DB);
  const todayDate = getTodayKSTDate();

  const existing = await db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.siteId, siteId),
        eq(recommendations.recommenderId, user.id),
        eq(recommendations.recommendationDate, todayDate),
      ),
    )
    .get();

  return success(c, {
    hasRecommendedToday: !!existing,
    recommendation: existing || null,
  });
});

// GET /my - Get user's recommendation history
recommendationsRoute.get("/my", authMiddleware, async (c) => {
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");

  if (!siteId) {
    return error(c, "MISSING_SITE_ID", "siteId가 필요합니다.", 400);
  }

  const db = drizzle(c.env.DB);

  const results = await db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.siteId, siteId),
        eq(recommendations.recommenderId, user.id),
      ),
    )
    .orderBy(desc(recommendations.createdAt))
    .limit(30)
    .all();

  return success(c, results);
});

export default recommendationsRoute;
