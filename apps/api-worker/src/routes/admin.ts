import { Hono, type Context, type Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, desc, gte, lt } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  users,
  sites,
  siteMemberships,
  posts,
  manualApprovals,
  auditLogs,
  attendance,
  reviews,
  pointsLedger,
  userRoleEnum,
} from "../db/schema";
import { hmac } from "../lib/crypto";
import { success, error } from "../lib/response";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

const requireAdmin = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
  }
  await next();
};

const requireManagerOrAdmin = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId") || c.req.param("siteId");

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    await next();
    return;
  }

  if (!siteId) {
    return error(c, "SITE_ID_REQUIRED", "Site ID required", 400);
  }

  const db = drizzle(c.env.DB);
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

  if (!membership || membership.role === "WORKER") {
    return error(c, "MANAGER_ACCESS_REQUIRED", "Manager access required", 403);
  }

  await next();
};

app.get("/users", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      phone: users.phone,
      role: users.role,
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

  return success(c, {
    users: allUsers,
    total: totalResult?.count || 0,
  });
});

app.patch("/users/:id/role", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const userId = c.req.param("id");

  let body: { role?: string };
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

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

  const updated = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  await db.insert(auditLogs).values({
    action: "USER_ROLE_CHANGED",
    actorId: currentUser.id,
    targetType: "USER",
    targetId: userId,
    reason: `Role changed to ${role}`,
  });

  return success(c, { user: updated });
});

interface FasWorkerInput {
  externalWorkerId: string;
  name: string;
  phone: string;
  dob: string;
}

interface SyncFasWorkersBody {
  siteId: string;
  workers: FasWorkerInput[];
}

app.post("/fas/sync-workers", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");

  let body: SyncFasWorkersBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.siteId || !Array.isArray(body.workers)) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "siteId and workers array required",
      400,
    );
  }

  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.id, body.siteId))
    .get();

  if (!site) {
    return error(c, "SITE_NOT_FOUND", "Site not found", 404);
  }

  const results = {
    created: 0,
    updated: 0,
    membershipCreated: 0,
  };

  for (const worker of body.workers) {
    if (
      !worker.externalWorkerId ||
      !worker.name ||
      !worker.phone ||
      !worker.dob
    ) {
      continue;
    }

    const phoneHash = await hmac(worker.phone, c.env.HMAC_SECRET);
    const dobHash = await hmac(worker.dob, c.env.HMAC_SECRET);

    let existingUser = await db
      .select()
      .from(users)
      .where(eq(users.externalWorkerId, worker.externalWorkerId))
      .get();

    if (!existingUser) {
      existingUser = await db
        .select()
        .from(users)
        .where(eq(users.phoneHash, phoneHash))
        .get();
    }

    if (existingUser) {
      await db
        .update(users)
        .set({
          externalWorkerId: worker.externalWorkerId,
          name: worker.name,
          nameMasked:
            worker.name.length > 1
              ? worker.name[0] + "*".repeat(worker.name.length - 1)
              : worker.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
      results.updated++;
    } else {
      const newUser = await db
        .insert(users)
        .values({
          externalWorkerId: worker.externalWorkerId,
          externalSystem: "FAS",
          phone: worker.phone,
          phoneHash,
          dob: worker.dob,
          dobHash,
          name: worker.name,
          nameMasked:
            worker.name.length > 1
              ? worker.name[0] + "*".repeat(worker.name.length - 1)
              : worker.name,
          role: "WORKER",
        })
        .returning()
        .get();
      existingUser = newUser;
      results.created++;
    }

    const existingMembership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, existingUser.id),
          eq(siteMemberships.siteId, body.siteId),
        ),
      )
      .get();

    if (!existingMembership) {
      await db.insert(siteMemberships).values({
        userId: existingUser.id,
        siteId: body.siteId,
        role: "WORKER",
        status: "ACTIVE",
      });
      results.membershipCreated++;
    }
  }

  await db.insert(auditLogs).values({
    action: "FAS_WORKERS_SYNCED",
    actorId: currentUser.id,
    targetType: "SITE",
    targetId: body.siteId,
    reason: `Synced ${results.created} created, ${results.updated} updated, ${results.membershipCreated} memberships`,
  });

  return success(c, { results });
});

app.get("/posts/pending-review", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [];
  if (siteId) {
    conditions.push(eq(posts.siteId, siteId));
  }

  const pendingPosts = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    posts: pendingPosts.map((row) => ({
      ...row.post,
      author: row.author,
    })),
  });
});

interface ReviewPostBody {
  action: "APPROVE" | "REJECT" | "REQUEST_MORE";
  comment?: string;
  pointsToAward?: number;
}

app.post("/posts/:id/review", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: reviewer } = c.get("auth");
  const postId = c.req.param("id");

  let body: ReviewPostBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  const validActions = ["APPROVE", "REJECT", "REQUEST_MORE"];
  if (!body.action || !validActions.includes(body.action)) {
    return error(c, "INVALID_ACTION", "Invalid action", 400);
  }

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  const review = await db
    .insert(reviews)
    .values({
      postId,
      adminId: reviewer.id,
      action: body.action,
      comment: body.comment,
    })
    .returning()
    .get();

  if (
    body.action === "APPROVE" &&
    body.pointsToAward &&
    body.pointsToAward > 0
  ) {
    const now = new Date();
    const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await db.insert(pointsLedger).values({
      userId: post.userId,
      siteId: post.siteId,
      postId: post.id,
      amount: body.pointsToAward,
      reasonCode: "POST_APPROVED",
      reasonText: `Post approved: ${post.id}`,
      adminId: reviewer.id,
      settleMonth,
    });
  }

  await db.insert(auditLogs).values({
    action: "POST_REVIEWED",
    actorId: reviewer.id,
    targetType: "POST",
    targetId: postId,
    reason: `Action: ${body.action}, Points: ${body.pointsToAward || 0}`,
  });

  return success(c, { review });
});

interface ManualApprovalBody {
  userId: string;
  siteId: string;
  reason: string;
}

app.post("/manual-approval", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: approver } = c.get("auth");

  let body: ManualApprovalBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.userId || !body.siteId || !body.reason) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "userId, siteId, and reason are required",
      400,
    );
  }

  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.id, body.userId))
    .get();

  if (!targetUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  const now = new Date();
  const approval = await db
    .insert(manualApprovals)
    .values({
      userId: body.userId,
      siteId: body.siteId,
      approvedById: approver.id,
      reason: body.reason,
      validDate: now,
    })
    .returning()
    .get();

  await db.insert(auditLogs).values({
    action: "MANUAL_APPROVAL_CREATED",
    actorId: approver.id,
    targetType: "MANUAL_APPROVAL",
    targetId: approval.id,
    reason: `User: ${body.userId}, Site: ${body.siteId}`,
  });

  return success(c, { approval }, 201);
});

app.get("/audit-logs", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const action = c.req.query("action");

  const conditions = [];
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  const logs = await db
    .select({
      log: auditLogs,
      performer: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    logs: logs.map((row) => ({
      ...row.log,
      performer: row.performer,
    })),
  });
});

app.get("/stats", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [userCount, siteCount, postCount, activeAttendanceCount] =
    await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .get(),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(sites)
        .get(),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(posts)
        .get(),
      db
        .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
        .from(attendance)
        .where(
          and(
            gte(attendance.checkinAt, today),
            lt(attendance.checkinAt, tomorrow),
          ),
        )
        .get(),
    ]);

  return success(c, {
    stats: {
      totalUsers: userCount?.count || 0,
      totalSites: siteCount?.count || 0,
      totalPosts: postCount?.count || 0,
      activeUsersToday: activeAttendanceCount?.count || 0,
    },
  });
});

export default app;
