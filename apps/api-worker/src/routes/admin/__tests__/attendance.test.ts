import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { gte, lt } from "drizzle-orm";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

const mockGet = vi.fn();
let thenableResults: unknown[] = [];
let thenableIndex = 0;
let selectCallCount = 0;

function makeChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.offset = vi.fn(self);
  chain.get = mockGet;
  return chain;
}

function makeThenableChain(): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        const result = thenableResults[thenableIndex] ?? [];
        thenableIndex++;
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

const mockDb = {
  select: vi.fn(() => makeThenableChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  attendance: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    externalWorkerId: "externalWorkerId",
    checkinAt: "checkinAt",
    result: "result",
    source: "source",
    createdAt: "createdAt",
  },
  users: { id: "id", nameMasked: "nameMasked" },
  sites: { id: "id", name: "name" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

interface AuthContext {
  user: {
    id: string;
    phone: string;
    role: string;
    name: string;
    nameMasked: string;
  };
  loginDate: string;
}

function makeAuth(role = "SUPER_ADMIN"): AuthContext {
  return {
    user: {
      id: "admin-1",
      name: "Admin",
      nameMasked: "Ad**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: attendanceRoute } = await import("../attendance");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", attendanceRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thenableIndex = 0;
    thenableResults = [];
    selectCallCount = 0;
    mockDb.select.mockImplementation(() => makeThenableChain());
  });

  describe("GET /attendance-logs", () => {
    it("returns attendance logs with pagination", async () => {
      thenableResults = [
        [{ count: 1 }],
        [{ id: "a-1", siteId: "site-1", userName: "Kim**" }],
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { logs: unknown[]; pagination: { total: number } };
      };
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.pagination.total).toBe(1);
    });

    it("returns 400 when siteId is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance-logs", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 403 for WORKER role", async () => {
      selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          const chain = makeChain();
          mockGet.mockResolvedValueOnce(null);
          return chain;
        }
        return makeThenableChain();
      });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("applies KST date range filter when date is provided", async () => {
      thenableResults = [
        [{ count: 1 }],
        [{ id: "a-1", siteId: "site-1", userName: "Kim**" }],
      ];
      const { app, env } = await createApp(makeAuth());

      const res = await app.request(
        "/attendance-logs?siteId=site-1&date=2026-02-20",
        {},
        env,
      );

      expect(res.status).toBe(200);
      expect(gte).toHaveBeenCalledWith(
        "checkinAt",
        new Date("2026-02-19T15:00:00.000Z"),
      );
      expect(lt).toHaveBeenCalledWith(
        "checkinAt",
        new Date("2026-02-20T15:00:00.000Z"),
      );
    });
  });

  describe("GET /attendance/unmatched", () => {
    it("returns unmatched attendance records", async () => {
      thenableResults = [
        [{ count: 2 }],
        [
          { id: "u-1", externalWorkerId: "EXT-001" },
          { id: "u-2", externalWorkerId: "EXT-002" },
        ],
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { records: unknown[]; pagination: { total: number } };
      };
      expect(body.data.records).toHaveLength(2);
      expect(body.data.pagination.total).toBe(2);
    });

    it("returns 400 when siteId is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/unmatched", {}, env);
      expect(res.status).toBe(400);
    });
  });
});
