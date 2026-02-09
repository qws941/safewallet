import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, desc, gte, lt } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import {
  posts,
  users,
  sites,
  reviews,
  pointsLedger,
  manualApprovals,
  auditLogs,
  categoryEnum,
  riskLevelEnum,
  reviewStatusEnum,
} from "../../db/schema";
import { success, error } from "../../lib/response";
import {
  AdminReviewPostSchema,
  AdminManualApprovalSchema,
} from "../../validators/schemas";
import { AppContext, requireManagerOrAdmin, getTodayRange } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/posts", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const category = c.req.query("category");
  const riskLevel = c.req.query("riskLevel");
  const reviewStatus = c.req.query("reviewStatus");
  const isUrgent = c.req.query("isUrgent") === "true";
  const startDateStr = c.req.query("startDate");
  const endDateStr = c.req.query("endDate");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [];

  if (siteId) {
    conditions.push(eq(posts.siteId, siteId));
  }

  if (category) {
    conditions.push(
      eq(posts.category, category as (typeof categoryEnum)[number]),
    );
  }

  if (riskLevel) {
    conditions.push(
      eq(posts.riskLevel, riskLevel as (typeof riskLevelEnum)[number]),
    );
  }

  if (reviewStatus) {
    conditions.push(
      eq(posts.reviewStatus, reviewStatus as (typeof reviewStatusEnum)[number]),
    );
  }

  if (isUrgent) {
    conditions.push(eq(posts.isUrgent, true));
  }

  if (startDateStr) {
    const startDate = new Date(startDateStr);
    if (!isNaN(startDate.getTime())) {
      conditions.push(gte(posts.createdAt, startDate));
    }
  }

  if (endDateStr) {
    const endDate = new Date(endDateStr);
    // Add 1 day to include the end date fully if it's just YYYY-MM-DD
    // But usually frontend sends specific timestamps. Let's assume end of day if specific time not provided?
    // For now, simple date comparison.
    if (!isNaN(endDate.getTime())) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      conditions.push(lt(posts.createdAt, nextDay));
    }
  }

  const results = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.name,
        nameMasked: users.nameMasked,
      },
      site: {
        id: sites.id,
        name: sites.name,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .leftJoin(sites, eq(posts.siteId, sites.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    posts: results.map((row) => ({
      ...row.post,
      author: row.author,
      site: row.site,
    })),
  });
});

app.get("/posts/pending-review", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [];
  conditions.push(
    sql`${posts.reviewStatus} IN ('RECEIVED', 'IN_REVIEW', 'NEED_INFO')`,
  );
  if (siteId) {
    conditions.push(eq(posts.siteId, siteId));
  }

  const pendingPosts = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    posts: pendingPosts.map((row) => ({
      ...row.post,
      author: row.author,
      duplicateWarning: row.post.isPotentialDuplicate,
    })),
  });
});

interface ReviewPostBody {
  action: "APPROVE" | "REJECT" | "REQUEST_MORE";
  comment?: string;
  pointsToAward?: number;
  reasonCode?: string;
}

app.post(
  "/posts/:id/review",
  requireManagerOrAdmin,
  zValidator("json", AdminReviewPostSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: reviewer } = c.get("auth");
    const postId = c.req.param("id");

    const body: z.infer<typeof AdminReviewPostSchema> = c.req.valid("json");

    const validActions = ["APPROVE", "REJECT", "REQUEST_MORE"];
    if (!body.action || !validActions.includes(body.action)) {
      return error(c, "INVALID_ACTION", "Invalid action", 400);
    }

    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      return error(c, "POST_NOT_FOUND", "Post not found", 404);
    }

    const isApproveAction = body.action === "APPROVE";
    const pointsToAward = post.isPotentialDuplicate
      ? 0
      : body.pointsToAward || 0;
    let todayRange: { start: Date; end: Date } | null = null;

    let approvedCountCondition = sql`1 = 1`;
    let pointsLimitCondition = sql`1 = 1`;
    if (isApproveAction) {
      const { start, end } = getTodayRange();
      todayRange = { start, end };
      approvedCountCondition = sql`
      (
        SELECT COUNT(*)
        FROM ${reviews}
        INNER JOIN ${posts} ON ${reviews.postId} = ${posts.id}
        WHERE ${reviews.action} = 'APPROVE'
          AND ${posts.userId} = ${post.userId}
          AND ${posts.siteId} = ${post.siteId}
          AND ${reviews.createdAt} >= ${start}
          AND ${reviews.createdAt} < ${end}
      ) < 3
    `;
      pointsLimitCondition = sql`
      (
        SELECT COALESCE(SUM(${pointsLedger.amount}), 0)
        FROM ${pointsLedger}
        WHERE ${pointsLedger.userId} = ${post.userId}
          AND ${pointsLedger.siteId} = ${post.siteId}
          AND ${pointsLedger.occurredAt} >= ${start}
          AND ${pointsLedger.occurredAt} < ${end}
      ) + ${pointsToAward > 0 ? pointsToAward : 0} <= 30
    `;
    }

    const review = await db
      .insert(reviews)
      .select(
        db
          .select({
            postId: sql<string>`${postId}`.as("postId"),
            adminId: sql<string>`${reviewer.id}`.as("adminId"),
            action: sql<typeof body.action>`${body.action}`.as("action"),
            comment: sql<string | null>`${body.comment ?? null}`.as("comment"),
            reasonCode: sql<string | null>`${body.reasonCode ?? null}`.as(
              "reasonCode",
            ),
          })
          .from(posts)
          .where(
            and(
              eq(posts.id, post.id),
              approvedCountCondition,
              pointsLimitCondition,
            ),
          )
          .limit(1),
      )
      .returning()
      .get();

    if (!review && isApproveAction) {
      const { start, end } = todayRange || getTodayRange();
      const [approvedCountRow, pointsSumRow] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(reviews)
          .innerJoin(posts, eq(reviews.postId, posts.id))
          .where(
            and(
              eq(reviews.action, "APPROVE"),
              eq(posts.userId, post.userId),
              eq(posts.siteId, post.siteId),
              gte(reviews.createdAt, start),
              lt(reviews.createdAt, end),
            ),
          )
          .get(),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
          })
          .from(pointsLedger)
          .where(
            and(
              eq(pointsLedger.userId, post.userId),
              eq(pointsLedger.siteId, post.siteId),
              gte(pointsLedger.occurredAt, start),
              lt(pointsLedger.occurredAt, end),
            ),
          )
          .get(),
      ]);

      const approvedCount = approvedCountRow?.count ?? 0;
      const pointsAwarded = pointsSumRow?.total ?? 0;
      return error(
        c,
        "DAILY_LIMIT_EXCEEDED",
        `Daily limit exceeded: ${approvedCount} approved posts and ${pointsAwarded} points today for this site.`,
        400,
      );
    }

    if (!review) {
      return error(c, "REVIEW_CREATE_FAILED", "Failed to create review", 500);
    }

    if (body.action === "APPROVE" && pointsToAward > 0) {
      const now = new Date();
      const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const reasonText = `Post approved: ${post.id}`;
      const pointsEntry = await db
        .insert(pointsLedger)
        .select(
          db
            .select({
              userId: sql<string>`${post.userId}`.as("userId"),
              siteId: sql<string>`${post.siteId}`.as("siteId"),
              postId: sql<string>`${post.id}`.as("postId"),
              amount: sql<number>`${pointsToAward}`.as("amount"),
              reasonCode: sql<string>`${"POST_APPROVED"}`.as("reasonCode"),
              reasonText: sql<string>`${reasonText}`.as("reasonText"),
              adminId: sql<string>`${reviewer.id}`.as("adminId"),
              settleMonth: sql<string>`${settleMonth}`.as("settleMonth"),
            })
            .from(posts)
            .where(
              and(
                eq(posts.id, post.id),
                sql`
                (
                  SELECT COALESCE(SUM(${pointsLedger.amount}), 0)
                  FROM ${pointsLedger}
                  WHERE ${pointsLedger.userId} = ${post.userId}
                    AND ${pointsLedger.siteId} = ${post.siteId}
                    AND ${pointsLedger.occurredAt} >= ${todayRange?.start ?? now}
                    AND ${pointsLedger.occurredAt} < ${todayRange?.end ?? now}
                ) + ${pointsToAward} <= 30
              `,
              ),
            )
            .limit(1),
        )
        .returning()
        .get();

      if (!pointsEntry) {
        await db.delete(reviews).where(eq(reviews.id, review.id)).run();
        return error(
          c,
          "DAILY_LIMIT_EXCEEDED",
          "Daily limit exceeded while awarding points",
          400,
        );
      }
    }

    if (body.action === "REJECT" && body.reasonCode === "FALSE") {
      const userRecord = await db
        .select({
          falseReportCount: users.falseReportCount,
          restrictedUntil: users.restrictedUntil,
        })
        .from(users)
        .where(eq(users.id, post.userId))
        .get();

      if (userRecord) {
        const nextCount = (userRecord.falseReportCount ?? 0) + 1;
        const now = new Date();
        let restrictedUntil = userRecord.restrictedUntil ?? null;

        if (nextCount >= 3 && (!restrictedUntil || restrictedUntil <= now)) {
          restrictedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        await db
          .update(users)
          .set({
            falseReportCount: nextCount,
            restrictedUntil,
            updatedAt: new Date(),
          })
          .where(eq(users.id, post.userId));
      }
    }

    await db.insert(auditLogs).values({
      action: "POST_REVIEWED",
      actorId: reviewer.id,
      targetType: "POST",
      targetId: postId,
      reason: `Action: ${body.action}, Points: ${pointsToAward}`,
    });

    return success(c, { review });
  },
);

interface ManualApprovalBody {
  userId: string;
  siteId: string;
  reason: string;
}

app.post(
  "/manual-approval",
  requireManagerOrAdmin,
  zValidator("json", AdminManualApprovalSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: approver } = c.get("auth");

    const body: z.infer<typeof AdminManualApprovalSchema> = c.req.valid("json");

    if (!body.userId || !body.siteId || !body.reason) {
      return error(
        c,
        "MISSING_REQUIRED_FIELDS",
        "userId, siteId, and reason are required",
        400,
      );
    }

    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, body.userId))
      .get();

    if (!targetUser) {
      return error(c, "USER_NOT_FOUND", "User not found", 404);
    }

    const now = new Date();
    const approval = await db
      .insert(manualApprovals)
      .values({
        userId: body.userId,
        siteId: body.siteId,
        approvedById: approver.id,
        reason: body.reason,
        validDate: now,
        status: "APPROVED",
        approvedAt: new Date(),
      })
      .returning()
      .get();

    await db.insert(auditLogs).values({
      action: "MANUAL_APPROVAL_CREATED",
      actorId: approver.id,
      targetType: "MANUAL_APPROVAL",
      targetId: approval.id,
      reason: `User: ${body.userId}, Site: ${body.siteId}`,
    });

    return success(c, { approval }, 201);
  },
);

export default app;
