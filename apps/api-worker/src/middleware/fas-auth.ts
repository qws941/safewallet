import { Context, Next } from "hono";
import type { Env } from "../types";
import { error } from "../lib/response";
import { createLogger } from "../lib/logger";

const logger = createLogger("fas-auth");

export async function fasAuthMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
) {
  const apiKey = c.req.header("X-FAS-API-Key");
  const expectedKey = c.env.FAS_API_KEY || c.env.FAS_SYNC_SECRET;

  if (!expectedKey) {
    logger.error("FAS_API_KEY/FAS_SYNC_SECRET not configured");
    return error(c, "SERVER_ERROR", "API key not configured", 500);
  }

  if (!apiKey || apiKey !== expectedKey) {
    return error(c, "UNAUTHORIZED", "Invalid FAS API key", 401);
  }

  await next();
}
