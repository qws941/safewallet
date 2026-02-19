import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import * as schema from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { success, error } from "../lib/response";
import type { Env, AuthContext } from "../types";
import { logAuditWithContext } from "../lib/audit";

const { manualApprovals, attendance, siteMemberships } = schema;

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

const APPROVAL_STATUSES = new Set(schema.approvalStatusEnum);

async function isSiteAdmin(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
) {
  const membership = await db
    .select({ id: siteMemberships.id })
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, userId),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.role, "SITE_ADMIN"),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  return !!membership;
}

// List approvals (pending by default, or filtered)
app.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");
  const status = c.req.query("status"); // PENDING, APPROVED, REJECTED
  const date = c.req.query("date");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  // Permission check: Site Admin or Super Admin
  if (user.role === "WORKER") {
    return error(c, "FORBIDDEN", "Forbidden", 403);
  }

  const conditions = [];
  if (siteId) conditions.push(eq(manualApprovals.siteId, siteId));
  if (status) {
    const normalizedStatus = status.toUpperCase();

    if (
      !APPROVAL_STATUSES.has(
        normalizedStatus as (typeof schema.approvalStatusEnum)[number],
      )
    ) {
      return error(c, "INVALID_STATUS", "Invalid status filter", 400);
    }

    conditions.push(
      eq(
        manualApprovals.status,
        normalizedStatus as (typeof schema.approvalStatusEnum)[number],
      ),
    );
  }

  if (date) {
    const targetDate = new Date(date);
    if (!isNaN(targetDate.getTime())) {
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      conditions.push(
        and(
          gte(manualApprovals.validDate, targetDate),
          lt(manualApprovals.validDate, nextDay),
        ),
      );
    }
  }

  const approvalList = await db.query.manualApprovals.findMany({
    limit,
    offset,
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(manualApprovals.createdAt),
    with: {
      user: true,
      approvedBy: true,
      site: true,
    },
  });

  return success(c, {
    data: approvalList,
    pagination: {
      limit,
      offset,
      count: approvalList.length,
    },
  });
});

// Approve request
app.post("/:id/approve", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { user: approver } = c.get("auth");
  const id = c.req.param("id");

  if (approver.role === "WORKER") {
    return error(c, "FORBIDDEN", "Forbidden", 403);
  }

  const approval = await db.query.manualApprovals.findFirst({
    where: eq(manualApprovals.id, id),
  });

  if (!approval) {
    return error(c, "NOT_FOUND", "Approval request not found", 404);
  }

  if (
    approval.siteId &&
    !(await isSiteAdmin(db, approver.id, approval.siteId))
  ) {
    return error(c, "FORBIDDEN", "Forbidden", 403);
  }

  if (approval.status !== "PENDING") {
    return error(c, "INVALID_STATUS", "Request is not pending", 400);
  }

  const updatedApproval = await db
    .update(manualApprovals)
    .set({
      status: "APPROVED",
      approvedById: approver.id,
      approvedAt: new Date(),
    })
    .where(
      and(eq(manualApprovals.id, id), eq(manualApprovals.status, "PENDING")),
    )
    .returning({ id: manualApprovals.id })
    .get();

  if (!updatedApproval) {
    return error(c, "CONFLICT", "Approval request was already processed", 409);
  }

  const existingAttendance = await db.query.attendance.findFirst({
    where: and(
      eq(attendance.userId, approval.userId),
      eq(attendance.siteId, approval.siteId),
      gte(attendance.checkinAt, approval.validDate),
      lt(
        attendance.checkinAt,
        new Date(approval.validDate.getTime() + 24 * 60 * 60 * 1000),
      ),
    ),
  });

  if (!existingAttendance) {
    await db.insert(attendance).values({
      userId: approval.userId,
      siteId: approval.siteId,
      checkinAt: approval.validDate,
      result: "SUCCESS",
      source: "MANUAL",
    });
  }

  await logAuditWithContext(
    c,
    db,
    "MANUAL_APPROVAL_APPROVED",
    approver.id,
    "MANUAL_APPROVAL",
    id,
    { reason: "Approved via UI" },
  );

  return success(c, { success: true });
});

// Reject request
app.post(
  "/:id/reject",
  zValidator(
    "json",
    z.object({
      reason: z.string().min(1, "Rejection reason is required"),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const { user: approver } = c.get("auth");
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");

    if (approver.role === "WORKER") {
      return error(c, "FORBIDDEN", "Forbidden", 403);
    }

    const approval = await db.query.manualApprovals.findFirst({
      where: eq(manualApprovals.id, id),
    });

    if (!approval) {
      return error(c, "NOT_FOUND", "Approval request not found", 404);
    }

    if (
      approval.siteId &&
      !(await isSiteAdmin(db, approver.id, approval.siteId))
    ) {
      return error(c, "FORBIDDEN", "Forbidden", 403);
    }

    if (approval.status !== "PENDING") {
      return error(c, "INVALID_STATUS", "Request is not pending", 400);
    }

    const updatedApproval = await db
      .update(manualApprovals)
      .set({
        status: "REJECTED",
        approvedById: approver.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(
        and(eq(manualApprovals.id, id), eq(manualApprovals.status, "PENDING")),
      )
      .returning({ id: manualApprovals.id })
      .get();

    if (!updatedApproval) {
      return error(
        c,
        "CONFLICT",
        "Approval request was already processed",
        409,
      );
    }

    await logAuditWithContext(
      c,
      db,
      "MANUAL_APPROVAL_REJECTED",
      approver.id,
      "MANUAL_APPROVAL",
      id,
      { reason },
    );

    return success(c, { success: true });
  },
);

export default app;
