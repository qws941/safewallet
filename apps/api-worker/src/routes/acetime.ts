import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";
import { encrypt, hmac } from "../lib/crypto";
import { error, success } from "../lib/response";
import { authMiddleware } from "../middleware/auth";
import type { AuthContext, Env } from "../types";
import { maskName } from "../utils/common";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

interface AceTimeEmployee {
  externalWorkerId: string;
  name: string;
  phone?: string;
  dob?: string;
  photoFilename?: string;
}

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

    const object = await c.env.ACETIME_BUCKET.get("AceViewer.db3");
    if (!object) {
      return error(c, "ACETIME_DB_NOT_FOUND", "AceViewer.db3 not found", 404);
    }

    const dbBytes = new Uint8Array(await object.arrayBuffer());
    const sqliteHeader = "SQLite format 3\u0000";
    const headerText = new TextDecoder().decode(dbBytes.slice(0, 16));
    const isSqliteFile = headerText === sqliteHeader;

    // TODO: Replace stub extraction with proper SQLite parsing in Workers (e.g. sql.js WASM).
    // Current endpoint validates object accessibility and performs metadata sync only.
    const extractedEmployees: AceTimeEmployee[] = [];

    const db = drizzle(c.env.DB);
    let created = 0;
    let updated = 0;

    for (const employee of extractedEmployees) {
      const normalizedPhone = (employee.phone || "").replace(/[^0-9]/g, "");
      const phoneSource =
        normalizedPhone || `acetime-${employee.externalWorkerId}`;
      const phoneHash = await hmac(c.env.HMAC_SECRET, phoneSource);
      const phoneEncrypted = normalizedPhone
        ? await encrypt(c.env.ENCRYPTION_KEY, normalizedPhone)
        : null;

      const normalizedDob = employee.dob?.replace(/[^0-9]/g, "") || null;
      const dobHash = normalizedDob
        ? await hmac(c.env.HMAC_SECRET, normalizedDob)
        : null;
      const dobEncrypted = normalizedDob
        ? await encrypt(c.env.ENCRYPTION_KEY, normalizedDob)
        : null;

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.externalSystem, "FAS"),
            eq(users.externalWorkerId, employee.externalWorkerId),
          ),
        )
        .get();

      if (existing) {
        await db
          .update(users)
          .set({
            name: employee.name,
            nameMasked: maskName(employee.name),
            phone: phoneHash,
            phoneHash,
            phoneEncrypted,
            dob: null,
            dobHash,
            dobEncrypted,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
        updated++;
      } else {
        await db.insert(users).values({
          externalSystem: "FAS",
          externalWorkerId: employee.externalWorkerId,
          name: employee.name,
          nameMasked: maskName(employee.name),
          phone: phoneHash,
          phoneHash,
          phoneEncrypted,
          dob: null,
          dobHash,
          dobEncrypted,
          role: "WORKER",
        });
        created++;
      }
    }

    return success(c, {
      source: {
        key: "AceViewer.db3",
        size: object.size,
        uploaded: object.uploaded,
        etag: object.httpEtag,
        sqliteHeaderValid: isSqliteFile,
      },
      sync: {
        extracted: extractedEmployees.length,
        created,
        updated,
      },
      note: "SQLite employee extraction is stubbed. TODO: implement sql.js parser.",
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
