import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
import { success, error } from "../lib/response";
import { logAuditWithContext } from "../lib/audit";
import { CreatePostSchema } from "../validators/schemas";
import {
  posts,
  postImages,
  siteMemberships,
  users,
  reviews,
  auditLogs,
} from "../db/schema";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

type CategoryType =
  | "HAZARD"
  | "UNSAFE_BEHAVIOR"
  | "INCONVENIENCE"
  | "SUGGESTION"
  | "BEST_PRACTICE";

type VisibilityType = "WORKER_PUBLIC" | "ADMIN_ONLY";

const validCategories: CategoryType[] = [
  "HAZARD",
  "UNSAFE_BEHAVIOR",
  "INCONVENIENCE",
  "SUGGESTION",
  "BEST_PRACTICE",
];

const validateJson = zValidator as (
  target: "json",
  schema: unknown,
) => ReturnType<typeof zValidator>;

app.use("*", authMiddleware);

app.post("/", validateJson("json", CreatePostSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = c.req.valid("json" as never) as z.infer<typeof CreatePostSchema>;

  if (!data.siteId || !data.content) {
    return error(c, "MISSING_FIELDS", "siteId and content are required", 400);
  }

  await attendanceMiddleware(c, async () => {}, data.siteId);

  data.category = data.category || "HAZARD";
  data.visibility = data.visibility || "WORKER_PUBLIC";
  data.isAnonymous = data.isAnonymous ?? false;

  const userRecord = await db
    .select({ restrictedUntil: users.restrictedUntil })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (userRecord?.restrictedUntil && userRecord.restrictedUntil > new Date()) {
    return error(
      c,
      "USER_RESTRICTED",
      `Posting restricted until ${userRecord.restrictedUntil.toISOString()}`,
      403,
    );
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, data.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
  }

  const postId = crypto.randomUUID();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const canCheckDuplicate = Boolean(data.locationFloor && data.locationZone);
  const duplicateConditions = [
    sql`${posts.siteId} = ${data.siteId}`,
    sql`${posts.locationFloor} = ${data.locationFloor ?? ""}`,
    sql`${posts.locationZone} = ${data.locationZone ?? ""}`,
    sql`${posts.createdAt} >= ${cutoff}`,
  ];

  if (data.hazardType) {
    duplicateConditions.push(sql`${posts.hazardType} = ${data.hazardType}`);
  }

  const duplicateWhereSql = sql.join(duplicateConditions, sql` and `);
  const duplicateOfPostId = canCheckDuplicate
    ? sql`(
        select ${posts.id}
        from ${posts}
        where ${duplicateWhereSql}
        order by ${posts.createdAt} desc
        limit 1
      )`
    : null;
  const isPotentialDuplicate = canCheckDuplicate
    ? sql`exists(select 1 from ${posts} where ${duplicateWhereSql})`
    : false;

  const insertPostQuery = db.insert(posts).values({
    id: postId,
    userId: user.id,
    siteId: data.siteId,
    content: data.content,
    category: data.category,
    hazardType: data.hazardType,
    riskLevel: data.riskLevel,
    visibility: data.visibility,
    locationFloor: data.locationFloor,
    locationZone: data.locationZone,
    locationDetail: data.locationDetail,
    isAnonymous: data.isAnonymous,
    metadata: data.metadata,
    isPotentialDuplicate,
    duplicateOfPostId,
  });

  const imageInsertQueries = Array.isArray(data.imageUrls)
    ? data.imageUrls
        .filter((fileUrl: string) => Boolean(fileUrl))
        .map((fileUrl: string) =>
          db.insert(postImages).values({
            postId,
            fileUrl,
            thumbnailUrl: null,
          }),
        )
    : [];

  await db.batch([insertPostQuery, ...imageInsertQueries]);

  const newPost = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .get();

  if (!newPost) {
    return error(c, "POST_CREATION_FAILED", "Failed to create post", 500);
  }

  return success(c, { post: newPost }, 201);
});

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);

  const siteId = c.req.query("siteId");
  await attendanceMiddleware(c, async () => {}, siteId);
  const categoryParam = c.req.query("category") as CategoryType | undefined;
  const category =
    categoryParam && validCategories.includes(categoryParam)
      ? categoryParam
      : undefined;
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const query = db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.name,
        nameMasked: users.nameMasked,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  const conditions = [];
  if (siteId) {
    conditions.push(eq(posts.siteId, siteId));
  }
  if (category) {
    conditions.push(eq(posts.category, category));
  }

  const result =
    conditions.length > 0
      ? await query.where(and(...conditions)).all()
      : await query.all();

  const postsWithAuthor = result.map((row) => ({
    ...row.post,
    author: row.post.isAnonymous
      ? null
      : {
          id: row.author?.id,
          name: row.author?.nameMasked,
        },
  }));

  return success(c, { posts: postsWithAuthor });
});

app.get("/me", async (c) => {
  await attendanceMiddleware(c, async () => {});
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const myPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, user.id))
    .orderBy(desc(posts.createdAt))
    .all();

  return success(c, { posts: myPosts });
});

app.get("/:id", async (c) => {
  await attendanceMiddleware(c, async () => {});
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const postId = c.req.param("id");

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  const [author, images, postReviews] = await Promise.all([
    db.select().from(users).where(eq(users.id, post.userId)).get(),
    db
      .select()
      .from(postImages)
      .where(eq(postImages.postId, postId))
      .orderBy(desc(postImages.createdAt))
      .all(),
    db.select().from(reviews).where(eq(reviews.postId, postId)).all(),
  ]);

  if (images.length > 0) {
    await logAuditWithContext(
      c,
      db,
      "IMAGE_DOWNLOAD",
      user.id,
      "IMAGE",
      postId,
      {
        imageIds: images.map((img) => img.id),
        postId,
      },
    );
  }

  return success(c, {
    post: {
      ...post,
      author: post.isAnonymous
        ? null
        : {
            id: author?.id,
            name: author?.nameMasked,
          },
      images,
      reviews: postReviews,
    },
  });
});

app.post("/:id/images", async (c) => {
  await attendanceMiddleware(c, async () => {});
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const postId = c.req.param("id");

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  if (post.userId !== user.id) {
    return error(
      c,
      "UNAUTHORIZED",
      "Not authorized to add images to this post",
      403,
    );
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

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return error(c, "FILE_TOO_LARGE", "File too large (max 10MB)", 400);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const key = `posts/${postId}/${crypto.randomUUID()}.${ext}`;

  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const imageRecord = await db
    .insert(postImages)
    .values({
      postId,
      fileUrl: key,
    })
    .returning()
    .get();

  return success(c, { image: imageRecord }, 201);
});

app.delete("/:id", async (c) => {
  await attendanceMiddleware(c, async () => {});
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const postId = c.req.param("id");

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  if (post.userId !== user.id && user.role !== "ADMIN") {
    return error(c, "UNAUTHORIZED", "Not authorized to delete this post", 403);
  }

  const images = await db
    .select()
    .from(postImages)
    .where(eq(postImages.postId, postId))
    .all();

  for (const image of images) {
    await c.env.R2.delete(image.fileUrl);
  }

  await db.delete(posts).where(eq(posts.id, postId));

  return success(c, null);
});

export default app;
