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

const fixedStart = new Date("2026-02-19T05:00:00.000Z");
const fixedEnd = new Date("2026-02-20T05:00:00.000Z");
const mockGetTodayRange = vi.fn(() => ({
  start: fixedStart,
  end: fixedEnd,
}));

vi.mock("../helpers", () => ({
  requireAdmin: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  getTodayRange: mockGetTodayRange,
}));

const mockGet = vi.fn();
const mockAll = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.leftJoin = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.orderBy = vi.fn(proxy);
  chain.groupBy = vi.fn(proxy);
  chain.limit = vi.fn(proxy);
  chain.offset = vi.fn(proxy);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  users: { id: "id" },
  sites: { id: "id" },
  posts: {
    id: "id",
    category: "category",
    reviewStatus: "reviewStatus",
    isUrgent: "isUrgent",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  attendance: { checkinAt: "checkinAt" },
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
  const { default: statsRoute } = await import("../stats");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", statsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeChain());
  });

  describe("GET /stats", () => {
    it("returns dashboard stats", async () => {
      mockGet.mockResolvedValue({ count: 10, avgHours: 2.5 });
      mockAll.mockResolvedValue([
        { category: "HAZARD", count: 5 },
        { category: "SAFETY", count: 3 },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: Record<string, unknown> };
      };
      expect(body.data.stats).toBeDefined();
      expect(body.data.stats.totalUsers).toBeDefined();
      expect(body.data.stats.categoryDistribution).toBeDefined();
      expect(mockGetTodayRange).toHaveBeenCalledTimes(1);
      expect(gte).toHaveBeenCalledWith("checkinAt", fixedStart);
      expect(lt).toHaveBeenCalledWith("checkinAt", fixedEnd);
      expect(gte).toHaveBeenCalledWith("createdAt", fixedStart);
      expect(lt).toHaveBeenCalledWith("createdAt", fixedEnd);
    });

    it("handles empty data gracefully", async () => {
      mockGet.mockResolvedValue(null);
      mockAll.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: Record<string, unknown> };
      };
      expect(body.data.stats.totalUsers).toBe(0);
    });
  });
});
