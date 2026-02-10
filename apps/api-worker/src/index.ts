import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { drizzle } from "drizzle-orm/d1";
import { fasGetAllEmployeesPaginated } from "./lib/fas-mariadb";
import {
  syncFasEmployeesToD1,
  deactivateRetiredEmployees,
} from "./lib/fas-sync";
import type { Env } from "./types";

import auth from "./routes/auth";
import attendanceRoute from "./routes/attendance";
import votesRoute from "./routes/votes";
import postsRoute from "./routes/posts";
import actionsRoute from "./routes/actions";
import usersRoute from "./routes/users";
import sitesRoute from "./routes/sites";
import announcementsRoute from "./routes/announcements";
import adminRoute from "./routes/admin";
import pointsRoute from "./routes/points";
import reviewsRoute from "./routes/reviews";
import fasRoute from "./routes/fas";
import disputesRoute from "./routes/disputes";
import notificationsRoute from "./routes/notifications";
import policiesRoute from "./routes/policies";
import approvalsRoute from "./routes/approvals";
import educationRoute from "./routes/education";
import acetimeRoute from "./routes/acetime";
import recommendationsRoute from "./routes/recommendations";
import { securityHeaders } from "./middleware/security-headers";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeaders);
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "https://safework2.jclee.me",
      "https://admin.safework2.jclee.me",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Device-Id", "X-Device-Id"],
    credentials: true,
  }),
);

const api = new Hono<{ Bindings: Env }>();

api.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Admin-only: Bulk sync FAS employees to D1 (paginated to avoid Workers CPU limit)
api.post("/fas-sync", async (c) => {
  const body = await c.req.json<{
    secret?: string;
    offset?: number;
    limit?: number;
  }>();
  if (!c.env.FAS_SYNC_SECRET || body.secret !== c.env.FAS_SYNC_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!c.env.FAS_HYPERDRIVE) {
    return c.json({ error: "FAS_HYPERDRIVE not available" }, 500);
  }

  const batchSize = body.limit ?? 100;
  const offset = body.offset ?? 0;

  try {
    const db = drizzle(c.env.DB);
    const { employees: batch, total: totalFas } =
      await fasGetAllEmployeesPaginated(
        c.env.FAS_HYPERDRIVE,
        offset,
        batchSize,
      );

    const activeEmployees = batch.filter((e) => e.stateFlag === "W");
    const retiredEmplCds = batch
      .filter((e) => e.stateFlag !== "W")
      .map((e) => e.emplCd);

    const syncResult = await syncFasEmployeesToD1(activeEmployees, db, {
      HMAC_SECRET: c.env.HMAC_SECRET,
      ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
    });

    let deactivated = 0;
    if (retiredEmplCds.length > 0) {
      deactivated = await deactivateRetiredEmployees(retiredEmplCds, db);
    }

    const hasMore = batch.length === batchSize;
    return c.json({
      success: true,
      totalFas,
      batch: { offset, limit: batchSize, processed: batch.length },
      active: activeEmployees.length,
      retired: retiredEmplCds.length,
      sync: syncResult,
      deactivated,
      hasMore,
      nextOffset: hasMore ? offset + batchSize : null,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return c.json({ error: e.message }, 500);
  }
});

api.route("/auth", auth);
api.route("/attendance", attendanceRoute);
api.route("/votes", votesRoute);
api.route("/recommendations", recommendationsRoute);
api.route("/posts", postsRoute);
api.route("/actions", actionsRoute);
api.route("/users", usersRoute);
api.route("/sites", sitesRoute);
api.route("/announcements", announcementsRoute);
api.route("/admin", adminRoute);
api.route("/points", pointsRoute);
api.route("/reviews", reviewsRoute);
api.route("/fas", fasRoute);
api.route("/disputes", disputesRoute);
api.route("/notifications", notificationsRoute);
api.route("/policies", policiesRoute);
api.route("/approvals", approvalsRoute);
api.route("/education", educationRoute);
api.route("/acetime", acetimeRoute);

// Catch-all for unmatched API routes — return 404 JSON instead of SPA HTML
api.all("*", (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
      timestamp: new Date().toISOString(),
    },
    404,
  );
});

app.route("/api", api);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
}

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  let path = url.pathname;

  if (path.endsWith("/")) {
    path += "index.html";
  } else if (!path.includes(".")) {
    path += "/index.html";
  }

  const key = path.startsWith("/") ? path.slice(1) : path;

  try {
    const object = await c.env.STATIC.get(key);

    if (object) {
      const headers = new Headers();
      headers.set("Content-Type", getMimeType(path));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");

      if (path.endsWith(".html")) {
        headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      }

      return new Response(object.body, { headers });
    }

    const indexObject = await c.env.STATIC.get("index.html");
    if (indexObject) {
      return new Response(indexObject.body, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      });
    }

    return c.json({ error: "Not Found", path: c.req.path }, 404);
  } catch (err) {
    console.error("Static serve error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);

  // Handle HTTPException properly (auth errors, validation errors, etc.)
  if (err instanceof Error && "getResponse" in err) {
    const httpErr = err as { status?: number; message: string };
    const status = (httpErr.status || 500) as 401 | 403 | 500;
    return c.json(
      {
        success: false,
        error: {
          code:
            status === 401
              ? "UNAUTHORIZED"
              : status === 403
                ? "FORBIDDEN"
                : "ERROR",
          message: httpErr.message,
        },
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          c.env.ENVIRONMENT === "development"
            ? err.message
            : "An error occurred",
      },
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

export { RateLimiter } from "./durable-objects/RateLimiter";
export { scheduled } from "./scheduled";

export default app;
