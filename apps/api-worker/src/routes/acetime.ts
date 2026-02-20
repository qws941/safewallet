import { Hono } from "hono";
import { and, desc, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";
import { hmac } from "../lib/crypto";
import { fasGetEmployeeInfo } from "../lib/fas-mariadb";
import { syncSingleFasEmployee } from "../lib/fas-sync";
import {
  CROSS_MATCH_DEFAULT_BATCH,
  CROSS_MATCH_MAX_BATCH,
} from "../lib/constants";
import { createLogger } from "../lib/logger";
import { error, success } from "../lib/response";
import { acquireSyncLock, releaseSyncLock } from "../lib/sync-lock";
import { authMiddleware } from "../middleware/auth";
import type { AuthContext, Env } from "../types";
import { maskName } from "../utils/common";
import { dbBatchChunked } from "../db/helpers";

const log = createLogger("acetime");

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

type AppContext = {
  Bindings: Env;
  Variables: { auth: AuthContext };
};

function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SITE_ADMIN" || role === "SUPER_ADMIN";
}

async function withAuth(
  c: import("hono").Context<AppContext>,
  handler: () => Promise<Response>,
): Promise<Response> {
  let response: Response | undefined;

  await authMiddleware(c, async () => {
    response = await handler();
  });

  return response || error(c, "UNAUTHORIZED", "Authentication required", 401);
}

// SYNC PATHS:
// 1. POST /acetime/sync-db (this) — R2 JSON → basic user records (name only, no PII hashing)
// 2. POST /fas/workers/sync          — MariaDB API → full PII with phone/dob encryption
// 3. CRON runAcetimeSyncFromR2        — Scheduled version of path 1 (every 5 min)
app.post("/sync-db", async (c) => {
  return withAuth(c, async () => {
    const auth = c.get("auth");
    if (!isAdminRole(auth.user.role)) {
      return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
    }

    if (!c.env.ACETIME_BUCKET) {
      return error(
        c,
        "ACETIME_BUCKET_NOT_CONFIGURED",
        "AceTime bucket is not configured",
        500,
      );
    }

    const object = await c.env.ACETIME_BUCKET.get("aceviewer-employees.json");
    if (!object) {
      return error(
        c,
        "ACETIME_JSON_NOT_FOUND",
        "aceviewer-employees.json not found in R2",
        404,
      );
    }

    const data = (await object.json()) as {
      employees: Array<{
        externalWorkerId: string;
        name: string;
        companyName: string | null;
        position: string | null;
        trade: string | null;
        lastSeen: string | null;
      }>;
      total: number;
    };
    const aceViewerEmployees = data.employees;

    const db = drizzle(c.env.DB);

    // Acquire lock to prevent concurrent sync (#48)
    const lock = await acquireSyncLock(c.env.KV, "acetime");
    if (!lock.acquired) {
      return error(
        c,
        "SYNC_IN_PROGRESS",
        "AceTime sync is already running",
        409,
      );
    }

    try {
      // Step 1: Get all existing FAS users in one query
      // Include phoneHash to prefer records with real PII data when duplicates exist
      const existingUsers = await db
        .select({
          id: users.id,
          externalWorkerId: users.externalWorkerId,
          phoneHash: users.phoneHash,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.externalSystem, "FAS"));

      // Build map preferring records with real phone data (FAS CRON > AceViewer sync)
      const existingMap = new Map<string | null, string>();
      for (const u of existingUsers) {
        const current = existingMap.get(u.externalWorkerId);
        if (!current) {
          existingMap.set(u.externalWorkerId, u.id);
        } else {
          // Prefer the record with real phoneHash (not acetime- placeholder)
          const isRealPhone =
            u.phoneHash && !u.phoneHash.startsWith("acetime-");
          const currentUser = existingUsers.find((eu) => eu.id === current);
          const currentIsReal =
            currentUser?.phoneHash &&
            !currentUser.phoneHash.startsWith("acetime-");
          if (isRealPhone && !currentIsReal) {
            existingMap.set(u.externalWorkerId, u.id);
          }
        }
      }

      // Step 2: Pre-compute HMAC hashes for new employees
      const newEmployees = aceViewerEmployees.filter(
        (e) => !existingMap.has(e.externalWorkerId),
      );
      const updateEmployees = aceViewerEmployees.filter((e) =>
        existingMap.has(e.externalWorkerId),
      );

      const hashMap = new Map<string, string>();
      await Promise.all(
        newEmployees.map(async (e) => {
          const h = await hmac(
            c.env.HMAC_SECRET,
            `acetime-${e.externalWorkerId}`,
          );
          hashMap.set(e.externalWorkerId, h);
        }),
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const e of newEmployees) {
        const phoneHash = hashMap.get(e.externalWorkerId) || "";
        try {
          await db.insert(users).values({
            id: crypto.randomUUID(),
            externalSystem: "FAS",
            externalWorkerId: e.externalWorkerId,
            name: e.name,
            nameMasked: maskName(e.name),
            phoneHash: phoneHash,
            companyName: e.companyName,
            tradeType: e.trade,
            role: "WORKER",
          });
          created++;
        } catch (insertErr) {
          log.error("Failed to insert worker", {
            externalWorkerId: e.externalWorkerId,
            error:
              insertErr instanceof Error
                ? insertErr.message
                : String(insertErr),
          });
          skipped++;
        }
      }

      for (const e of updateEmployees) {
        const userId = existingMap.get(e.externalWorkerId);
        if (!userId) {
          skipped++;
          continue;
        }
        try {
          await db
            .update(users)
            .set({
              name: e.name,
              nameMasked: maskName(e.name),
              companyName: e.companyName,
              tradeType: e.trade,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
          updated++;
        } catch (updateErr) {
          log.error("Failed to update worker", {
            externalWorkerId: e.externalWorkerId,
            error:
              updateErr instanceof Error
                ? updateErr.message
                : String(updateErr),
          });
          skipped++;
        }
      }

      // Step 3: FAS cross-matching — update acetime-* placeholder hashes with real PII from FAS MariaDB
      let fasCrossMatched = 0;
      let fasCrossSkipped = 0;
      let fasCrossErrors = 0;

      if (c.env.FAS_HYPERDRIVE) {
        // Find all users still using acetime-* placeholder hashes
        const placeholderUsers = await db
          .select({
            id: users.id,
            externalWorkerId: users.externalWorkerId,
            phoneHash: users.phoneHash,
          })
          .from(users)
          .where(
            and(
              eq(users.externalSystem, "FAS"),
              like(users.phoneHash, "acetime-%"),
            ),
          );

        if (placeholderUsers.length > 0) {
          const hd = c.env.FAS_HYPERDRIVE;
          const env = {
            HMAC_SECRET: c.env.HMAC_SECRET,
            ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
          };

          // Limit cross-match batch to avoid CF Workers CPU timeout (30s) — #44
          const crossMatchBatch = placeholderUsers.slice(
            0,
            CROSS_MATCH_DEFAULT_BATCH,
          );
          for (const pu of crossMatchBatch) {
            if (!pu.externalWorkerId) {
              fasCrossSkipped++;
              continue;
            }
            try {
              const fasEmployee = await fasGetEmployeeInfo(
                hd,
                pu.externalWorkerId,
              );
              if (fasEmployee && fasEmployee.phone) {
                await syncSingleFasEmployee(fasEmployee, db, env);
                fasCrossMatched++;
              } else {
                fasCrossSkipped++;
              }
            } catch (crossErr) {
              log.error("FAS cross-match failed in sync-db", {
                externalWorkerId: pu.externalWorkerId,
                error:
                  crossErr instanceof Error
                    ? crossErr.message
                    : String(crossErr),
              });
              fasCrossErrors++;
            }
          }
        }
      }

      return success(c, {
        source: {
          key: "aceviewer-employees.json",
          size: object.size,
          uploaded: object.uploaded,
          etag: object.httpEtag,
        },
        sync: {
          extracted: aceViewerEmployees.length,
          created,
          updated,
          skipped,
        },
        fasCrossMatch: {
          attempted: fasCrossMatched + fasCrossSkipped + fasCrossErrors,
          matched: fasCrossMatched,
          skipped: fasCrossSkipped,
          errors: fasCrossErrors,
          available: !!c.env.FAS_HYPERDRIVE,
        },
      });
    } finally {
      await releaseSyncLock(c.env.KV, "acetime");
    }
  });
});

// Standalone FAS cross-match endpoint — updates acetime-* placeholder hashes with real PII from FAS MariaDB
// Separated from sync-db to avoid Worker CPU timeout (30s limit)
app.post("/fas-cross-match", async (c) => {
  return withAuth(c, async () => {
    const auth = c.get("auth");
    if (!isAdminRole(auth.user.role)) {
      return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
    }

    if (!c.env.FAS_HYPERDRIVE) {
      return error(
        c,
        "FAS_HYPERDRIVE_NOT_CONFIGURED",
        "FAS Hyperdrive is not configured",
        500,
      );
    }

    const limit = Math.min(
      Number(c.req.query("limit")) || CROSS_MATCH_DEFAULT_BATCH,
      CROSS_MATCH_MAX_BATCH,
    );

    const db = drizzle(c.env.DB);

    const placeholderUsers = await db
      .select({
        id: users.id,
        externalWorkerId: users.externalWorkerId,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.externalSystem, "FAS"),
          like(users.phoneHash, "acetime-%"),
        ),
      )
      .limit(limit);

    const total = placeholderUsers.length;
    let matched = 0;
    let skipped = 0;
    let errors = 0;
    const matchedNames: string[] = [];

    if (total > 0) {
      const hd = c.env.FAS_HYPERDRIVE;
      const env = {
        HMAC_SECRET: c.env.HMAC_SECRET,
        ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
      };

      for (const pu of placeholderUsers) {
        if (!pu.externalWorkerId) {
          skipped++;
          continue;
        }
        try {
          const fasEmployee = await fasGetEmployeeInfo(hd, pu.externalWorkerId);
          if (fasEmployee && fasEmployee.phone) {
            await syncSingleFasEmployee(fasEmployee, db, env);
            matched++;
            matchedNames.push(pu.name || pu.externalWorkerId);
          } else {
            skipped++;
          }
        } catch (crossErr) {
          log.error("FAS cross-match failed", {
            externalWorkerId: pu.externalWorkerId,
            error:
              crossErr instanceof Error ? crossErr.message : String(crossErr),
          });
          errors++;
        }
      }
    }

    return success(c, {
      batch: { limit, processed: total },
      results: { matched, skipped, errors },
      matchedNames,
      hasMore: total === limit,
    });
  });
});

app.get("/photo/:employeeId", async (c) => {
  return withAuth(c, async () => {
    if (!c.env.ACETIME_BUCKET) {
      return error(
        c,
        "ACETIME_BUCKET_NOT_CONFIGURED",
        "AceTime bucket is not configured",
        500,
      );
    }

    const employeeId = c.req.param("employeeId")?.trim();
    if (!employeeId) {
      return error(c, "EMPLOYEE_ID_REQUIRED", "employeeId is required", 400);
    }

    const key = `picture/${employeeId}.jpg`;
    const object = await c.env.ACETIME_BUCKET.get(key);
    if (!object) {
      return error(c, "PHOTO_NOT_FOUND", "Employee photo not found", 404);
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType || "image/jpeg",
    );
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("ETag", object.httpEtag);

    return new Response(object.body, { headers });
  });
});

app.get("/employees", async (c) => {
  return withAuth(c, async () => {
    const auth = c.get("auth");
    if (!isAdminRole(auth.user.role)) {
      return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
    }

    const db = drizzle(c.env.DB);
    const employees = await db
      .select({
        id: users.id,
        name: users.name,
        nameMasked: users.nameMasked,
        externalWorkerId: users.externalWorkerId,
      })
      .from(users)
      .where(eq(users.externalSystem, "FAS"))
      .orderBy(desc(users.updatedAt));

    return success(c, {
      employees: employees.map((employee) => ({
        ...employee,
        profileImageUrl: employee.externalWorkerId
          ? `picture/${employee.externalWorkerId}.jpg`
          : null,
      })),
    });
  });
});

export default app;
