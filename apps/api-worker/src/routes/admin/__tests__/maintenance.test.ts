import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuthContext, Env } from "../../../types";
import { createMockKV, makeAuth } from "../../../__tests__/helpers";

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

import alertingApp from "../alerting";

let kv: ReturnType<typeof createMockKV>;

interface MaintenanceResponse {
  success: boolean;
  data: {
    active: boolean;
    message: string | null;
    severity: string | null;
  };
  timestamp?: string;
}

interface ErrorResponse {
  success: boolean;
  error: { code: string; message: string };
}

function buildApp() {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", makeAuth("ADMIN"));
    await next();
  });

  app.route("/admin", alertingApp);
  return app;
}

describe("Admin Maintenance Endpoints", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    kv = createMockKV();
    app = buildApp();
  });

  function env(): Record<string, unknown> {
    return { KV: kv, ALERT_WEBHOOK_URL: "" };
  }

  describe("GET /admin/maintenance", () => {
    it("returns inactive when no maintenance message", async () => {
      const res = await app.request("/admin/maintenance", {}, env());
      expect(res.status).toBe(200);
      const body = (await res.json()) as MaintenanceResponse;
      expect(body.data.active).toBe(false);
      expect(body.data.message).toBeNull();
    });

    it("returns active with JSON payload", async () => {
      await kv.put(
        "maintenance-message",
        JSON.stringify({ message: "서버 점검 중", severity: "critical" }),
      );
      const res = await app.request("/admin/maintenance", {}, env());
      const body = (await res.json()) as MaintenanceResponse;
      expect(body.data.active).toBe(true);
      expect(body.data.message).toBe("서버 점검 중");
      expect(body.data.severity).toBe("critical");
    });

    it("returns active with plain string fallback", async () => {
      await kv.put("maintenance-message", "plain text notice");
      const res = await app.request("/admin/maintenance", {}, env());
      const body = (await res.json()) as MaintenanceResponse;
      expect(body.data.active).toBe(true);
      expect(body.data.message).toBe("plain text notice");
      expect(body.data.severity).toBe("info");
    });
  });

  describe("PUT /admin/maintenance", () => {
    it("sets maintenance message", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "시스템 업데이트 예정",
            severity: "warning",
          }),
        },
        env(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as MaintenanceResponse & {
        data: { ttlSeconds: number };
      };
      expect(body.data.active).toBe(true);
      expect(body.data.message).toBe("시스템 업데이트 예정");
      expect(body.data.severity).toBe("warning");
      expect(body.data.ttlSeconds).toBe(86400);
      expect(kv.put).toHaveBeenCalledWith(
        "maintenance-message",
        expect.any(String),
        { expirationTtl: 86400 },
      );
    });

    it("rejects empty message", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "" }),
        },
        env(),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects message over 500 characters", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "x".repeat(501) }),
        },
        env(),
      );
      expect(res.status).toBe(400);
    });

    it("respects custom ttlSeconds", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "짧은 점검",
            ttlSeconds: 3600,
          }),
        },
        env(),
      );
      expect(res.status).toBe(200);
      expect(kv.put).toHaveBeenCalledWith(
        "maintenance-message",
        expect.any(String),
        { expirationTtl: 3600 },
      );
    });

    it("rejects invalid ttlSeconds", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "test", ttlSeconds: 10 }),
        },
        env(),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /admin/maintenance", () => {
    it("clears maintenance message", async () => {
      await kv.put("maintenance-message", "some message");
      const res = await app.request(
        "/admin/maintenance",
        { method: "DELETE" },
        env(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as MaintenanceResponse;
      expect(body.data.active).toBe(false);
      expect(kv.delete).toHaveBeenCalledWith("maintenance-message");
    });
  });
});
