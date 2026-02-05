import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { users } from "../db/schema";
import { hmac } from "../lib/crypto";
import { success, error } from "../lib/response";

const app = new Hono<{ Bindings: Env }>();

interface FasWorkerDto {
  externalWorkerId: string;
  name: string;
  phone: string;
  dob: string;
  companyName?: string;
  tradeType?: string;
}

interface SyncWorkersBody {
  workers: FasWorkerDto[];
}

function maskName(name: string): string {
  if (name.length <= 1) return "*";
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

app.post("/workers/sync", async (c) => {
  const db = drizzle(c.env.DB);

  let data: SyncWorkersBody;
  try {
    data = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!data.workers || !Array.isArray(data.workers)) {
    return error(c, "MISSING_WORKERS_ARRAY", "workers array is required", 400);
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
          error: "Missing required fields: externalWorkerId, name, phone, dob",
        });
        continue;
      }

      const normalizedPhone = worker.phone.replace(/[^0-9]/g, "");
      const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
      const dobHash = await hmac(c.env.HMAC_SECRET, worker.dob);
      const nameMasked = maskName(worker.name);

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.externalWorkerId, worker.externalWorkerId))
        .get();

      if (existing) {
        await db
          .update(users)
          .set({
            name: worker.name,
            nameMasked,
            phone: normalizedPhone,
            phoneHash,
            dob: worker.dob,
            dobHash,
            companyName: worker.companyName ?? null,
            tradeType: worker.tradeType ?? null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));

        results.updated++;
      } else {
        await db.insert(users).values({
          externalSystem: "FAS",
          externalWorkerId: worker.externalWorkerId,
          name: worker.name,
          nameMasked,
          phone: normalizedPhone,
          phoneHash,
          dob: worker.dob,
          dobHash,
          companyName: worker.companyName ?? null,
          tradeType: worker.tradeType ?? null,
          role: "WORKER",
        });

        results.created++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        externalWorkerId: worker.externalWorkerId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return success(c, results);
});

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

  return success(c, { deleted: true });
});

export default app;
