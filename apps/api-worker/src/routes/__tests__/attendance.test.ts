import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

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

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../middleware/fas-auth", () => ({
  fasAuthMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("@hono/zod-validator", () => ({
  zValidator: () => {
    return async (_c: unknown, next: () => Promise<void>) => {
      await next();
    };
  },
}));

const mockGetQueue: unknown[] = [];
const mockAllQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : undefined;
}

function dequeueAll() {
  return mockAllQueue.length > 0 ? mockAllQueue.shift() : [];
}

function makeSelectChain() {
  const deferred = () => Promise.resolve(dequeueAll());
  const chain = Object.assign(deferred(), {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    get: vi.fn(() => dequeueGet()),
    all: vi.fn(() => dequeueAll()),
    as: vi.fn(),
    groupBy: vi.fn(),
  });
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.as.mockReturnValue(chain);
  chain.groupBy.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.get = vi.fn(() => undefined);
  chain.run = vi.fn(async () => ({ success: true }));
  chain.onConflictDoNothing = vi.fn(() => chain);
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/helpers", () => ({
  dbBatchChunked: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  attendance: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    externalWorkerId: "externalWorkerId",
    result: "result",
    source: "source",
    checkinAt: "checkinAt",
  },
  users: {
    id: "id",
    externalWorkerId: "externalWorkerId",
  },
}));

vi.mock("../../utils/common", () => ({
  getTodayRange: vi.fn(() => ({
    start: new Date("2025-01-01T00:00:00Z"),
    end: new Date("2025-01-02T00:00:00Z"),
  })),
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

const mockKvGet = vi.fn();
const mockKvPut = vi.fn();

async function createApp(auth?: AuthContext) {
  const { default: attendanceRoute } = await import("../attendance");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/attendance", attendanceRoute);
  const env = {
    DB: {},
    KV: { get: mockKvGet, put: mockKvPut },
  } as Record<string, unknown>;
  return { app, env };
}

describe("routes/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
  });

  describe("GET /attendance/today", () => {
    it("returns attendance records for today", async () => {
      const records = [
        {
          id: "a1",
          result: "SUCCESS",
          source: "FAS",
          checkinAt: new Date("2025-01-01T08:00:00Z"),
        },
      ];
      mockAllQueue.push(records);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(true);
      expect(body.data.records).toHaveLength(1);
    });

    it("returns hasAttendance=false when no SUCCESS records", async () => {
      mockAllQueue.push([
        { id: "a1", result: "NOT_FOUND", source: "FAS", checkinAt: new Date() },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(false);
    });

    it("returns empty when no records", async () => {
      mockAllQueue.push([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(false);
      expect(body.data.records).toHaveLength(0);
    });
  });

  describe("POST /attendance/sync", () => {
    it("returns 400 for missing events array", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("inserts new attendance events successfully", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          processed: number;
          inserted: number;
          skipped: number;
          failed: number;
        };
      };
      expect(body.data.processed).toBe(1);
      expect(body.data.inserted).toBe(1);
      expect(body.data.skipped).toBe(0);
      expect(body.data.failed).toBe(0);
    });

    it("skips duplicate attendance events", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      const checkinTime = new Date("2025-01-01T08:00:00Z");
      mockAllQueue.push([
        {
          workerId: "FAS-001",
          siteId: "site-1",
          checkinAt: checkinTime,
        },
      ]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: checkinTime.toISOString(),
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { inserted: number; skipped: number };
      };
      expect(body.data.skipped).toBe(1);
      expect(body.data.inserted).toBe(0);
    });

    it("fails when user not found for fasUserId", async () => {
      mockAllQueue.push([]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "NONEXISTENT",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          failed: number;
          results: Array<{ fasEventId: string; result: string }>;
        };
      };
      expect(body.data.failed).toBe(1);
      expect(body.data.results[0].result).toBe("NOT_FOUND");
    });

    it("fails when event has no siteId", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          failed: number;
          results: Array<{ fasEventId: string; result: string }>;
        };
      };
      expect(body.data.failed).toBe(1);
      expect(body.data.results[0].result).toBe("MISSING_SITE");
    });

    it("returns cached response for duplicate idempotency key", async () => {
      const cached = {
        processed: 1,
        inserted: 1,
        skipped: 0,
        failed: 0,
        results: [],
      };
      mockKvGet.mockResolvedValue(JSON.stringify(cached));

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-123",
          },
          body: JSON.stringify({ events: [] }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: typeof cached };
      expect(body.data.processed).toBe(1);
    });

    it("stores response in KV when idempotency key is provided", async () => {
      mockKvGet.mockResolvedValue(null);
      mockAllQueue.push([]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-new",
          },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "NONEXISTENT",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(mockKvPut).toHaveBeenCalledWith(
        "attendance:idempotency:idem-new",
        expect.any(String),
        { expirationTtl: 3600 },
      );
    });

    it("handles batch insert failure gracefully", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked).mockRejectedValueOnce(
        new Error("DB batch error"),
      );

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { failed: number };
      };
      expect(body.data.failed).toBe(1);
    });

    it("handles multiple events with mixed results", async () => {
      mockAllQueue.push([
        { id: "user-1", externalWorkerId: "FAS-001" },
        { id: "user-2", externalWorkerId: "FAS-002" },
      ]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
              {
                fasEventId: "evt-2",
                fasUserId: "FAS-002",
                checkinAt: "2025-01-01T09:00:00Z",
              },
              {
                fasEventId: "evt-3",
                fasUserId: "UNKNOWN",
                checkinAt: "2025-01-01T10:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          processed: number;
          inserted: number;
          failed: number;
          results: Array<{ fasEventId: string; result: string }>;
        };
      };
      expect(body.data.processed).toBe(3);
      expect(body.data.inserted).toBe(1);
      expect(body.data.failed).toBe(2);
    });
  });
});
