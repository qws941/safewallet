import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { users, siteMemberships, sites, pointsLedger } from "../db/schema";
import { success, error } from "../lib/response";
import { decrypt } from "../lib/crypto";

interface UpdateProfileBody {
  name?: string;
}

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

app.get("/me", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const fullUser = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      phoneEncrypted: users.phoneEncrypted,
      piiViewFull: users.piiViewFull,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (!fullUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  const phone =
    fullUser.piiViewFull && fullUser.phoneEncrypted
      ? await decrypt(c.env.ENCRYPTION_KEY, fullUser.phoneEncrypted)
      : null;

  const memberships = await db
    .select({
      id: siteMemberships.id,
      role: siteMemberships.role,
      status: siteMemberships.status,
      site: {
        id: sites.id,
        name: sites.name,
      },
    })
    .from(siteMemberships)
    .leftJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .all();

  const pointsResult = await db
    .select({
      total: sql<number>`SUM(${pointsLedger.amount})`,
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, user.id))
    .get();

  return success(c, {
    user: {
      id: fullUser.id,
      name: fullUser.name,
      nameMasked: fullUser.nameMasked,
      phone,
      role: fullUser.role,
      createdAt: fullUser.createdAt,
      memberships,
      totalPoints: pointsResult?.total || 0,
    },
  });
});

app.patch("/me", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  let data: UpdateProfileBody;
  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!data.name) {
    return error(c, "NO_FIELDS_TO_UPDATE", "No fields to update", 400);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.name) {
    updateData.name = data.name;
    updateData.nameMasked =
      data.name.length > 1
        ? data.name[0] + "*".repeat(data.name.length - 1)
        : data.name;
  }

  const updated = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      phoneEncrypted: users.phoneEncrypted,
      piiViewFull: users.piiViewFull,
      role: users.role,
    })
    .get();

  const updatedPhone =
    updated?.piiViewFull && updated.phoneEncrypted
      ? await decrypt(c.env.ENCRYPTION_KEY, updated.phoneEncrypted)
      : null;

  return success(c, {
    user: updated
      ? {
          id: updated.id,
          name: updated.name,
          nameMasked: updated.nameMasked,
          phone: updatedPhone,
          role: updated.role,
        }
      : null,
  });
});

app.get("/me/points", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const ledger = await db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, user.id))
    .orderBy(sql`${pointsLedger.createdAt} DESC`)
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({
      total: sql<number>`SUM(${pointsLedger.amount})`,
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, user.id))
    .get();

  return success(c, {
    points: ledger,
    total: totalResult?.total || 0,
  });
});

app.get("/me/memberships", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const memberships = await db
    .select({
      id: siteMemberships.id,
      role: siteMemberships.role,
      status: siteMemberships.status,
      joinedAt: siteMemberships.joinedAt,
      site: {
        id: sites.id,
        name: sites.name,
        active: sites.active,
      },
    })
    .from(siteMemberships)
    .leftJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(eq(siteMemberships.userId, user.id))
    .all();

  return success(c, { memberships });
});

export default app;
