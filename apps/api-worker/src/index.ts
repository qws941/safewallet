import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "./db/schema";
import { hmac } from "./lib/crypto";
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

const app = new Hono<{ Bindings: Env }>();

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

// TODO: TEMPORARY seed endpoint - remove after test user created
api.post("/seed/test-user", async (c) => {
  const body = await c.req.json<{
    name: string;
    phone: string;
    dob: string;
    role?: string;
    secret?: string;
  }>();
  const { name, phone, dob, role = "WORKER" } = body;

  if (body.secret !== "safework2-seed-2026") {
    return c.json({ success: false, error: "Invalid seed secret" }, 403);
  }

  if (!name || !phone || !dob) {
    return c.json({ success: false, error: "name, phone, dob required" }, 400);
  }

  const db = drizzle(c.env.DB);
  const phoneHash = await hmac(c.env.HMAC_SECRET, phone);
  const dobHash = await hmac(c.env.HMAC_SECRET, dob);
  const nameMasked =
    name.length > 1 ? name[0] + "*".repeat(name.length - 1) : name;
  const validRole =
    role === "SUPER_ADMIN" || role === "SITE_ADMIN" || role === "SYSTEM"
      ? role
      : ("WORKER" as const);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.phoneHash, phoneHash))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        name,
        nameMasked,
        dobHash,
        role: validRole,
        updatedAt: new Date(),
      })
      .where(eq(users.phoneHash, phoneHash));

    return c.json({
      success: true,
      action: "updated",
      user: { id: existing[0].id, name, phone, role: validRole },
      login: { name, phone, dob },
    });
  }

  await db.insert(users).values({
    phone,
    name,
    nameMasked,
    phoneHash,
    dobHash,
    role: validRole,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return c.json({
    success: true,
    action: "created",
    user: { name, phone, role: validRole },
    login: { name, phone, dob },
  });
});

api.route("/auth", auth);
api.route("/attendance", attendanceRoute);
api.route("/votes", votesRoute);
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
