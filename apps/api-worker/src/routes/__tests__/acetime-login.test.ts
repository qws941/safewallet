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

vi.mock("../../middleware/rate-limit", () => ({
  authRateLimitMiddleware: () =>
    vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          raw: Request;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      const cloned = c.req.raw.clone();
      try {
        const body = await cloned.json();
        c.req.addValidatedData("json", body);
      } catch {
        c.req.addValidatedData("json", {});
      }
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockInsertValues = vi.fn();
const mockLimit = vi.fn();

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn((...args: unknown[]) => mockLimit(...args));
  chain.offset = vi.fn(self);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.values = mockInsertValues.mockReturnValue(chain);
  chain.returning = vi.fn(self);
  chain.onConflictDoNothing = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    phone: "phone",
    phoneHash: "phoneHash",
    phoneEncrypted: "phoneEncrypted",
    dobHash: "dobHash",
    dobEncrypted: "dobEncrypted",
    role: "role",
    refreshToken: "refreshToken",
    refreshTokenExpiresAt: "refreshTokenExpiresAt",
    piiViewFull: "piiViewFull",
    externalSystem: "externalSystem",
    externalWorkerId: "externalWorkerId",
  },
  attendance: {
    id: "id",
    userId: "userId",
    result: "result",
    checkinAt: "checkinAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  auditLogs: { id: "id", action: "action", actorId: "actorId" },
  deviceRegistrations: { id: "id", userId: "userId", deviceId: "deviceId" },
}));

vi.mock("../../lib/crypto", () => ({
  hmac: vi.fn(async () => "hashed"),
  encrypt: vi.fn(async () => "encrypted"),
  decrypt: vi.fn(async () => "01012345678"),
  verifyPassword: vi.fn(async () => false),
}));

vi.mock("../../lib/jwt", () => ({
  signJwt: vi.fn(async () => "mock-jwt-token"),
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
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

vi.mock("../../lib/fas-mariadb", () => ({
  fasSearchEmployeeByPhone: vi.fn(async () => null),
  fasGetEmployeeInfo: vi.fn(async () => null),
}));

vi.mock("../../lib/fas-sync", () => ({
  syncSingleFasEmployee: vi.fn(async () => null),
  socialNoToDob: vi.fn(() => null),
}));

vi.mock("../../lib/device-registrations", () => ({
  checkDeviceRegistrationLimit: vi.fn(async () => ({ allowed: true })),
  normalizeDeviceId: vi.fn((id: unknown) => id || null),
  recordDeviceRegistration: vi.fn(),
}));

const mockCheckRateLimit =
  vi.fn<
    (
      env: unknown,
      key: string,
      max: number,
      windowMs: number,
    ) => Promise<{ allowed: boolean }>
  >();
mockCheckRateLimit.mockResolvedValue({ allowed: true });
vi.mock("../../lib/rate-limit", () => ({
  checkRateLimit: (
    ...args: [env: unknown, key: string, max: number, windowMs: number]
  ) => mockCheckRateLimit(...args),
}));

vi.mock("../../utils/common", () => ({
  getTodayRange: () => ({
    start: "2025-01-01T00:00:00Z",
    end: "2025-01-02T00:00:00Z",
  }),
  maskName: (name: string) =>
    name.length > 1 ? name[0] + "*".repeat(name.length - 1) : name,
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

const mockKv = {
  get: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue(null),
  put: vi.fn(),
  delete: vi.fn(),
};

async function createApp() {
  const { default: route } = await import("../auth");
  const app = new Hono<AppEnv>();
  app.route("/", route);
  const env = {
    DB: {},
    KV: mockKv,
    HMAC_SECRET: "secret",
    ENCRYPTION_KEY: "enc-key",
    JWT_SECRET: "jwt-secret",
    REQUIRE_ATTENDANCE_FOR_LOGIN: "false",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "password123",
  } as Record<string, unknown>;
  return { app, env };
}

function makeAcetimeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "acetime-user-1",
    name: "김선민",
    nameMasked: "김*민",
    phone: "",
    phoneHash: "acetime-abc123",
    phoneEncrypted: null,
    dobHash: null,
    dobEncrypted: null,
    role: "WORKER",
    externalSystem: "FAS",
    externalWorkerId: "25000002",
    refreshToken: null,
    refreshTokenExpiresAt: null,
    piiViewFull: false,
    ...overrides,
  };
}

function postAcetimeLogin(
  app: Hono<AppEnv>,
  body: Record<string, unknown>,
  env: Record<string, unknown>,
) {
  return app.request(
    "/acetime-login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("POST /acetime-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockLimit.mockReturnValue([]);
    mockKv.get.mockResolvedValue(null);
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns 400 for missing employeeCode", async () => {
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(app, { name: "김선민" }, env);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing name", async () => {
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(app, { employeeCode: "25000002" }, env);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty fields", async () => {
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "", name: "" },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when user is not found", async () => {
    mockLimit.mockReturnValue([]);
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "99999999", name: "없는사람" },
      env,
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("USER_NOT_FOUND");
  });

  it("returns 401 when name does not match", async () => {
    const user = makeAcetimeUser();
    mockLimit.mockReturnValueOnce([user]);
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "잘못된이름" },
      env,
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("NAME_MISMATCH");
  });

  it("succeeds with correct employeeCode and name (attendance disabled)", async () => {
    const user = makeAcetimeUser();
    mockLimit.mockReturnValueOnce([user]);
    mockGet.mockResolvedValueOnce(null);
    mockRun.mockResolvedValue(undefined);

    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "김선민" },
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        accessToken: string;
        user: { id: string; phone: string; name: string };
      };
    };
    expect(json.data.accessToken).toBe("mock-jwt-token");
    expect(json.data.user.id).toBe("acetime-user-1");
    expect(json.data.user.phone).toBe("");
    expect(json.data.user.name).toBe("김선민");
  });

  it("matches name case-insensitively", async () => {
    const user = makeAcetimeUser({ name: "Kim Worker" });
    mockLimit.mockReturnValueOnce([user]);
    mockGet.mockResolvedValueOnce(null);
    mockRun.mockResolvedValue(undefined);

    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "kim worker" },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("trims whitespace from name before comparison", async () => {
    const user = makeAcetimeUser();
    mockLimit.mockReturnValueOnce([user]);
    mockGet.mockResolvedValueOnce(null);
    mockRun.mockResolvedValue(undefined);

    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "  김선민  " },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "김선민" },
      env,
    );
    expect(res.status).toBe(429);
  });

  it("returns 403 when attendance is required but not found", async () => {
    const user = makeAcetimeUser();
    mockLimit.mockReturnValueOnce([user]).mockReturnValueOnce([]);

    const { app, env } = await createApp();
    env.REQUIRE_ATTENDANCE_FOR_LOGIN = "true";
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "김선민" },
      env,
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("ATTENDANCE_NOT_VERIFIED");
  });

  it("succeeds when attendance is required and found", async () => {
    const user = makeAcetimeUser();
    mockLimit.mockReturnValueOnce([user]).mockReturnValueOnce([
      {
        id: "att-1",
        userId: "acetime-user-1",
        result: "SUCCESS",
        checkinAt: "2025-01-01T08:00:00Z",
      },
    ]);
    mockGet.mockResolvedValueOnce(null);
    mockRun.mockResolvedValue(undefined);

    const { app, env } = await createApp();
    env.REQUIRE_ATTENDANCE_FOR_LOGIN = "true";
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "김선민" },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("returns locked response when account is locked", async () => {
    const lockedUntil = Date.now() + 30 * 60 * 1000;
    mockKv.get.mockResolvedValueOnce(
      JSON.stringify({
        attempts: 5,
        firstAttemptAt: Date.now() - 60000,
        lockedUntil,
      }),
    );
    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "김선민" },
      env,
    );
    const json = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(429);
    expect(json.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("clears lockout on successful login", async () => {
    const user = makeAcetimeUser();
    mockLimit.mockReturnValueOnce([user]);
    mockGet.mockResolvedValueOnce(null);
    mockRun.mockResolvedValue(undefined);

    const { app, env } = await createApp();
    const res = await postAcetimeLogin(
      app,
      { employeeCode: "25000002", name: "김선민" },
      env,
    );
    expect(res.status).toBe(200);
    expect(mockKv.delete).toHaveBeenCalled();
  });
});
