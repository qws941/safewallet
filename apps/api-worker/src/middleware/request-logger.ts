import type { Context } from "hono";
import type { Env } from "../types";
import { createLogger, type Logger } from "../lib/logger";

declare module "hono" {
  interface ContextVariableMap {
    log: Logger;
  }
}

export async function requestLoggerMiddleware(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>,
): Promise<void> {
  const log = createLogger("request", {
    elasticsearchUrl: c.env.ELASTICSEARCH_URL,
    elasticsearchIndexPrefix: c.env.ELASTICSEARCH_INDEX_PREFIX,
    waitUntil: (p) => c.executionCtx.waitUntil(p),
  });

  c.set("log", log);

  const start = Date.now();
  const method = c.req.method;
  const endpoint = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  if (status >= 500) {
    log.error(`${method} ${endpoint} ${status}`, {
      endpoint,
      method,
      statusCode: status,
      duration,
    });
  } else if (status >= 400) {
    log.warn(`${method} ${endpoint} ${status}`, {
      endpoint,
      method,
      statusCode: status,
      duration,
    });
  }
}
