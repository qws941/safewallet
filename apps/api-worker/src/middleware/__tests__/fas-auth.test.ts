import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { fasAuthMiddleware } from "../fas-auth";
import type { Env } from "../../types";

function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/fas/*", fasAuthMiddleware);
  app.get("/fas/test", (c) => c.json({ ok: true }));

  return app;
}

function makeEnv(overrides?: Partial<Env>): Env {
  return {
    FAS_API_KEY: "valid-api-key",
    FAS_SYNC_SECRET: "valid-sync-secret",
    DB: {} as D1Database,
    KV: {} as KVNamespace,
    R2: {} as R2Bucket,
    STATIC: {} as R2Bucket,
    JWT_SECRET: "test",
    HMAC_SECRET: "test",
    ENCRYPTION_KEY: "test",
    ENVIRONMENT: "test",
    REQUIRE_ATTENDANCE_FOR_LOGIN: "false",
    REQUIRE_ATTENDANCE_FOR_POST: "false",
    ...overrides,
  } as Env;
}

describe("fasAuthMiddleware", () => {
  it("passes with valid API key", async () => {
    const app = createApp();
    const env = makeEnv();

    const res = await app.request(
      "http://localhost/fas/test",
      { headers: { "X-FAS-API-Key": "valid-api-key" } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 401 for missing API key", async () => {
    const app = createApp();
    const env = makeEnv();

    const res = await app.request("http://localhost/fas/test", {}, env);

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Invalid FAS API key");
  });

  it("returns 401 for wrong API key", async () => {
    const app = createApp();
    const env = makeEnv();

    const res = await app.request(
      "http://localhost/fas/test",
      { headers: { "X-FAS-API-Key": "wrong-key" } },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("returns 500 when FAS_API_KEY is not configured", async () => {
    const app = createApp();
    const env = makeEnv({ FAS_API_KEY: "", FAS_SYNC_SECRET: "" });

    const res = await app.request(
      "http://localhost/fas/test",
      { headers: { "X-FAS-API-Key": "some-key" } },
      env,
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("not configured");
  });

  it("falls back to FAS_SYNC_SECRET when FAS_API_KEY is missing", async () => {
    const app = createApp();
    const env = makeEnv({
      FAS_API_KEY: "",
      FAS_SYNC_SECRET: "fallback-secret",
    });

    const res = await app.request(
      "http://localhost/fas/test",
      { headers: { "X-FAS-API-Key": "fallback-secret" } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
