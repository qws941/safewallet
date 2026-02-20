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

let mockAuthContext: AuthContext | undefined;

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(
    async (
      c: { set: (k: string, v: unknown) => void },
      next: () => Promise<void>,
    ) => {
      if (mockAuthContext) {
        c.set("auth", mockAuthContext);
      }
      await next();
    },
  ),
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

vi.mock("../../lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockAcquireSyncLock = vi.fn();
const mockReleaseSyncLock = vi.fn();
vi.mock("../../lib/sync-lock", () => ({
  acquireSyncLock: (...args: unknown[]) => mockAcquireSyncLock(...args),
  releaseSyncLock: (...args: unknown[]) => mockReleaseSyncLock(...args),
}));

const mockHmac = vi.fn();
vi.mock("../../lib/crypto", () => ({
  hmac: (...args: unknown[]) => mockHmac(...args),
}));

const mockFasGetEmployeeInfo = vi.fn();
vi.mock("../../lib/fas-mariadb", () => ({
  fasGetEmployeeInfo: (...args: unknown[]) => mockFasGetEmployeeInfo(...args),
}));

const mockSyncSingleFasEmployee = vi.fn();
vi.mock("../../lib/fas-sync", () => ({
  syncSingleFasEmployee: (...args: unknown[]) =>
    mockSyncSingleFasEmployee(...args),
}));

vi.mock("../../utils/common", () => ({
  maskName: (name: string) => {
    if (name.length <= 1) return "*";
    if (name.length === 2) return name[0] + "*";
    return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
  },
}));

vi.mock("../../db/helpers", () => ({
  dbBatchChunked: vi.fn(),
}));

const mockSelectAll = vi.fn();
const mockGet = vi.fn();
const mockLimit = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();

function makeSelectChain() {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: mockGet,
        limit: vi.fn().mockImplementation(() => mockLimit()),
        orderBy: vi.fn().mockImplementation(() => mockSelectAll()),
        then: undefined as unknown,
      }),
      orderBy: vi.fn().mockImplementation(() => mockSelectAll()),
      then: undefined as unknown,
    }),
  };
}

function makeThenableSelectChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = (_resolve: (v: unknown) => void) => {
    _resolve(resolveValue);
  };
  const proxy: unknown = new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") return handler;
      if (
        prop === "from" ||
        prop === "where" ||
        prop === "orderBy" ||
        prop === "limit"
      ) {
        return () => proxy;
      }
      return Reflect.get(target, prop);
    },
  });
  return proxy;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          resolve(undefined);
        };
      }
      if (
        prop === "values" ||
        prop === "onConflictDoNothing" ||
        prop === "returning"
      ) {
        return () => proxy;
      }
      if (prop === "run" || prop === "get") {
        return mockInsertValues;
      }
      return Reflect.get(target, prop);
    },
  });
  return proxy;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          resolve(undefined);
        };
      }
      if (prop === "set" || prop === "where" || prop === "returning") {
        return () => proxy;
      }
      if (prop === "run" || prop === "get") {
        return mockUpdateSet;
      }
      return Reflect.get(target, prop);
    },
  });
  return proxy;
}

const mockDb = {
  select: vi.fn().mockImplementation(() => makeSelectChain()),
  insert: vi.fn().mockImplementation(() => makeInsertChain()),
  update: vi.fn().mockImplementation(() => makeUpdateChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  desc: vi.fn((col: unknown) => col),
  like: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock("../../db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    phone: "phone",
    phoneHash: "phoneHash",
    externalSystem: "externalSystem",
    externalWorkerId: "externalWorkerId",
    companyName: "companyName",
    tradeType: "tradeType",
    role: "role",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../../lib/constants", () => ({
  CROSS_MATCH_DEFAULT_BATCH: 50,
  CROSS_MATCH_MAX_BATCH: 200,
  CROSS_MATCH_CRON_BATCH: 10,
}));

function makeAuth(role = "SUPER_ADMIN", userId = "user-1"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Test Admin",
      nameMasked: "T**n",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

const mockR2Object = {
  json: vi.fn(),
  body: "image-binary-data",
  size: 1024,
  uploaded: new Date("2025-01-01"),
  httpEtag: '"etag-123"',
  httpMetadata: { contentType: "image/jpeg" },
};

const mockBucket = {
  get: vi.fn(),
};

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: {},
    KV: mockKV,
    ACETIME_BUCKET: mockBucket,
    HMAC_SECRET: "test-hmac-secret",
    ENCRYPTION_KEY: "test-encryption-key",
    FAS_HYPERDRIVE: { connectionString: "mysql://test" },
    ...overrides,
  } as Record<string, unknown>;
}

async function createApp(auth?: AuthContext) {
  mockAuthContext = auth;
  const { default: acetimeRoute } = await import("../acetime");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/acetime", acetimeRoute);
  return { app };
}

describe("routes/acetime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = undefined;
    mockAcquireSyncLock.mockResolvedValue({ acquired: true, holder: "test" });
    mockReleaseSyncLock.mockResolvedValue(undefined);
    mockHmac.mockResolvedValue("hashed-phone");
  });

  describe("POST /acetime/sync-db", () => {
    it("returns 401 when not authenticated", async () => {
      const { default: acetimeRoute } = await import("../acetime");
      const testApp = new Hono<AppEnv>();
      testApp.route("/acetime", acetimeRoute);
      const { authMiddleware: mockAuthMw } =
        await import("../../middleware/auth");
      vi.mocked(mockAuthMw).mockImplementationOnce(async () => undefined);
      const env = makeEnv();
      const res = await testApp.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      const auth = makeAuth("WORKER");
      const { app } = await createApp(auth);
      const env = makeEnv();
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 500 when ACETIME_BUCKET is not configured", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);
      const env = makeEnv({ ACETIME_BUCKET: undefined });
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("ACETIME_BUCKET_NOT_CONFIGURED");
    });

    it("returns 404 when R2 JSON is not found", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);
      mockBucket.get.mockResolvedValue(null);
      const env = makeEnv();
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("ACETIME_JSON_NOT_FOUND");
    });

    it("returns 409 when sync lock cannot be acquired", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);
      mockBucket.get.mockResolvedValue(mockR2Object);
      mockR2Object.json.mockResolvedValue({
        employees: [],
        total: 0,
      });
      mockAcquireSyncLock.mockResolvedValue({
        acquired: false,
        holder: "existing-holder",
      });
      const env = makeEnv();
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("creates new employees and updates existing ones", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockBucket.get.mockResolvedValue(mockR2Object);
      mockR2Object.json.mockResolvedValue({
        employees: [
          {
            externalWorkerId: "EMP-001",
            name: "김철수",
            companyName: "건설사A",
            position: "용접공",
            trade: "welding",
            lastSeen: "2025-01-01",
          },
          {
            externalWorkerId: "EMP-002",
            name: "박영희",
            companyName: "건설사B",
            position: "전기공",
            trade: "electrical",
            lastSeen: "2025-01-01",
          },
        ],
        total: 2,
      });

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeThenableSelectChain([
            {
              id: "existing-id",
              externalWorkerId: "EMP-002",
              phoneHash: "real-hash",
              updatedAt: new Date(),
            },
          ]);
        }
        return makeThenableSelectChain([]);
      });

      const env = makeEnv({ FAS_HYPERDRIVE: undefined });
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.sync.extracted).toBe(2);
      expect(body.data.sync.created).toBe(1);
      expect(body.data.sync.updated).toBe(1);
      expect(body.data.fasCrossMatch.available).toBe(false);
      expect(mockReleaseSyncLock).toHaveBeenCalled();
    });

    it("performs FAS cross-matching when Hyperdrive is available", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockBucket.get.mockResolvedValue(mockR2Object);
      mockR2Object.json.mockResolvedValue({
        employees: [],
        total: 0,
      });

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeThenableSelectChain([]);
        }
        return makeThenableSelectChain([
          {
            id: "placeholder-user-1",
            externalWorkerId: "EMP-100",
            phoneHash: "acetime-hash",
          },
        ]);
      });

      mockFasGetEmployeeInfo.mockResolvedValue({
        phone: "010-1234-5678",
        name: "테스트",
      });
      mockSyncSingleFasEmployee.mockResolvedValue(undefined);

      const env = makeEnv();
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.fasCrossMatch.available).toBe(true);
      expect(body.data.fasCrossMatch.matched).toBe(1);
      expect(mockFasGetEmployeeInfo).toHaveBeenCalledWith(
        expect.anything(),
        "EMP-100",
      );
    });

    it("releases sync lock even on error", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockBucket.get.mockResolvedValue(mockR2Object);
      mockR2Object.json.mockResolvedValue({
        employees: [{ externalWorkerId: "EMP-ERR", name: "에러" }],
        total: 1,
      });

      mockDb.select.mockImplementation(() => {
        return makeThenableSelectChain([]);
      });

      mockHmac.mockRejectedValue(new Error("hmac failure"));

      const env = makeEnv({ FAS_HYPERDRIVE: undefined });
      const res = await app.request(
        "/acetime/sync-db",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
      expect(mockReleaseSyncLock).toHaveBeenCalled();
    });
  });

  describe("POST /acetime/fas-cross-match", () => {
    it("returns 403 for non-admin users", async () => {
      const auth = makeAuth("WORKER");
      const { app } = await createApp(auth);
      const env = makeEnv();
      const res = await app.request(
        "/acetime/fas-cross-match",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 500 when FAS_HYPERDRIVE is not configured", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);
      const env = makeEnv({ FAS_HYPERDRIVE: undefined });
      const res = await app.request(
        "/acetime/fas-cross-match",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("FAS_HYPERDRIVE_NOT_CONFIGURED");
    });

    it("cross-matches placeholder users from FAS", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockDb.select.mockImplementation(() => {
        return makeThenableSelectChain([
          { id: "user-1", externalWorkerId: "EMP-100", name: "김테스트" },
        ]);
      });

      mockFasGetEmployeeInfo.mockResolvedValue({
        phone: "010-1111-2222",
        name: "김테스트",
      });
      mockSyncSingleFasEmployee.mockResolvedValue(undefined);

      const env = makeEnv();
      const res = await app.request(
        "/acetime/fas-cross-match",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.results.matched).toBe(1);
      expect(body.data.matchedNames).toContain("김테스트");
    });

    it("skips users without externalWorkerId", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockDb.select.mockImplementation(() => {
        return makeThenableSelectChain([
          { id: "user-1", externalWorkerId: null, name: "노ID" },
        ]);
      });

      const env = makeEnv();
      const res = await app.request(
        "/acetime/fas-cross-match",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.results.skipped).toBe(1);
      expect(body.data.results.matched).toBe(0);
    });

    it("returns empty results when no placeholder users exist", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockDb.select.mockImplementation(() => {
        return makeThenableSelectChain([]);
      });

      const env = makeEnv();
      const res = await app.request(
        "/acetime/fas-cross-match",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.results.matched).toBe(0);
      expect(body.data.batch.processed).toBe(0);
    });
  });

  describe("GET /acetime/photo/:employeeId", () => {
    it("returns 500 when ACETIME_BUCKET is not configured", async () => {
      const auth = makeAuth("WORKER");
      const { app } = await createApp(auth);
      const env = makeEnv({ ACETIME_BUCKET: undefined });
      const res = await app.request("/acetime/photo/EMP-001", {}, env);
      expect(res.status).toBe(500);
    });

    it("returns 404 when photo is not found", async () => {
      const auth = makeAuth("WORKER");
      const { app } = await createApp(auth);
      mockBucket.get.mockResolvedValue(null);
      const env = makeEnv();
      const res = await app.request("/acetime/photo/EMP-001", {}, env);
      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("PHOTO_NOT_FOUND");
    });

    it("returns photo with correct headers", async () => {
      const auth = makeAuth("WORKER");
      const { app } = await createApp(auth);
      mockBucket.get.mockResolvedValue(mockR2Object);
      const env = makeEnv();
      const res = await app.request("/acetime/photo/EMP-001", {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
      expect(mockBucket.get).toHaveBeenCalledWith("picture/EMP-001.jpg");
    });
  });

  describe("GET /acetime/employees", () => {
    it("returns 403 for non-admin users", async () => {
      const auth = makeAuth("WORKER");
      const { app } = await createApp(auth);
      const env = makeEnv();
      const res = await app.request("/acetime/employees", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns employee list with profile image URLs", async () => {
      const auth = makeAuth("SUPER_ADMIN");
      const { app } = await createApp(auth);

      mockDb.select.mockImplementation(() => {
        return makeThenableSelectChain([
          {
            id: "user-1",
            name: "김철수",
            nameMasked: "김*수",
            externalWorkerId: "EMP-001",
          },
          {
            id: "user-2",
            name: "박영희",
            nameMasked: "박*희",
            externalWorkerId: null,
          },
        ]);
      });

      const env = makeEnv();
      const res = await app.request("/acetime/employees", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.employees).toHaveLength(2);
      const employees = body.data.employees as unknown as Record<
        string,
        unknown
      >[];
      expect(employees[0].profileImageUrl).toBe("picture/EMP-001.jpg");
      expect(employees[1].profileImageUrl).toBeNull();
    });

    it("works for ADMIN role too", async () => {
      const auth = makeAuth("ADMIN");
      const { app } = await createApp(auth);

      mockDb.select.mockImplementation(() => {
        return makeThenableSelectChain([]);
      });

      const env = makeEnv();
      const res = await app.request("/acetime/employees", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.employees).toHaveLength(0);
    });

    it("works for ADMIN role too", async () => {
      const auth = makeAuth("ADMIN");
      const { app } = await createApp(auth);

      mockSelectAll.mockReturnValue([]);

      const env = makeEnv();
      const res = await app.request("/acetime/employees", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.employees).toHaveLength(0);
    });
  });
});
