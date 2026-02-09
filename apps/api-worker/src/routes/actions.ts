import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
import { success, error } from "../lib/response";
import {
  CreateActionSchema,
  UpdateActionStatusSchema,
} from "../validators/schemas";
import { actions, actionImages, posts, siteMemberships } from "../db/schema";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

const validateJson = zValidator as (
  target: "json",
  schema: unknown,
) => ReturnType<typeof zValidator>;

app.use("*", authMiddleware);
app.use("*", attendanceMiddleware);

app.post("/", validateJson("json", CreateActionSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = c.req.valid("json" as never) as z.infer<
    typeof CreateActionSchema
  >;

  if (!data.postId) {
    return error(c, "MISSING_POST_ID", "postId is required", 400);
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, data.postId))
    .get();

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

  if (!membership || membership.role === "WORKER") {
    return error(c, "UNAUTHORIZED", "Not authorized to create actions", 403);
  }

  const newAction = await db
    .insert(actions)
    .values({
      postId: data.postId,
      assigneeType: data.assigneeType || "UNASSIGNED",
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      actionStatus: "OPEN",
    })
    .returning()
    .get();

  return success(c, { action: newAction }, 201);
});

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const postId = c.req.query("postId");
  const status = c.req.query("status") as
    | "OPEN"
    | "IN_PROGRESS"
    | "DONE"
    | undefined;
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [];
  if (postId) {
    conditions.push(eq(actions.postId, postId));
  }
  if (status && ["OPEN", "IN_PROGRESS", "DONE"].includes(status)) {
    conditions.push(eq(actions.actionStatus, status));
  }

  const baseQuery = db
    .select({
      action: actions,
    })
    .from(actions)
    .orderBy(desc(actions.createdAt));

  const query =
    conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  const result = await query.limit(limit).offset(offset).all();
  const results = result.map((row) => row.action);

  return success(c, {
    data: results,
    pagination: {
      limit,
      offset,
      count: results.length,
    },
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const actionId = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const action = await db
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();

  if (!action) {
    return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
  }

  const images = await db
    .select()
    .from(actionImages)
    .where(eq(actionImages.actionId, actionId))
    .orderBy(desc(actionImages.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: { ...action, images },
    pagination: {
      limit,
      offset,
      count: images.length,
    },
  });
});

app.patch("/:id", validateJson("json", UpdateActionStatusSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const actionId = c.req.param("id");

  const data = c.req.valid("json" as never) as z.infer<
    typeof UpdateActionStatusSchema
  >;

  const action = await db
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();

  if (!action) {
    return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, action.postId))
    .get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Associated post not found", 404);
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

  const isAssignee = action.assigneeId === user.id;
  const isManager = membership && membership.role !== "WORKER";

  if (!isAssignee && !isManager) {
    return error(
      c,
      "UNAUTHORIZED",
      "Not authorized to update this action",
      403,
    );
  }

  const updateData: Record<string, unknown> = {};
  let requestedActionStatus: "OPEN" | "IN_PROGRESS" | "DONE" | undefined;

  if (
    data.actionStatus &&
    ["OPEN", "IN_PROGRESS", "DONE"].includes(data.actionStatus)
  ) {
    requestedActionStatus = data.actionStatus as
      | "OPEN"
      | "IN_PROGRESS"
      | "DONE";
    updateData.actionStatus = requestedActionStatus;
    if (requestedActionStatus === "DONE") {
      updateData.completedAt = new Date();
    }
  }
  if (data.completionNote !== undefined)
    updateData.completionNote = data.completionNote;

  const updateConditions = [eq(actions.id, actionId)];
  if (requestedActionStatus && requestedActionStatus !== action.actionStatus) {
    updateConditions.push(eq(actions.actionStatus, action.actionStatus));
  }

  const updated = await db
    .update(actions)
    .set(updateData)
    .where(and(...updateConditions))
    .returning()
    .get();

  if (!updated && requestedActionStatus) {
    return error(
      c,
      "ACTION_STATUS_CONFLICT",
      "Action status changed by another request",
      409,
    );
  }

  return success(c, { action: updated });
});

app.post("/:id/images", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const actionId = c.req.param("id");

  const action = await db
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();

  if (!action) {
    return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, action.postId))
    .get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Associated post not found", 404);
  }

  const isAssignee = action.assigneeId === user.id;

  if (!isAssignee) {
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

    if (!membership || membership.role === "WORKER") {
      return error(c, "UNAUTHORIZED", "Not authorized", 403);
    }
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return error(c, "NO_FILE", "No file provided", 400);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return error(c, "INVALID_FILE_TYPE", "Invalid file type", 400);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const key = `actions/${actionId}/${crypto.randomUUID()}.${ext}`;

  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const imageRecord = await db
    .insert(actionImages)
    .values({
      actionId,
      fileUrl: key,
    })
    .returning()
    .get();

  return success(c, { image: imageRecord }, 201);
});

app.delete("/:id/images/:imageId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const actionId = c.req.param("id");
  const imageId = c.req.param("imageId");

  const action = await db
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();

  if (!action) {
    return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, action.postId))
    .get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Associated post not found", 404);
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

  if (!membership || membership.role === "WORKER") {
    return error(c, "UNAUTHORIZED", "Not authorized", 403);
  }

  const image = await db
    .select()
    .from(actionImages)
    .where(
      and(eq(actionImages.id, imageId), eq(actionImages.actionId, actionId)),
    )
    .get();

  if (!image) {
    return error(c, "IMAGE_NOT_FOUND", "Image not found", 404);
  }

  await c.env.R2.delete(image.fileUrl);
  await db.delete(actionImages).where(eq(actionImages.id, imageId));

  return success(c, null);
});

export default app;
