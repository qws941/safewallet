import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(async () => {}),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockInsertGet = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.leftJoin = vi.fn(proxy);
  chain.innerJoin = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.orderBy = vi.fn(proxy);
  chain.groupBy = vi.fn(proxy);
  chain.having = vi.fn(proxy);
  chain.limit = vi.fn(proxy);
  chain.offset = vi.fn(proxy);
  chain.as = vi.fn(() => "subquery");
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => ({
        get: mockInsertGet,
      })),
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  pointsLedger: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    settleMonth: "settleMonth",
    adminId: "adminId",
    createdAt: "createdAt",
  },
  pointPolicies: {
    id: "id",
    siteId: "siteId",
    reasonCode: "reasonCode",
    isActive: "isActive",
    defaultAmount: "defaultAmount",
  },
  sites: { id: "id", leaderboardEnabled: "leaderboardEnabled" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
    role: "role",
  },
  users: { id: "id", nameMasked: "nameMasked" },
}));

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

function makeAuth(role = "SUPER_ADMIN", userId = "user-1"): AuthContext {
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

async function createApp(auth?: AuthContext) {
  const { default: pointsRoute } = await import("../points");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/points", pointsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

const SITE_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";

describe("routes/points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeChain());
    mockDb.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockInsertGet,
        })),
      })),
    }));
  });

  describe("POST /points/award", () => {
    const validBody = {
      userId: USER_ID,
      siteId: SITE_ID,
      amount: 100,
      reasonCode: "MANUAL_AWARD",
    };

    it("awards points as SUPER_ADMIN", async () => {
      mockGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: USER_ID, status: "ACTIVE" })
        .mockResolvedValueOnce({ defaultAmount: 50 })
        .mockResolvedValueOnce({ id: USER_ID, nameMasked: "Te**" });
      mockInsertGet.mockResolvedValue({
        id: "entry-1",
        ...validBody,
        amount: 50,
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 403 for non-admin worker", async () => {
      mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 100 }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /points/balance", () => {
    it("returns balance for site member", async () => {
      const getMock1 = vi
        .fn()
        .mockResolvedValue({ userId: "user-1", status: "ACTIVE" });
      const getMock2 = vi.fn().mockResolvedValue({ total: 250 });
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        const chain: Record<string, unknown> = {};
        const proxy = (): Record<string, unknown> => chain;
        chain.from = vi.fn(proxy);
        chain.leftJoin = vi.fn(proxy);
        chain.innerJoin = vi.fn(proxy);
        chain.where = vi.fn(proxy);
        chain.orderBy = vi.fn(proxy);
        chain.groupBy = vi.fn(proxy);
        chain.having = vi.fn(proxy);
        chain.limit = vi.fn(proxy);
        chain.offset = vi.fn(proxy);
        chain.as = vi.fn(() => "subquery");
        chain.get = selectCallCount === 1 ? getMock1 : getMock2;
        chain.all = mockAll;
        return chain;
      });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/balance?siteId=${SITE_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { balance: number } };
      expect(body.data.balance).toBe(250);
    });

    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/points/balance", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-member", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/balance?siteId=${SITE_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /points/history", () => {
    it("returns own history", async () => {
      mockAll.mockResolvedValue([
        { id: "e1", amount: 100, reasonCode: "SAFETY" },
      ]);
      mockGet.mockResolvedValue({ count: 1 });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/points/history", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { entries: unknown[]; total: number };
      };
      expect(body.data.entries).toHaveLength(1);
    });

    it("returns 400 for non-admin viewing other user without siteId", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/history?userId=${USER_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /points/leaderboard/:siteId", () => {
    it("returns leaderboard for site with leaderboard enabled", async () => {
      mockGet
        .mockResolvedValueOnce({ leaderboardEnabled: true })
        .mockResolvedValueOnce({ userId: "user-1", status: "ACTIVE" });
      mockAll
        .mockResolvedValueOnce([
          { userId: "user-1", total: 500 },
          { userId: "user-2", total: 300 },
        ])
        .mockResolvedValueOnce([
          { id: "user-1", nameMasked: "Te**" },
          { id: "user-2", nameMasked: "Us**" },
        ]);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { leaderboard: unknown[] } };
      expect(body.data.leaderboard).toHaveLength(2);
    });

    it("returns 404 when site not found", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 for non-member when leaderboard disabled", async () => {
      mockGet
        .mockResolvedValueOnce({ leaderboardEnabled: false })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(403);
    });
  });
});
