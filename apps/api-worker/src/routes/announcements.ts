import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
import { announcements, siteMemberships, users } from "../db/schema";
import { success, error } from "../lib/response";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");

  await attendanceMiddleware(c, async () => {}, siteId);

  if (siteId) {
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

    if (!membership && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }
  }

  const conditions: ReturnType<typeof eq>[] = [];

  if (siteId) {
    conditions.push(
      or(eq(announcements.siteId, siteId), isNull(announcements.siteId))!,
    );
  }

  const result = await db
    .select({
      announcement: announcements,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .all();

  return success(c, {
    announcements: result.map((row) => ({
      ...row.announcement,
      author: row.author,
    })),
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const announcementId = c.req.param("id");

  const result = await db
    .select({
      announcement: announcements,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.id, announcementId))
    .get();

  if (!result) {
    return error(c, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found", 404);
  }

  return success(c, {
    announcement: {
      ...result.announcement,
      author: result.author,
    },
  });
});

interface CreateAnnouncementBody {
  siteId?: string | null;
  title: string;
  content: string;
  isPinned?: boolean;
}

app.post("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  let body: CreateAnnouncementBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.title || !body.content) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "title and content are required",
      400,
    );
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    if (!body.siteId) {
      return error(
        c,
        "ADMIN_ONLY",
        "Only admins can create global announcements",
        403,
      );
    }

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, body.siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership || membership.role === "WORKER") {
      return error(
        c,
        "NOT_AUTHORIZED",
        "Not authorized to create announcements",
        403,
      );
    }
  }

  const newAnnouncement = await db
    .insert(announcements)
    .values({
      siteId: body.siteId || "",
      authorId: user.id,
      title: body.title,
      content: body.content,
      isPinned: body.isPinned ?? false,
    })
    .returning()
    .get();

  return success(c, { announcement: newAnnouncement }, 201);
});

interface UpdateAnnouncementBody {
  title?: string;
  content?: string;
  isPinned?: boolean;
}

app.patch("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const announcementId = c.req.param("id");

  let body: UpdateAnnouncementBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  const announcement = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .get();

  if (!announcement) {
    return error(c, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found", 404);
  }

  if (
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    announcement.authorId !== user.id
  ) {
    return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.content !== undefined) updateData.content = body.content;
  if (body.isPinned !== undefined) updateData.isPinned = body.isPinned;

  const updated = await db
    .update(announcements)
    .set(updateData)
    .where(eq(announcements.id, announcementId))
    .returning()
    .get();

  return success(c, { announcement: updated });
});

app.delete("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const announcementId = c.req.param("id");

  const announcement = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .get();

  if (!announcement) {
    return error(c, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found", 404);
  }

  if (
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    announcement.authorId !== user.id
  ) {
    return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
  }

  await db.delete(announcements).where(eq(announcements.id, announcementId));

  return success(c, null);
});

export default app;
