import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  users,
  siteMemberships,
  sites,
  pointsLedger,
  posts,
  reviews,
  actions,
} from "../db/schema";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import { decrypt } from "../lib/crypto";
import { invalidateCachedUser } from "../lib/session-cache";
import { UpdateProfileSchema } from "../validators/schemas";

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
      companyName: users.companyName,
      tradeType: users.tradeType,
      externalWorkerId: users.externalWorkerId,
      externalSystem: users.externalSystem,
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
      companyName: fullUser.companyName,
      tradeType: fullUser.tradeType,
      externalWorkerId: fullUser.externalWorkerId,
      externalSystem: fullUser.externalSystem,
    },
  });
});

app.patch("/me", zValidator("json", UpdateProfileSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = (() => {
    try {
      return c.req.valid("json");
    } catch {
      return null;
    }
  })();
  if (!data) {
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

  if (updated) {
    if (c.env.KV) {
      await invalidateCachedUser(c.env.KV, user.id);
    }

    try {
      await logAuditWithContext(
        c,
        db,
        "USER_PROFILE_UPDATED",
        user.id,
        "USER",
        user.id,
        {
          updatedFields: ["nameMasked"],
        },
      );
    } catch {
      // Do not block successful profile update on audit failure.
    }
  }

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

// ─── Privacy: Deletion Request ───────────────────────────────
app.post("/me/deletion-request", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const existing = await db
    .select({ deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (existing?.deletionRequestedAt) {
    return error(
      c,
      "DELETION_ALREADY_REQUESTED",
      "삭제 요청이 이미 접수되었습니다",
      409,
    );
  }

  const now = new Date();
  await db
    .update(users)
    .set({ deletionRequestedAt: now })
    .where(eq(users.id, user.id));

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_DELETION_REQUEST",
      user.id,
      "USER",
      user.id,
      {},
    );
  } catch {
    // audit failure should not block
  }

  return success(c, {
    message: "삭제 요청이 접수되었습니다. 30일 후 데이터가 영구 삭제됩니다.",
    deletionRequestedAt: now.toISOString(),
  });
});

app.delete("/me/deletion-request", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const existing = await db
    .select({
      deletionRequestedAt: users.deletionRequestedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (!existing?.deletionRequestedAt) {
    return error(c, "NO_DELETION_REQUEST", "삭제 요청이 없습니다", 404);
  }

  if (existing.deletedAt) {
    return error(c, "ALREADY_DELETED", "이미 삭제된 계정입니다", 410);
  }

  await db
    .update(users)
    .set({ deletionRequestedAt: null })
    .where(eq(users.id, user.id));

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_DELETION_CANCEL",
      user.id,
      "USER",
      user.id,
      {},
    );
  } catch {
    // audit failure should not block
  }

  return success(c, { message: "삭제 요청이 취소되었습니다." });
});

// ─── Privacy: Data Export ─────────────────────────────────────
app.get("/me/data-export", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const [profile, userPosts, userPoints, userMemberships] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .get(),
    db
      .select({
        id: posts.id,
        category: posts.category,
        content: posts.content,
        reviewStatus: posts.reviewStatus,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.userId, user.id))
      .all(),
    db
      .select({
        id: pointsLedger.id,
        amount: pointsLedger.amount,
        reasonCode: pointsLedger.reasonCode,
        reasonText: pointsLedger.reasonText,
        createdAt: pointsLedger.createdAt,
      })
      .from(pointsLedger)
      .where(eq(pointsLedger.userId, user.id))
      .all(),
    db
      .select({
        siteId: siteMemberships.siteId,
        role: siteMemberships.role,
        status: siteMemberships.status,
        joinedAt: siteMemberships.joinedAt,
      })
      .from(siteMemberships)
      .where(eq(siteMemberships.userId, user.id))
      .all(),
  ]);

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_DATA_EXPORT",
      user.id,
      "USER",
      user.id,
      { exportedTables: ["users", "posts", "pointsLedger", "siteMemberships"] },
    );
  } catch {
    // audit failure should not block
  }

  return success(c, {
    exportedAt: new Date().toISOString(),
    profile,
    posts: userPosts,
    points: userPoints,
    memberships: userMemberships,
  });
});

export default app;
