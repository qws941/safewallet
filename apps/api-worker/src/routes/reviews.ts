import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { success, error } from "../lib/response";
import { logAuditWithContext } from "../lib/audit";
import { ReviewActionSchema } from "../validators/schemas";
import {
  reviews,
  posts,
  siteMemberships,
  users,
  pointsLedger,
  auditLogs,
} from "../db/schema";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

type ReviewAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_MORE"
  | "MARK_URGENT"
  | "ASSIGN"
  | "CLOSE";
type ReviewStatus =
  | "RECEIVED"
  | "IN_REVIEW"
  | "NEED_INFO"
  | "APPROVED"
  | "REJECTED";
type ActionStatus =
  | "NONE"
  | "REQUIRED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DONE"
  | "REOPENED";

const validActions: ReviewAction[] = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
];

const validateJson = zValidator as (
  target: "json",
  schema: unknown,
) => ReturnType<typeof zValidator>;

const DEFAULT_APPROVAL_POINTS = 100;

function determineNewStatuses(
  action: ReviewAction,
  currentActionStatus: ActionStatus,
): {
  newReviewStatus: ReviewStatus;
  newActionStatus?: ActionStatus;
} {
  switch (action) {
    case "APPROVE":
      return {
        newReviewStatus: "APPROVED",
        newActionStatus: currentActionStatus === "NONE" ? "DONE" : undefined,
      };
    case "REJECT":
      return { newReviewStatus: "REJECTED" };
    case "REQUEST_MORE":
      return { newReviewStatus: "NEED_INFO" };
    case "MARK_URGENT":
      return { newReviewStatus: "IN_REVIEW" };
    case "ASSIGN":
      return {
        newReviewStatus: "IN_REVIEW",
        newActionStatus: "ASSIGNED",
      };
    case "CLOSE":
      return {
        newReviewStatus: "APPROVED",
        newActionStatus: "DONE",
      };
    default:
      return { newReviewStatus: "IN_REVIEW" };
  }
}

app.use("*", authMiddleware);

app.post("/", validateJson("json", ReviewActionSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = c.req.valid("json" as never) as z.infer<
    typeof ReviewActionSchema
  >;

  if (!data.postId || !data.action) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "postId and action are required",
      400,
    );
  }

  if (!validActions.includes(data.action)) {
    return error(
      c,
      "INVALID_ACTION",
      `Invalid action. Must be one of: ${validActions.join(", ")}`,
      400,
    );
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, data.postId))
    .get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, post.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();

  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(
      c,
      "INSUFFICIENT_PERMISSIONS",
      "Site admin access required",
      403,
    );
  }

  const currentActionStatus = (post.actionStatus as ActionStatus) || "NONE";
  const { newReviewStatus, newActionStatus } = determineNewStatuses(
    data.action,
    currentActionStatus,
  );

  const review = await db
    .insert(reviews)
    .values({
      postId: data.postId,
      adminId: user.id,
      action: data.action,
      comment: data.comment ?? null,
    })
    .returning()
    .get();

  const postUpdateData: {
    reviewStatus: ReviewStatus;
    actionStatus?: ActionStatus;
    isUrgent?: boolean;
    updatedAt: Date;
  } = {
    reviewStatus: newReviewStatus,
    updatedAt: new Date(),
  };

  if (newActionStatus) {
    postUpdateData.actionStatus = newActionStatus;
  }

  if (data.action === "MARK_URGENT") {
    postUpdateData.isUrgent = true;
  }

  const updatedPost = await db
    .update(posts)
    .set(postUpdateData)
    .where(
      and(
        eq(posts.id, data.postId),
        eq(posts.reviewStatus, post.reviewStatus),
        eq(posts.actionStatus, post.actionStatus),
      ),
    )
    .returning()
    .get();

  if (!updatedPost) {
    return error(
      c,
      "POST_STATUS_CONFLICT",
      "Post already reviewed or status changed",
      409,
    );
  }

  const oldReviewStatus = post.reviewStatus;
  const oldActionStatus = post.actionStatus;

  await logAuditWithContext(
    c,
    db,
    "FORCED_STATUS_CHANGE",
    user.id,
    "REVIEW",
    data.postId,
    {
      postId: data.postId,
      oldStatus: oldReviewStatus,
      newStatus: newReviewStatus,
      oldActionStatus,
      newActionStatus: newActionStatus ?? oldActionStatus,
      reason: data.comment,
      action: data.action,
    },
  );

  let pointsAwarded = 0;
  if (data.action === "APPROVE") {
    const now = new Date();
    const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await db.insert(pointsLedger).values({
      userId: post.userId,
      siteId: post.siteId,
      amount: DEFAULT_APPROVAL_POINTS,
      reasonCode: "POST_APPROVED",
      postId: data.postId,
      settleMonth,
      adminId: user.id,
    });

    pointsAwarded = DEFAULT_APPROVAL_POINTS;
  }

  return success(
    c,
    { review, postStatus: newReviewStatus, pointsAwarded },
    201,
  );
});

app.get("/post/:postId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const postId = c.req.param("postId");

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, post.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
  }

  const reviewsList = await db
    .select({
      review: reviews,
      admin: { id: users.id, nameMasked: users.nameMasked },
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.adminId, users.id))
    .where(eq(reviews.postId, postId))
    .orderBy(desc(reviews.createdAt))
    .all();

  const formattedReviews = reviewsList.map((row) => ({
    ...row.review,
    admin: row.admin,
  }));

  return success(c, formattedReviews);
});

export default app;
