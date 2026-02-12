import { Hono } from "hono";
import type { Env } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import usersApp from "./users";
import exportApp from "./export";
import fasApp from "./fas";
import postsApp from "./posts";
import auditApp from "./audit";
import attendanceApp from "./attendance";
import statsApp from "./stats";
import votesApp from "./votes";
import accessPoliciesApp from "./access-policies";
import syncErrorsApp from "./sync-errors";
import recommendationsApp from "./recommendations";
import monitoringApp from "./monitoring";

const app = new Hono<{ Bindings: Env }>();

// Auth middleware for all admin routes
app.use("*", authMiddleware);

// Mount sub-routers
app.route("/", usersApp);
app.route("/", exportApp);
app.route("/", fasApp);
app.route("/", postsApp);
app.route("/", auditApp);
app.route("/", attendanceApp);
app.route("/", statsApp);
app.route("/", votesApp);
app.route("/", accessPoliciesApp);
app.route("/", syncErrorsApp);
app.route("/", recommendationsApp);
app.route("/", monitoringApp);
app.route("/", monitoringApp);

export default app;
