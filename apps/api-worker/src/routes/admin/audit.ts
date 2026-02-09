import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { auditLogs, users } from "../../db/schema";
import { success } from "../../lib/response";
import { requireAdmin } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

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

export default app;
