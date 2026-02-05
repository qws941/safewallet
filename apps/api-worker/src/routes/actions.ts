import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
import { success, error } from "../lib/response";
import {
  actions,
  actionImages,
  posts,
  siteMemberships,
  users,
} from "../db/schema";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);
app.use("*", attendanceMiddleware);

app.post("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  let data: {
    postId: string;
    assigneeType?: string;
    assigneeId?: string;
    dueDate?: string;
  };

  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON body", 400);
  }

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

  const conditions = [];
  if (postId) {
    conditions.push(eq(actions.postId, postId));
  }
  if (status && ["OPEN", "IN_PROGRESS", "DONE"].includes(status)) {
    conditions.push(eq(actions.actionStatus, status));
  }

  const query = db
    .select({
      action: actions,
    })
    .from(actions)
    .orderBy(desc(actions.createdAt));

  const result =
    conditions.length > 0
      ? await query.where(and(...conditions)).all()
      : await query.all();

  return success(c, {
    actions: result.map((row) => row.action),
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const actionId = c.req.param("id");

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
    .all();

  return success(c, { action: { ...action, images } });
});

app.patch("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const actionId = c.req.param("id");

  let data: {
    actionStatus?: string;
    assigneeId?: string;
    dueDate?: string;
    completionNote?: string;
  };

  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON body", 400);
  }

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

  if (
    data.actionStatus &&
    ["OPEN", "IN_PROGRESS", "DONE"].includes(data.actionStatus)
  ) {
    updateData.actionStatus = data.actionStatus;
    if (data.actionStatus === "DONE") {
      updateData.completedAt = new Date();
    }
  }
  if (data.completionNote !== undefined)
    updateData.completionNote = data.completionNote;
  if (data.assigneeId !== undefined)
    updateData.assigneeId = data.assigneeId || null;
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  const updated = await db
    .update(actions)
    .set(updateData)
    .where(eq(actions.id, actionId))
    .returning()
    .get();

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
