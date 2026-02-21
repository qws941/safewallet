import { Hono } from "hono";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock auth middleware
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

// Mock audit
vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

import sitesRoute from "../sites";
import type { Env, AuthContext } from "../../types";

const mockGetQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : null;
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => []);
  return chain;
}

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockUpdateRun = vi.fn().mockResolvedValue({ success: true });

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockUpdateRun,
        returning: vi.fn(() => ({
          get: vi.fn(() => dequeueGet()),
        })),
      })),
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

function makeAuth(role = "WORKER", userId = "user-1"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Test",
      nameMasked: "Te**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

function createApp(auth: AuthContext | null) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/sites", sitesRoute);

  const env = {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        raw: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ results: [] }),
      })),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn(),
      dump: vi.fn(),
    },
  } as unknown as Env;

  return { app, env };
}

describe("sites route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
  });

  // ---------- GET / ----------

  describe("GET /", () => {
    it("returns 200 for ADMIN with empty site list", async () => {
      const { app, env } = createApp(makeAuth("ADMIN"));
      const res = await app.request("http://localhost/sites", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns 200 for WORKER with empty membership list", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request("http://localhost/sites", {}, env);
      expect(res.status).toBe(200);
    });
  });

  // ---------- GET /:id ----------

  describe("GET /:id", () => {
    it("returns 404 when site not found", async () => {
      const { app, env } = createApp(makeAuth("ADMIN"));
      const res = await app.request("http://localhost/sites/site-1", {}, env);
      expect(res.status).toBe(404);
    });
  });

  // ---------- POST / ----------

  describe("POST /", () => {
    it("returns 403 for non-ADMIN creating a site", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Site" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 for SITE_ADMIN creating a site", async () => {
      const { app, env } = createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "http://localhost/sites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Site" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  // ---------- PATCH /:id ----------

  describe("PATCH /:id", () => {
    it("returns 403 for WORKER updating site", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  // ---------- POST /:id/leave ----------

  describe("POST /:id/regenerate-code", () => {
    it("returns 403 for ADMIN (super admin only)", async () => {
      const { app, env } = createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "http://localhost/sites/site-1/regenerate-code",
        {
          method: "POST",
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 when site not found", async () => {
      const { app, env } = createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "http://localhost/sites/site-1/regenerate-code",
        {
          method: "POST",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("regenerates join code for SUPER_ADMIN", async () => {
      mockGetQueue.push(
        { id: "site-1", joinCode: "OLDCODE1" },
        { id: "site-1", joinCode: "NEWCODE1" },
      );
      const { app, env } = createApp(makeAuth("SUPER_ADMIN"));

      const res = await app.request(
        "http://localhost/sites/site-1/regenerate-code",
        {
          method: "POST",
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { site: { id: string; joinCode: string } };
      };
      expect(body.success).toBe(true);
      expect(body.data.site.id).toBe("site-1");
      expect(mockInsertValues).toHaveBeenCalled();
    });
  });

  describe("POST /:id/leave", () => {
    it("returns 404 when membership not found", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when SITE_ADMIN tries to leave", async () => {
      mockGetQueue.push({
        id: "membership-1",
        role: "SITE_ADMIN",
        status: "ACTIVE",
      });
      const { app, env } = createApp(makeAuth("SITE_ADMIN"));

      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "handover" }),
        },
        env,
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("ADMIN_CANNOT_LEAVE");
    });

    it("allows WORKER to leave active membership", async () => {
      mockGetQueue.push({
        id: "membership-2",
        role: "WORKER",
        status: "ACTIVE",
      });
      const { app, env } = createApp(makeAuth("WORKER"));

      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "transferred" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { message: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.message).toContain("탈퇴");
      expect(mockUpdateRun).toHaveBeenCalled();
    });
  });
});
