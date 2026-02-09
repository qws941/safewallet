import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { accessPolicies } from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import type { AppContext } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/access-policies/:siteId", async (c: AppContext) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.param("siteId");

  const policy = await db
    .select()
    .from(accessPolicies)
    .where(eq(accessPolicies.siteId, siteId))
    .get();

  return success(c, {
    policy: policy ?? {
      siteId,
      requireCheckin: true,
      dayCutoffHour: 5,
    },
  });
});

app.put("/access-policies/:siteId", async (c: AppContext) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const siteId = c.req.param("siteId");

  const body = await c.req.json<{
    requireCheckin: boolean;
    dayCutoffHour?: number;
  }>();

  if (typeof body.requireCheckin !== "boolean") {
    return error(c, "INVALID_INPUT", "requireCheckin must be a boolean", 400);
  }

  const cutoffHour = body.dayCutoffHour ?? 5;
  if (cutoffHour < 0 || cutoffHour > 23) {
    return error(
      c,
      "INVALID_INPUT",
      "dayCutoffHour must be between 0 and 23",
      400,
    );
  }

  const existing = await db
    .select()
    .from(accessPolicies)
    .where(eq(accessPolicies.siteId, siteId))
    .get();

  let policy: typeof accessPolicies.$inferSelect | undefined;
  if (existing) {
    [policy] = await db
      .update(accessPolicies)
      .set({
        requireCheckin: body.requireCheckin,
        dayCutoffHour: cutoffHour,
      })
      .where(eq(accessPolicies.siteId, siteId))
      .returning();
  } else {
    [policy] = await db
      .insert(accessPolicies)
      .values({
        siteId,
        requireCheckin: body.requireCheckin,
        dayCutoffHour: cutoffHour,
      })
      .returning();
  }

  if (!policy) {
    return error(
      c,
      "ACCESS_POLICY_UPDATE_FAILED",
      "Failed to update access policy",
      500,
    );
  }

  await logAuditWithContext(
    c,
    db,
    "ACCESS_POLICY_UPDATED",
    currentUser.id,
    "SYSTEM",
    siteId,
    {
      requireCheckin: body.requireCheckin,
      dayCutoffHour: cutoffHour,
      action: existing ? "updated" : "created",
    },
  );

  return success(c, { policy });
});

export default app;
