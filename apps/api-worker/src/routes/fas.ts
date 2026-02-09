import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { users } from "../db/schema";
import { hmac, encrypt } from "../lib/crypto";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import { fasAuthMiddleware } from "../middleware/fas-auth";
import { maskName } from "../utils/common";
import { AdminSyncWorkersSchema } from "../validators/schemas";

const app = new Hono<{ Bindings: Env }>();

app.use("*", fasAuthMiddleware);

app.post(
  "/workers/sync",
  zValidator("json", AdminSyncWorkersSchema),
  async (c) => {
    const db = drizzle(c.env.DB);

    let data: {
      siteId?: string;
      workers?: Array<{
        externalWorkerId?: string;
        name?: string;
        phone?: string;
        dob?: string;
        companyName?: string;
        tradeType?: string;
      }>;
    } | null = null;
    try {
      c.req.valid("json");
      data = (await c.req.raw.clone().json()) as {
        siteId?: string;
        workers?: Array<{
          externalWorkerId?: string;
          name?: string;
          phone?: string;
          dob?: string;
          companyName?: string;
          tradeType?: string;
        }>;
      };
    } catch {
      return error(c, "INVALID_JSON", "Invalid JSON", 400);
    }

    if (!data.workers || !Array.isArray(data.workers)) {
      return error(
        c,
        "MISSING_WORKERS_ARRAY",
        "workers array is required",
        400,
      );
    }

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as { externalWorkerId: string; error: string }[],
    };

    for (const worker of data.workers) {
      try {
        if (
          !worker.externalWorkerId ||
          !worker.name ||
          !worker.phone ||
          !worker.dob
        ) {
          results.failed++;
          results.errors.push({
            externalWorkerId: worker.externalWorkerId || "unknown",
            error:
              "Missing required fields: externalWorkerId, name, phone, dob",
          });
          continue;
        }

        const externalWorkerId = worker.externalWorkerId;
        const workerName = worker.name;
        const workerPhone = worker.phone;
        const workerDob = worker.dob;

        const normalizedPhone = workerPhone.replace(/[^0-9]/g, "");
        const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
        const dobHash = await hmac(c.env.HMAC_SECRET, workerDob);
        const phoneEncrypted = await encrypt(
          c.env.ENCRYPTION_KEY,
          normalizedPhone,
        );
        const dobEncrypted = await encrypt(c.env.ENCRYPTION_KEY, workerDob);
        const nameMasked = maskName(workerName);

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.externalWorkerId, externalWorkerId))
          .get();

        if (existing) {
          await db
            .update(users)
            .set({
              name: workerName,
              nameMasked,
              phone: phoneHash,
              phoneHash,
              phoneEncrypted,
              dob: null,
              dobHash,
              dobEncrypted,
              companyName: worker.companyName ?? null,
              tradeType: worker.tradeType ?? null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id));

          results.updated++;
        } else {
          await db.insert(users).values({
            externalSystem: "FAS",
            externalWorkerId,
            name: workerName,
            nameMasked,
            phone: phoneHash,
            phoneHash,
            phoneEncrypted,
            dob: null,
            dobHash,
            dobEncrypted,
            companyName: worker.companyName ?? null,
            tradeType: worker.tradeType ?? null,
            role: "WORKER",
          });

          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          externalWorkerId: worker.externalWorkerId || "unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    try {
      await logAuditWithContext(
        c,
        db,
        "FAS_WORKERS_SYNCED",
        "system",
        "USER",
        "BULK",
        {
          totalWorkers: data.workers.length,
          created: results.created,
          updated: results.updated,
          failed: results.failed,
        },
      );
    } catch {
      // Do not block successful sync response on audit failure.
    }

    return success(c, results);
  },
);

app.delete("/workers/:externalWorkerId", async (c) => {
  const db = drizzle(c.env.DB);
  const externalWorkerId = c.req.param("externalWorkerId");

  if (!externalWorkerId) {
    return error(
      c,
      "MISSING_EXTERNAL_WORKER_ID",
      "externalWorkerId is required",
      400,
    );
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.externalWorkerId, externalWorkerId))
    .get();

  if (!user) {
    return success(c, { deleted: false, reason: "User not found" });
  }

  await db.delete(users).where(eq(users.id, user.id));

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_PROFILE_UPDATED",
      "system",
      "USER",
      user.id,
      {
        action: "FAS_WORKER_DELETED",
        externalWorkerId,
      },
    );
  } catch {
    // Do not block successful delete response on audit failure.
  }

  return success(c, { deleted: true });
});

export default app;
