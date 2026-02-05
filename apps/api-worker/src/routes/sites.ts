import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { sites, siteMemberships, users } from "../db/schema";
import { success, error } from "../lib/response";

interface CreateSiteBody {
  name: string;
}

interface UpdateSiteBody {
  name?: string;
  active?: boolean;
}

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  if (user.role === "ADMIN") {
    const allSites = await db.select().from(sites).all();
    return success(c, { sites: allSites });
  }

  const mySites = await db
    .select({
      id: sites.id,
      name: sites.name,
      active: sites.active,
      membershipRole: siteMemberships.role,
    })
    .from(siteMemberships)
    .innerJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .all();

  return success(c, { sites: mySites });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");

  const site = await db.select().from(sites).where(eq(sites.id, siteId)).get();

  if (!site) {
    return error(c, "SITE_NOT_FOUND", "Site not found", 404);
  }

  if (user.role !== "ADMIN") {
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
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }
  }

  const memberCount = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  return success(c, {
    site: {
      ...site,
      memberCount: memberCount?.count || 0,
    },
  });
});

app.get("/:id/members", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");

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

  if (!membership && user.role !== "ADMIN") {
    return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
  }

  if (membership?.role === "WORKER" && user.role !== "ADMIN") {
    return error(c, "NOT_AUTHORIZED", "Not authorized to view members", 403);
  }

  const members = await db
    .select({
      id: siteMemberships.id,
      role: siteMemberships.role,
      status: siteMemberships.status,
      joinedAt: siteMemberships.joinedAt,
      user: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(siteMemberships)
    .innerJoin(users, eq(siteMemberships.userId, users.id))
    .where(eq(siteMemberships.siteId, siteId))
    .all();

  return success(c, { members });
});

app.post("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  let data: CreateSiteBody;
  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!data.name) {
    return error(c, "MISSING_FIELD", "name is required", 400);
  }

  if (user.role !== "ADMIN") {
    return error(c, "ADMIN_ONLY", "Only admins can create sites", 403);
  }

  const newSite = await db
    .insert(sites)
    .values({
      name: data.name,
      joinCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      active: true,
    })
    .returning()
    .get();

  return success(c, { site: newSite }, 201);
});

app.patch("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");

  let data: UpdateSiteBody;
  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (user.role !== "ADMIN") {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.role, "SITE_ADMIN"),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.active !== undefined) updateData.active = data.active;

  const updated = await db
    .update(sites)
    .set(updateData)
    .where(eq(sites.id, siteId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "SITE_NOT_FOUND", "Site not found", 404);
  }

  return success(c, { site: updated });
});

export default app;
