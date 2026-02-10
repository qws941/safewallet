import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";
import { hmac } from "../lib/crypto";
import { error, success } from "../lib/response";
import { authMiddleware } from "../middleware/auth";
import type { AuthContext, Env } from "../types";
import { maskName } from "../utils/common";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

type AppContext = {
  Bindings: Env;
  Variables: { auth: AuthContext };
};

function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
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

    // Step 1: Get all existing FAS users in one query
    const existingUsers = await db
      .select({
        id: users.id,
        externalWorkerId: users.externalWorkerId,
      })
      .from(users)
      .where(eq(users.externalSystem, "FAS"));

    const existingMap = new Map(
      existingUsers.map((u) => [u.externalWorkerId, u.id]),
    );

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
          phone: phoneHash,
          phoneHash: phoneHash,
          companyName: e.companyName,
          tradeType: e.trade,
          role: "WORKER",
        });
        created++;
      } catch {
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
      } catch {
        skipped++;
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
