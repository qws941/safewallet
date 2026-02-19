import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (
    _target: string,
    schema: {
      safeParse: (data: unknown) => { success: boolean; data?: unknown };
    },
  ) => {
    return async (
      c: {
        req: {
          json: () => Promise<unknown>;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      const body = await c.req.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Validation failed" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      c.req.addValidatedData("json", result.data);
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockDeleteWhere = vi.fn();
let selectCallCount = 0;

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
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
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = mockUpdateSet.mockReturnValue(chain);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.where = mockDeleteWhere.mockReturnValue(chain);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
  delete: vi.fn(() => makeDeleteChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
  gte: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    role: "role",
    phoneHash: "phoneHash",
    phoneEncrypted: "phoneEncrypted",
    dobEncrypted: "dobEncrypted",
    falseReportCount: "falseReportCount",
    restrictedUntil: "restrictedUntil",
    piiViewFull: "piiViewFull",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
  },
  auditLogs: {
    id: "id",
    action: "action",
    actorId: "actorId",
    targetType: "targetType",
    targetId: "targetId",
    reason: "reason",
  },
  userRoleEnum: ["WORKER", "SITE_ADMIN", "SUPER_ADMIN", "SYSTEM"],
  posts: { id: "id", userId: "userId" },
  postImages: { postId: "postId", fileUrl: "fileUrl" },
  reviews: { postId: "postId" },
  pointsLedger: { postId: "postId" },
  siteMemberships: { id: "id", userId: "userId" },
}));

vi.mock("../../../lib/crypto", () => ({
  decrypt: vi.fn(async () => "decrypted"),
  hmac: vi.fn(async () => "hashed-phone"),
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
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
  const { default: route } = await import("../users");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = {
    DB: {},
    KV: { delete: vi.fn() },
    R2: { delete: vi.fn() },
    HMAC_SECRET: "secret",
    ENCRYPTION_KEY: "enc-key",
    RATE_LIMITER: null,
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockDb.delete.mockImplementation(() => makeDeleteChain());
  });

  describe("GET /unlock-user/:phoneHash", () => {
    it("unlocks user by phoneHash", async () => {
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/unlock-user/abc123", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { unlocked: boolean } };
      expect(body.data.unlocked).toBe(true);
    });

    it("returns 403 for WORKER", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/unlock-user/abc123", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /unlock-user-by-phone", () => {
    it("unlocks user by phone number", async () => {
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/unlock-user-by-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "010-1234-5678" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      // Reset persistent mockDb.select implementation to avoid leaking into subsequent tests
      mockDb.select.mockImplementation(() => makeSelectChain());
    });

    it("returns 400 when changing own role", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/admin-1/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "WORKER" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /users/:id/emergency-purge", () => {
    it("purges user with posts, images, and memberships", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-target",
        name: "Kim",
        deletedAt: null,
      });
      mockAll.mockResolvedValueOnce([{ id: "p1" }]);
      mockAll.mockResolvedValueOnce([
        { fileUrl: "img1.jpg" },
        { fileUrl: "img2.jpg" },
      ]);

      const membershipResult = [{ id: "m1" }, { id: "m2" }];
      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue(membershipResult);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-target/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Legal compliance",
            confirmUserId: "u-target",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          purged: boolean;
          purgedPosts: number;
          purgedImages: number;
          purgedMemberships: number;
        };
      };
      expect(body.data.purged).toBe(true);
      expect(body.data.purgedPosts).toBe(1);
      expect(body.data.purgedImages).toBe(2);
      expect(body.data.purgedMemberships).toBe(2);
    });

    it("purges user with no posts", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-empty",
        name: "Lee",
        deletedAt: null,
      });
      mockAll.mockResolvedValueOnce([]);

      const membershipResult: unknown[] = [];
      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue(membershipResult);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-empty/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "User requested deletion",
            confirmUserId: "u-empty",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { purged: boolean; purgedPosts: number };
      };
      expect(body.data.purged).toBe(true);
      expect(body.data.purgedPosts).toBe(0);
    });

    it("returns 403 for non-SUPER_ADMIN", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/users/u-target/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for non-admin",
            confirmUserId: "u-target",
          }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when confirmUserId does not match", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-target/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for wrong ID",
            confirmUserId: "WRONG_ID",
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/nonexistent/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for missing user",
            confirmUserId: "nonexistent",
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 410 when user already purged", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-purged",
        name: "[긴급삭제]",
        deletedAt: new Date("2025-01-01"),
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-purged/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for already purged",
            confirmUserId: "u-purged",
          }),
        },
        env,
      );

      expect(res.status).toBe(410);
    });
  });
});
