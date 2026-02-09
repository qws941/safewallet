import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import {
  disputes,
  users,
  sites,
  siteMemberships,
  disputeStatusEnum,
  disputeTypeEnum,
} from "../db/schema";
import {
  CreateDisputeSchema,
  ResolveDisputeSchema,
  UpdateDisputeStatusSchema,
} from "../validators/schemas";

const disputesRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

disputesRoute.use("*", authMiddleware);

disputesRoute.post(
  "/",
  zValidator("json", CreateDisputeSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");

    const body: z.infer<typeof CreateDisputeSchema> = c.req.valid("json");

    if (!body.siteId || !body.type || !body.title || !body.description) {
      return error(c, "VALIDATION_ERROR", "Missing required fields", 400);
    }

    if (!disputeTypeEnum.includes(body.type)) {
      return error(c, "VALIDATION_ERROR", "Invalid dispute type", 400);
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

    if (!membership) {
      return error(c, "FORBIDDEN", "Not a member of this site", 403);
    }

    const [dispute] = await db
      .insert(disputes)
      .values({
        siteId: body.siteId,
        userId: user.id,
        type: body.type,
        title: body.title,
        description: body.description,
        refReviewId: body.refReviewId,
        refPointsLedgerId: body.refPointsLedgerId,
        refAttendanceId: body.refAttendanceId,
      })
      .returning();

    try {
      await logAuditWithContext(
        c,
        db,
        "DISPUTE_CREATED",
        user.id,
        "DISPUTE",
        dispute.id,
        {
          siteId: body.siteId,
          type: body.type,
        },
      );
    } catch {
      // Do not block successful dispute creation on audit failure.
    }

    return success(c, dispute, 201);
  },
);

disputesRoute.get("/my", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const status = c.req.query("status") as
    | (typeof disputeStatusEnum)[number]
    | undefined;

  let whereCondition = eq(disputes.userId, user.id);
  if (status) {
    whereCondition = and(whereCondition, eq(disputes.status, status))!;
  }

  const results = await db
    .select({
      id: disputes.id,
      siteId: disputes.siteId,
      type: disputes.type,
      status: disputes.status,
      title: disputes.title,
      description: disputes.description,
      resolutionNote: disputes.resolutionNote,
      resolvedAt: disputes.resolvedAt,
      createdAt: disputes.createdAt,
      siteName: sites.name,
    })
    .from(disputes)
    .leftJoin(sites, eq(disputes.siteId, sites.id))
    .where(whereCondition)
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: results,
    pagination: { limit, offset, count: results.length },
  });
});

disputesRoute.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const disputeId = c.req.param("id");

  const dispute = await db
    .select({
      id: disputes.id,
      siteId: disputes.siteId,
      userId: disputes.userId,
      type: disputes.type,
      status: disputes.status,
      title: disputes.title,
      description: disputes.description,
      refReviewId: disputes.refReviewId,
      refPointsLedgerId: disputes.refPointsLedgerId,
      refAttendanceId: disputes.refAttendanceId,
      resolutionNote: disputes.resolutionNote,
      resolvedAt: disputes.resolvedAt,
      resolvedById: disputes.resolvedById,
      createdAt: disputes.createdAt,
      siteName: sites.name,
      userName: users.name,
    })
    .from(disputes)
    .leftJoin(sites, eq(disputes.siteId, sites.id))
    .leftJoin(users, eq(disputes.userId, users.id))
    .where(eq(disputes.id, disputeId))
    .get();

  if (!dispute) {
    return error(c, "NOT_FOUND", "Dispute not found", 404);
  }

  const isOwner = dispute.userId === user.id;
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SITE_ADMIN";

  if (!isOwner && !isAdmin) {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, dispute.siteId),
          eq(siteMemberships.role, "SITE_ADMIN"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "FORBIDDEN", "Not authorized to view this dispute", 403);
    }
  }

  return success(c, dispute);
});

disputesRoute.get("/site/:siteId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const status = c.req.query("status") as
    | (typeof disputeStatusEnum)[number]
    | undefined;

  if (user.role !== "SUPER_ADMIN") {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.role, "SITE_ADMIN"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "FORBIDDEN", "Admin access required", 403);
    }
  }

  let whereCondition = eq(disputes.siteId, siteId);
  if (status) {
    whereCondition = and(whereCondition, eq(disputes.status, status))!;
  }

  const results = await db
    .select({
      id: disputes.id,
      type: disputes.type,
      status: disputes.status,
      title: disputes.title,
      createdAt: disputes.createdAt,
      userName: users.name,
    })
    .from(disputes)
    .leftJoin(users, eq(disputes.userId, users.id))
    .where(whereCondition)
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: results,
    pagination: { limit, offset, count: results.length },
  });
});

disputesRoute.patch(
  "/:id/resolve",
  zValidator("json", ResolveDisputeSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const disputeId = c.req.param("id");

    const body: z.infer<typeof ResolveDisputeSchema> = c.req.valid("json");

    if (!body.status || !body.resolutionNote) {
      return error(
        c,
        "VALIDATION_ERROR",
        "Status and resolution note required",
        400,
      );
    }

    if (body.status !== "RESOLVED" && body.status !== "REJECTED") {
      return error(
        c,
        "VALIDATION_ERROR",
        "Status must be RESOLVED or REJECTED",
        400,
      );
    }

    const dispute = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .get();

    if (!dispute) {
      return error(c, "NOT_FOUND", "Dispute not found", 404);
    }

    if (dispute.status !== "OPEN" && dispute.status !== "IN_REVIEW") {
      return error(c, "INVALID_STATE", "Dispute is already resolved", 400);
    }

    if (user.role !== "SUPER_ADMIN") {
      const membership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, dispute.siteId),
            eq(siteMemberships.role, "SITE_ADMIN"),
          ),
        )
        .get();

      if (!membership) {
        return error(c, "FORBIDDEN", "Admin access required", 403);
      }
    }

    const [updated] = await db
      .update(disputes)
      .set({
        status: body.status,
        resolutionNote: body.resolutionNote,
        resolvedById: user.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId))
      .returning();

    try {
      await logAuditWithContext(
        c,
        db,
        "DISPUTE_RESOLVED",
        user.id,
        "DISPUTE",
        disputeId,
        {
          status: body.status,
          resolutionNote: body.resolutionNote,
        },
      );
    } catch {
      // Do not block successful dispute resolution on audit failure.
    }

    return success(c, updated);
  },
);

disputesRoute.patch(
  "/:id/status",
  zValidator("json", UpdateDisputeStatusSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const disputeId = c.req.param("id");

    const body: z.infer<typeof UpdateDisputeStatusSchema> = c.req.valid("json");

    if (!body.status || !disputeStatusEnum.includes(body.status)) {
      return error(c, "VALIDATION_ERROR", "Invalid status", 400);
    }

    const dispute = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .get();

    if (!dispute) {
      return error(c, "NOT_FOUND", "Dispute not found", 404);
    }

    if (user.role !== "SUPER_ADMIN") {
      const membership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, dispute.siteId),
            eq(siteMemberships.role, "SITE_ADMIN"),
          ),
        )
        .get();

      if (!membership) {
        return error(c, "FORBIDDEN", "Admin access required", 403);
      }
    }

    const [updated] = await db
      .update(disputes)
      .set({
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId))
      .returning();

    await logAuditWithContext(
      c,
      db,
      "DISPUTE_STATUS_CHANGED",
      user.id,
      "DISPUTE",
      disputeId,
      { previousStatus: dispute.status, newStatus: body.status },
    );

    return success(c, updated);
  },
);

export default disputesRoute;
