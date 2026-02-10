import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { syncErrors, syncErrorStatusEnum, syncTypeEnum } from "../../db/schema";
import { AdminResolveSyncErrorSchema } from "../../validators/schemas";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import type { AppContext } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/sync-errors", async (c: AppContext) => {
  const user = c.get("auth").user;
  if (user.role !== "SUPER_ADMIN" && user.role !== "SITE_ADMIN") {
    return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
  }

  const db = drizzle(c.env.DB);
  const status = c.req.query("status");
  const syncType = c.req.query("syncType");
  const siteId = c.req.query("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  if (
    status &&
    !syncErrorStatusEnum.includes(
      status as (typeof syncErrorStatusEnum)[number],
    )
  ) {
    return error(
      c,
      "INVALID_STATUS",
      `Invalid status. Must be one of: ${syncErrorStatusEnum.join(", ")}`,
      400,
    );
  }

  if (
    syncType &&
    !syncTypeEnum.includes(syncType as (typeof syncTypeEnum)[number])
  ) {
    return error(
      c,
      "INVALID_SYNC_TYPE",
      `Invalid syncType. Must be one of: ${syncTypeEnum.join(", ")}`,
      400,
    );
  }

  const conditions = [];
  if (status) {
    conditions.push(
      eq(syncErrors.status, status as (typeof syncErrorStatusEnum)[number]),
    );
  }
  if (syncType) {
    conditions.push(
      eq(syncErrors.syncType, syncType as (typeof syncTypeEnum)[number]),
    );
  }
  if (siteId) {
    conditions.push(eq(syncErrors.siteId, siteId));
  }

  const errors = await db
    .select()
    .from(syncErrors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(syncErrors.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(syncErrors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return success(c, {
    errors,
    total: totalResult?.count || 0,
  });
});

app.patch(
  "/sync-errors/:id/status",
  zValidator("json", AdminResolveSyncErrorSchema as never),
  async (c) => {
    const user = c.get("auth").user;
    if (user.role !== "SUPER_ADMIN" && user.role !== "SITE_ADMIN") {
      return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
    }

    const id = c.req.param("id");
    const body: z.infer<typeof AdminResolveSyncErrorSchema> =
      c.req.valid("json");

    if (
      !body.status ||
      (body.status !== "RESOLVED" && body.status !== "IGNORED")
    ) {
      return error(
        c,
        "INVALID_STATUS",
        "status must be RESOLVED or IGNORED",
        400,
      );
    }

    const db = drizzle(c.env.DB);
    const newStatus = body.status as "RESOLVED" | "IGNORED";

    const updated = await db
      .update(syncErrors)
      .set({
        status: newStatus,
        resolvedAt: new Date(),
      })
      .where(eq(syncErrors.id, id))
      .returning()
      .get();

    if (!updated) {
      return error(c, "SYNC_ERROR_NOT_FOUND", "Sync error not found", 404);
    }

    await logAuditWithContext(
      c,
      db,
      "SYNC_ERROR_RESOLVED",
      user.id,
      "SYSTEM",
      id,
      { newStatus },
    );

    return success(c, { error: updated });
  },
);

export default app;
