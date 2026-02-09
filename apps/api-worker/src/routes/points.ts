import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  pointsLedger,
  pointPolicies,
  siteMemberships,
  users,
} from "../db/schema";
import { success, error } from "../lib/response";
import { logAuditWithContext } from "../lib/audit";
import { AwardPointsSchema } from "../validators/schemas";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

interface AwardPointsBody {
  userId: string;
  siteId: string;
  amount: number;
  reason?: string;
}

interface QueryPointsParams {
  siteId?: string;
  userId?: string;
  limit?: string;
  offset?: string;
}

app.use("*", authMiddleware);

app.post("/award", zValidator("json", AwardPointsSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = c.req.valid("json") as AwardPointsBody;

  if (!data.userId || !data.siteId) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "userId, siteId, and amount are required",
      400,
    );
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, data.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();

  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "Site admin access required", 403);
  }

  const targetMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, data.userId),
        eq(siteMemberships.siteId, data.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!targetMembership) {
    return error(
      c,
      "USER_NOT_SITE_MEMBER",
      "Target user is not a member of this site",
      400,
    );
  }

  const manualAwardPolicy = await db
    .select({ defaultAmount: pointPolicies.defaultAmount })
    .from(pointPolicies)
    .where(
      and(
        eq(pointPolicies.siteId, data.siteId),
        eq(pointPolicies.reasonCode, "MANUAL_AWARD"),
        eq(pointPolicies.isActive, true),
      ),
    )
    .get();

  const resolvedAmount = manualAwardPolicy?.defaultAmount ?? data.amount;

  if (typeof resolvedAmount !== "number") {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "userId, siteId, and amount are required",
      400,
    );
  }

  const now = new Date();
  const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const entry = await db
    .insert(pointsLedger)
    .values({
      userId: data.userId,
      siteId: data.siteId,
      amount: resolvedAmount,
      reasonCode: "MANUAL_AWARD",
      reasonText: data.reason ?? null,
      settleMonth,
      adminId: user.id,
    })
    .returning()
    .get();

  await logAuditWithContext(c, db, "POINT_AWARD", user.id, "POINT", entry.id, {
    userId: data.userId,
    amount: resolvedAmount,
    reason: data.reason,
    reasonCode: "MANUAL_AWARD",
  });

  const targetUser = await db
    .select({ id: users.id, nameMasked: users.nameMasked })
    .from(users)
    .where(eq(users.id, data.userId))
    .get();

  return success(c, { ...entry, user: targetUser }, 201);
});

app.get("/balance", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const siteId = c.req.query("siteId");
  if (!siteId) {
    return error(
      c,
      "MISSING_SITE_ID",
      "siteId query parameter is required",
      400,
    );
  }

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

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
    })
    .from(pointsLedger)
    .where(
      and(eq(pointsLedger.userId, user.id), eq(pointsLedger.siteId, siteId)),
    )
    .get();

  return success(c, { userId: user.id, siteId, balance: result?.total ?? 0 });
});

app.get("/history", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const query: QueryPointsParams = {
    siteId: c.req.query("siteId"),
    userId: c.req.query("userId"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  };

  const limit = Math.min(parseInt(query.limit || "20"), 100);
  const offset = parseInt(query.offset || "0");

  if (query.siteId) {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, query.siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }
  }

  const targetUserId = query.userId || user.id;
  const conditions = [eq(pointsLedger.userId, targetUserId)];

  if (query.siteId) {
    conditions.push(eq(pointsLedger.siteId, query.siteId));
  }

  const entries = await db
    .select()
    .from(pointsLedger)
    .where(and(...conditions))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pointsLedger)
    .where(and(...conditions))
    .get();

  return success(c, { entries, total: countResult?.count ?? 0, limit, offset });
});

app.get("/leaderboard/:siteId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("siteId");
  const limitParam = c.req.query("limit");
  const limit = Math.min(parseInt(limitParam || "10"), 50);

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

  const results = await db
    .select({
      userId: pointsLedger.userId,
      total: sql<number>`SUM(${pointsLedger.amount})`.as("total"),
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.siteId, siteId))
    .groupBy(pointsLedger.userId)
    .orderBy(desc(sql`total`))
    .limit(limit)
    .all();

  const userIds = results.map((r) => r.userId);
  const usersData =
    userIds.length > 0
      ? await db
          .select({ id: users.id, nameMasked: users.nameMasked })
          .from(users)
          .where(sql`${users.id} IN ${userIds}`)
          .all()
      : [];

  const userMap = new Map(usersData.map((u) => [u.id, u]));

  const leaderboard = results.map((r, index) => {
    const userData = userMap.get(r.userId);
    return {
      rank: index + 1,
      userId: r.userId,
      nameMasked: userData?.nameMasked ?? null,
      balance: r.total ?? 0,
    };
  });

  return success(c, leaderboard);
});

export default app;
