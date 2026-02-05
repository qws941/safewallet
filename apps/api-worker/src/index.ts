import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
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
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "safework2-api",
    version: "1.0.0",
    environment: c.env.ENVIRONMENT || "production",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.route("/auth", auth);
app.route("/attendance", attendanceRoute);
app.route("/votes", votesRoute);
app.route("/posts", postsRoute);
app.route("/actions", actionsRoute);
app.route("/users", usersRoute);
app.route("/sites", sitesRoute);
app.route("/announcements", announcementsRoute);
app.route("/admin", adminRoute);
app.route("/points", pointsRoute);
app.route("/reviews", reviewsRoute);
app.route("/fas", fasRoute);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message:
        c.env.ENVIRONMENT === "development" ? err.message : "An error occurred",
    },
    500,
  );
});

app.notFound((c) => {
  return c.json({ error: "Not Found", path: c.req.path }, 404);
});

export { RateLimiter } from "./durable-objects/rate-limiter";

export default app;
