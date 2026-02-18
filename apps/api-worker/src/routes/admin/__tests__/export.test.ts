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

let selectResult: unknown = [];

function makeChain(): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(selectResult);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
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
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    phoneEncrypted: "phoneEncrypted",
    role: "role",
    createdAt: "createdAt",
  },
  posts: {
    id: "id",
    content: "content",
    category: "category",
    reviewStatus: "reviewStatus",
    userId: "userId",
    createdAt: "createdAt",
  },
}));

vi.mock("../../../validators/export", () => ({
  ExportUsersQuerySchema: {
    safeParse: vi.fn(() => ({ success: true, data: { page: 1 } })),
  },
  ExportPostsQuerySchema: {
    safeParse: vi.fn(() => ({ success: true, data: { page: 1 } })),
  },
  ExportAttendanceQuerySchema: {
    safeParse: vi.fn(() => ({ success: true, data: { page: 1 } })),
  },
}));

vi.mock("../../../lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../lib/crypto", () => ({
  decrypt: vi.fn(async () => "010-0000-0000"),
}));

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
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
    canManageUsers?: boolean;
  };
  loginDate: string;
}

function makeAuth(role = "SUPER_ADMIN", canManageUsers = true): AuthContext {
  return {
    user: {
      id: "admin-1",
      name: "Admin",
      nameMasked: "Ad**",
      phone: "010-0000",
      role,
      canManageUsers,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: exportRoute } = await import("../export");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", exportRoute);
  const env = {
    DB: {},
    EXPORT_RATE_KV: { get: vi.fn(() => null), put: vi.fn() },
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    mockDb.select.mockImplementation(() => makeChain());
  });

  describe("GET /users", () => {
    it("returns CSV for user export", async () => {
      selectResult = [
        {
          id: "u-1",
          name: "Kim",
          phoneEncrypted: "encrypted-010-1234",
          role: "WORKER",
          createdAt: new Date(),
        },
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users", {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
    });

    it("returns 403 for non-admin WORKER", async () => {
      const { app, env } = await createApp(makeAuth("WORKER", false));
      const res = await app.request("/users", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /posts", () => {
    it("returns CSV for post export", async () => {
      selectResult = [
        {
          id: "p-1",
          category: "UNSAFE_ACT",
          reviewStatus: "APPROVED",
          userId: "u-1",
          createdAt: new Date(),
        },
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts", {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
    });
  });

  describe("GET /attendance", () => {
    it("returns CSV for attendance export", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance", {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
    });
  });
});
