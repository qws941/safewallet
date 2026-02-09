import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, gte, lt, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { users, sites, posts, attendance } from "../../db/schema";
import { success } from "../../lib/response";
import { requireAdmin } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/stats", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    userCount,
    siteCount,
    postCount,
    activeAttendanceCount,
    pendingCount,
    urgentCount,
    avgProcessingResult,
    categoryDistributionResult,
    todayPostsCount,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .get(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sites)
      .get(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(posts)
      .get(),
    db
      .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
      .from(attendance)
      .where(
        and(
          gte(attendance.checkinAt, today),
          lt(attendance.checkinAt, tomorrow),
        ),
      )
      .get(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(posts)
      .where(sql`${posts.reviewStatus} IN ('RECEIVED', 'IN_REVIEW')`)
      .get(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(posts)
      .where(
        and(
          eq(posts.isUrgent, true),
          sql`${posts.reviewStatus} NOT IN ('APPROVED', 'REJECTED')`,
        ),
      )
      .get(),
    db
      .select({
        avgHours: sql<number>`COALESCE(AVG((${posts.updatedAt} - ${posts.createdAt}) / 3600.0), 0)`,
      })
      .from(posts)
      .where(sql`${posts.reviewStatus} IN ('APPROVED', 'REJECTED')`)
      .get(),
    db
      .select({
        category: posts.category,
        count: sql<number>`COUNT(*)`,
      })
      .from(posts)
      .groupBy(posts.category)
      .all(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(posts)
      .where(and(gte(posts.createdAt, today), lt(posts.createdAt, tomorrow)))
      .get(),
  ]);

  const categoryDistribution: Record<string, number> = {};
  for (const row of categoryDistributionResult) {
    categoryDistribution[row.category] = row.count;
  }

  return success(c, {
    stats: {
      totalUsers: userCount?.count || 0,
      totalSites: siteCount?.count || 0,
      totalPosts: postCount?.count || 0,
      activeUsersToday: activeAttendanceCount?.count || 0,
      pendingCount: pendingCount?.count || 0,
      urgentCount: urgentCount?.count || 0,
      avgProcessingHours:
        Math.round((avgProcessingResult?.avgHours || 0) * 10) / 10,
      categoryDistribution,
      todayPostsCount: todayPostsCount?.count || 0,
    },
  });
});

export default app;
