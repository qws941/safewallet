import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { sites, siteMemberships, users, auditLogs } from "../db/schema";
import { success, error } from "../lib/response";
import { CreateSiteSchema, UpdateSiteSchema } from "../validators/schemas";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  if (user.role === "ADMIN") {
    const allSites = await db
      .select()
      .from(sites)
      .limit(limit)
      .offset(offset)
      .all();
    return success(c, {
      data: allSites,
      pagination: { limit, offset, count: allSites.length },
    });
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
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: mySites,
    pagination: { limit, offset, count: mySites.length },
  });
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
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

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
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: members,
    pagination: { limit, offset, count: members.length },
  });
});

app.post("/join", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const { joinCode } = await c.req.json<{ joinCode: string }>();

  if (!joinCode || typeof joinCode !== "string") {
    return error(c, "INVALID_JOIN_CODE", "참여 코드를 입력해주세요", 400);
  }

  const code = joinCode.trim().toUpperCase();

  const site = await db
    .select()
    .from(sites)
    .where(and(eq(sites.joinCode, code), eq(sites.active, true)))
    .get();

  if (!site) {
    return error(c, "SITE_NOT_FOUND", "유효하지 않은 참여 코드입니다", 404);
  }

  const existing = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, site.id),
      ),
    )
    .get();

  if (existing) {
    if (existing.status === "ACTIVE") {
      return error(
        c,
        "ALREADY_MEMBER",
        "이미 해당 현장에 소속되어 있습니다",
        409,
      );
    }

    await db
      .update(siteMemberships)
      .set({ status: "ACTIVE", leftAt: null, leftReason: null })
      .where(eq(siteMemberships.id, existing.id))
      .run();

    return success(c, { siteId: site.id, siteName: site.name });
  }

  await db.insert(siteMemberships).values({
    id: crypto.randomUUID(),
    userId: user.id,
    siteId: site.id,
    role: "WORKER",
    status: "ACTIVE",
  });

  return success(c, { siteId: site.id, siteName: site.name });
});

app.post("/", zValidator("json", CreateSiteSchema as never), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const data: z.infer<typeof CreateSiteSchema> = c.req.valid("json");

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

app.patch("/:id", zValidator("json", UpdateSiteSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");
  const data = c.req.valid("json");

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
  if (data.leaderboardEnabled !== undefined)
    updateData.leaderboardEnabled = data.leaderboardEnabled;

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

app.post(
  "/:id/leave",
  zValidator("json", z.object({ reason: z.string().max(500).optional() })),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const siteId = c.req.param("id");
    const { reason } = c.req.valid("json");

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
      return error(c, "NOT_MEMBER", "이 현장의 활성 멤버가 아닙니다", 404);
    }

    // Site admins cannot leave — must be demoted first
    if (membership.role === "SITE_ADMIN") {
      return error(
        c,
        "ADMIN_CANNOT_LEAVE",
        "현장 관리자는 탈퇴할 수 없습니다. 먼저 권한을 변경해주세요.",
        403,
      );
    }

    await db
      .update(siteMemberships)
      .set({
        status: "LEFT",
        leftAt: new Date(),
        leftReason: reason || null,
      })
      .where(eq(siteMemberships.id, membership.id))
      .run();

    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "LEAVE_SITE",
      targetType: "SITE_MEMBERSHIP",
      targetId: membership.id,
      reason: reason || "자발적 탈퇴",
      ip:
        c.req.header("CF-Connecting-IP") ||
        c.req.header("X-Forwarded-For") ||
        "unknown",
      userAgent: c.req.header("User-Agent"),
    });

    return success(c, { message: "현장에서 탈퇴했습니다" });
  },
);

export default app;
