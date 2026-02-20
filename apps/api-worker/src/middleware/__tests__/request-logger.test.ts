import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../types";
import { requestLoggerMiddleware } from "../request-logger";

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("../../lib/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

import { createLogger } from "../../lib/logger";

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", requestLoggerMiddleware);
  return app;
}

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    R2: {} as R2Bucket,
    STATIC: {} as R2Bucket,
    KV: {} as KVNamespace,
    JWT_SECRET: "test",
    HMAC_SECRET: "test",
    ENCRYPTION_KEY: "test",
    REQUIRE_ATTENDANCE_FOR_LOGIN: "false",
    REQUIRE_ATTENDANCE_FOR_POST: "false",
    ENVIRONMENT: "test",
    ELASTICSEARCH_URL: "http://localhost:9200",
    ELASTICSEARCH_INDEX_PREFIX: "safework2-logs",
  } as unknown as Env;
}

describe("requestLoggerMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates logger with ES options from env", async () => {
    const app = makeApp();
    app.get("/api/health", (c) => c.json({ ok: true }));

    const env = makeEnv();
    const res = await app.request("http://localhost/api/health", {}, env);
    expect(res.status).toBe(200);

    expect(createLogger).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        elasticsearchUrl: "http://localhost:9200",
        elasticsearchIndexPrefix: "safework2-logs",
      }),
    );
  });

  it("sets log on context for route handlers", async () => {
    const app = makeApp();
    let hasLog = false;
    app.get("/api/test", (c) => {
      hasLog = c.var.log !== undefined;
      return c.json({ ok: true });
    });

    const env = makeEnv();
    await app.request("http://localhost/api/test", {}, env);

    expect(hasLog).toBe(true);
  });

  it("logs error for 5xx responses", async () => {
    const app = makeApp();
    app.get("/api/fail", (c) => c.json({ error: "fail" }, 500));

    const env = makeEnv();
    await app.request("http://localhost/api/fail", {}, env);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("500"),
      expect.objectContaining({ statusCode: 500, method: "GET" }),
    );
  });

  it("logs warn for 4xx responses", async () => {
    const app = makeApp();
    app.get("/api/missing", (c) => c.json({ error: "not found" }, 404));

    const env = makeEnv();
    await app.request("http://localhost/api/missing", {}, env);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("404"),
      expect.objectContaining({ statusCode: 404, method: "GET" }),
    );
  });

  it("does not log for 2xx responses", async () => {
    const app = makeApp();
    app.get("/api/ok", (c) => c.json({ ok: true }));

    const env = makeEnv();
    await app.request("http://localhost/api/ok", {}, env);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
