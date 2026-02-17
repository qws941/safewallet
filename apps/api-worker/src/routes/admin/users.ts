import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import {
  users,
  auditLogs,
  userRoleEnum,
  posts,
  postImages,
  reviews,
  pointsLedger,
  siteMemberships,
} from "../../db/schema";
import { decrypt, hmac } from "../../lib/crypto";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import {
  AdminChangeRoleSchema,
  AdminEmergencyUserPurgeSchema,
} from "../../validators/schemas";
import { requireAdmin } from "./helpers";
import { createLogger } from "../../lib/logger";

const logger = createLogger("admin/users");

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/unlock-user/:phoneHash", requireAdmin, async (c) => {
  const phoneHash = c.req.param("phoneHash");
  if (!phoneHash) {
    return error(c, "PHONE_HASH_REQUIRED", "phoneHash is required", 400);
  }

  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const key = `login_attempts:${phoneHash}`;

  await c.env.KV.delete(key);

  await db.insert(auditLogs).values({
    action: "LOGIN_LOCKOUT_RESET",
    actorId: currentUser.id,
    targetType: "LOGIN_LOCKOUT",
    targetId: phoneHash,
    reason: "Admin unlock",
  });

  return success(c, { unlocked: true });
});

app.post("/unlock-user-by-phone", requireAdmin, async (c) => {
  const body = await c.req.json<{ phone: string }>();
  const phone = body?.phone;

  if (!phone) {
    return error(c, "PHONE_REQUIRED", "phone is required", 400);
  }

  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 10) {
    return error(c, "INVALID_PHONE", "Invalid phone number", 400);
  }

  const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const key = `login_attempts:${phoneHash}`;

  await c.env.KV.delete(key);

  await db.insert(auditLogs).values({
    action: "LOGIN_LOCKOUT_RESET",
    actorId: currentUser.id,
    targetType: "LOGIN_LOCKOUT",
    targetId: phoneHash,
    reason: "Admin unlock by phone",
  });

  if (c.env.RATE_LIMITER) {
    const rateLimiterId = c.env.RATE_LIMITER.idFromName(`login:${phoneHash}`);
    const rateLimiter = c.env.RATE_LIMITER.get(rateLimiterId);
    await rateLimiter.fetch(new Request("https://dummy/reset"));
  }

  return success(c, { unlocked: true, phone: normalizedPhone });
});

app.get("/users", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const currentUserRecord = await db
    .select({ piiViewFull: users.piiViewFull })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .get();
  const canViewFullPii = currentUserRecord?.piiViewFull ?? false;

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      phoneEncrypted: users.phoneEncrypted,
      dobEncrypted: users.dobEncrypted,
      role: users.role,
      falseReportCount: users.falseReportCount,
      restrictedUntil: users.restrictedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .get();

  const usersWithPii = canViewFullPii
    ? await Promise.all(
        allUsers.map(async (row) => ({
          id: row.id,
          name: row.name,
          nameMasked: row.nameMasked,
          phone: row.phoneEncrypted
            ? await decrypt(c.env.ENCRYPTION_KEY, row.phoneEncrypted)
            : null,
          dob: row.dobEncrypted
            ? await decrypt(c.env.ENCRYPTION_KEY, row.dobEncrypted)
            : null,
          role: row.role,
          falseReportCount: row.falseReportCount,
          restrictedUntil: row.restrictedUntil,
          createdAt: row.createdAt,
        })),
      )
    : allUsers.map((row) => ({
        id: row.id,
        name: row.name,
        nameMasked: row.nameMasked,
        phone: null,
        dob: null,
        role: row.role,
        falseReportCount: row.falseReportCount,
        restrictedUntil: row.restrictedUntil,
        createdAt: row.createdAt,
      }));

  if (canViewFullPii && allUsers.length > 0) {
    const userIdsViewed = allUsers.map((u) => u.id);
    await logAuditWithContext(
      c,
      db,
      "PII_VIEW",
      currentUser.id,
      "USER",
      "BULK",
      {
        field: "phone,dob",
        reason: "Admin user list with full PII",
        targetUserId: userIdsViewed.length === 1 ? userIdsViewed[0] : undefined,
        rowCount: userIdsViewed.length,
      },
    );
  }

  return success(c, {
    users: usersWithPii,
    total: totalResult?.count || 0,
  });
});

app.get("/users/restrictions", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const activeOnly = c.req.query("activeOnly") === "true";
  const now = new Date();

  const conditions = [];
  if (activeOnly) {
    conditions.push(gte(users.restrictedUntil, now));
  }

  const restrictedUsers = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      role: users.role,
      falseReportCount: users.falseReportCount,
      restrictedUntil: users.restrictedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.restrictedUntil))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return success(c, {
    users: restrictedUsers,
    total: totalResult?.count || 0,
  });
});

app.post("/users/:id/restriction/clear", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const userId = c.req.param("id");

  const updated = await db
    .update(users)
    .set({ falseReportCount: 0, restrictedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  await db.insert(auditLogs).values({
    action: "USER_RESTRICTION_CLEARED",
    actorId: currentUser.id,
    targetType: "USER",
    targetId: userId,
    reason: "False report restriction cleared",
  });

  return success(c, { user: updated });
});

app.patch(
  "/users/:id/role",
  requireAdmin,
  zValidator("json", AdminChangeRoleSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const userId = c.req.param("id");

    const body: z.infer<typeof AdminChangeRoleSchema> = c.req.valid("json");

    const validRoles: readonly string[] = userRoleEnum;
    if (!body.role || !validRoles.includes(body.role)) {
      return error(
        c,
        "INVALID_ROLE",
        `Invalid role. Must be one of: ${userRoleEnum.join(", ")}`,
        400,
      );
    }
    const role = body.role as (typeof userRoleEnum)[number];

    if (userId === currentUser.id) {
      return error(
        c,
        "CANNOT_CHANGE_OWN_ROLE",
        "Cannot change your own role",
        400,
      );
    }

    const existingUser = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!existingUser) {
      return error(c, "USER_NOT_FOUND", "User not found", 404);
    }

    const oldRole = existingUser.role;

    const updated = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()
      .get();

    if (!updated) {
      return error(c, "USER_NOT_FOUND", "User not found", 404);
    }

    await logAuditWithContext(
      c,
      db,
      "PERMISSION_CHANGE",
      currentUser.id,
      "PERMISSION",
      userId,
      {
        role,
        action: "ROLE_CHANGE",
        oldRole,
        newRole: role,
        targetUserId: userId,
      },
    );

    return success(c, { user: updated });
  },
);

// ─── Emergency PII Purge ─────────────────────────────────────────────────────
app.delete(
  "/users/:id/emergency-purge",
  zValidator("json", AdminEmergencyUserPurgeSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const userId = c.req.param("id");
    const body: z.infer<typeof AdminEmergencyUserPurgeSchema> =
      c.req.valid("json");

    if (currentUser.role !== "SUPER_ADMIN") {
      return error(
        c,
        "FORBIDDEN",
        "Only SUPER_ADMIN can perform emergency PII purge",
        403,
      );
    }

    if (body.confirmUserId !== userId) {
      return error(
        c,
        "CONFIRMATION_FAILED",
        "Confirmation user ID mismatch",
        400,
      );
    }

    const targetUser = await db
      .select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!targetUser) {
      return error(c, "USER_NOT_FOUND", "User not found", 404);
    }

    if (targetUser.deletedAt) {
      return error(c, "ALREADY_PURGED", "User PII already purged", 410);
    }

    const userPosts = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.userId, userId))
      .all();

    let purgedImages = 0;

    if (userPosts.length > 0) {
      const postIds = userPosts.map((p) => p.id);
      for (const postId of postIds) {
        const images = await db
          .select({ fileUrl: postImages.fileUrl })
          .from(postImages)
          .where(eq(postImages.postId, postId))
          .all();

        for (const image of images) {
          try {
            await c.env.R2.delete(image.fileUrl);
            purgedImages++;
          } catch (e) {
            logger.error("Failed to delete R2 image during user purge", {
              fileUrl: image.fileUrl,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        await db.delete(postImages).where(eq(postImages.postId, postId));
        await db.delete(reviews).where(eq(reviews.postId, postId));
        await db.delete(pointsLedger).where(eq(pointsLedger.postId, postId));
      }

      await db.delete(posts).where(eq(posts.userId, userId));
    }

    const deletedMemberships = await db
      .delete(siteMemberships)
      .where(eq(siteMemberships.userId, userId))
      .returning({ id: siteMemberships.id });

    const now = new Date();
    await db
      .update(users)
      .set({
        phone: "",
        phoneEncrypted: "",
        phoneHash: "",
        name: "[긴급삭제]",
        nameMasked: "[긴급삭제]",
        dob: null,
        dobEncrypted: "",
        dobHash: "",
        companyName: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        otpCode: null,
        otpExpiresAt: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    try {
      await c.env.KV.delete(`user:${userId}`);
      await c.env.KV.delete(`session:${userId}`);
    } catch {
      // non-blocking: KV cleanup is best-effort
    }

    await logAuditWithContext(
      c,
      db,
      "EMERGENCY_PII_PURGE",
      currentUser.id,
      "USER",
      userId,
      {
        reason: body.reason,
        purgedPosts: userPosts.length,
        purgedImages,
        purgedMemberships: deletedMemberships.length,
        previousName: targetUser.name,
      },
    );

    return success(c, {
      purged: true,
      purgedPosts: userPosts.length,
      purgedImages,
      purgedMemberships: deletedMemberships.length,
    });
  },
);

export default app;
