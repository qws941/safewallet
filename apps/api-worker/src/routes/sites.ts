import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  sites,
  siteMemberships,
  users,
  joinCodeHistory,
  auditLogs,
} from "../db/schema";
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

app.post("/join", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  let data: { code: string };
  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "잘못된 요청입니다", 400);
  }

  if (!data.code) {
    return error(c, "MISSING_FIELD", "참여 코드를 입력해주세요", 400);
  }

  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.joinCode, data.code.toUpperCase()))
    .get();

  if (!site) {
    return error(c, "INVALID_CODE", "유효하지 않은 참여 코드입니다", 404);
  }

  if (!site.active) {
    return error(c, "SITE_INACTIVE", "비활성화된 현장입니다", 400);
  }

  const existingMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, site.id),
      ),
    )
    .get();

  if (existingMembership) {
    if (existingMembership.status === "ACTIVE") {
      return error(c, "ALREADY_MEMBER", "이미 이 현장의 멤버입니다", 409);
    }
    await db
      .update(siteMemberships)
      .set({ status: "ACTIVE" })
      .where(eq(siteMemberships.id, existingMembership.id))
      .run();

    return success(c, {
      site,
      membership: { ...existingMembership, status: "ACTIVE" },
    });
  }

  const newMembership = await db
    .insert(siteMemberships)
    .values({
      userId: user.id,
      siteId: site.id,
      role: "WORKER",
      status: "ACTIVE",
    })
    .returning()
    .get();

  return success(c, { site, membership: newMembership }, 201);
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

app.post("/:id/reissue-join-code", async (c) => {
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
          eq(siteMemberships.role, "SITE_ADMIN"),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(
        c,
        "NOT_AUTHORIZED",
        "Only site admins can reissue join codes",
        403,
      );
    }
  }

  const oldCode = site.joinCode;
  const newCode = crypto.randomUUID().substring(0, 8).toUpperCase();

  await db.insert(joinCodeHistory).values({
    siteId,
    joinCode: oldCode,
    isActive: false,
    createdById: user.id,
    invalidatedAt: new Date(),
  });

  const updated = await db
    .update(sites)
    .set({ joinCode: newCode })
    .where(eq(sites.id, siteId))
    .returning()
    .get();

  await db.insert(auditLogs).values({
    actorId: user.id,
    action: "REISSUE_JOIN_CODE",
    targetType: "SITE",
    targetId: siteId,
    reason: JSON.stringify({ oldCode, newCode }),
    ip:
      c.req.header("CF-Connecting-IP") ||
      c.req.header("X-Forwarded-For") ||
      "unknown",
    userAgent: c.req.header("User-Agent"),
  });

  return success(c, { site: updated, previousCode: oldCode });
});

app.get("/:id/join-code-history", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");

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
      return error(
        c,
        "NOT_AUTHORIZED",
        "Only site admins can view join code history",
        403,
      );
    }
  }

  const history = await db
    .select()
    .from(joinCodeHistory)
    .where(eq(joinCodeHistory.siteId, siteId))
    .all();

  return success(c, { history });
});

export default app;
