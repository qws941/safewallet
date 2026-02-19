import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
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

// Mock drizzle to return a controlled db object
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockReturningGet = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertRun = vi.fn();
const mockSelectFromWhere = vi.fn();
const mockSelectGet = vi.fn();

const mockAttendanceFindFirst = vi.fn();

const mockDb = {
  query: {
    manualApprovals: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
    attendance: {
      findFirst: mockAttendanceFindFirst,
    },
  },
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockReturnValue({
        returning: vi.fn().mockReturnValue({
          get: mockReturningGet,
        }),
      }),
    }),
  })),
  insert: vi.fn(() => ({
    values: mockInsertValues.mockReturnValue({
      run: mockInsertRun.mockResolvedValue({ success: true }),
      onConflictDoNothing: vi.fn().mockReturnValue({
        run: mockInsertRun.mockResolvedValue({ success: true }),
      }),
    }),
  })),
  select: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      where: mockSelectFromWhere.mockReturnValue({
        get: mockSelectGet,
      }),
    }),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  manualApprovals: {
    id: "id",
    siteId: "siteId",
    status: "status",
    userId: "userId",
    requestedDate: "requestedDate",
  },
  attendance: { id: "id" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  approvalStatusEnum: ["PENDING", "APPROVED", "REJECTED"],
}));

// ── Helpers ─────────────────────────────────────────────────────────────
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

function makeAuth(role = "ADMIN", userId = "user-1"): AuthContext {
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
  const { default: approvalsRoute } = await import("../approvals");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/approvals", approvalsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

// ── Tests ───────────────────────────────────────────────────────────────
describe("routes/approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET / ──
  describe("GET /approvals", () => {
    it("returns 403 for WORKER role", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/approvals", {}, env);
      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 400 for invalid status parameter", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals?status=INVALID_STATUS",
        {},
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("INVALID_STATUS");
    });

    it("returns approvals list for ADMIN", async () => {
      const mockApprovals = [
        {
          id: "a1",
          status: "PENDING",
          userId: "u1",
          user: { name: "A" },
          site: { name: "S1" },
        },
      ];
      mockFindMany.mockResolvedValue(mockApprovals);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/approvals?limit=10&offset=0", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data).toBeDefined();
      expect(body.data.data.length).toBeGreaterThanOrEqual(0);
    });

    it("returns approvals with date filter", async () => {
      mockFindMany.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/approvals?date=2025-01-15", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data).toBeDefined();
    });

    it("returns approvals with valid status filter", async () => {
      mockFindMany.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/approvals?status=PENDING", {}, env);
      expect(res.status).toBe(200);
    });

    it("allows SITE_ADMIN role", async () => {
      mockFindMany.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/approvals", {}, env);
      expect(res.status).toBe(200);
    });
  });

  // ── POST /:id/approve ──
  describe("POST /approvals/:id/approve", () => {
    it("returns 403 for WORKER role", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/approvals/a1/approve",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 if approval not found", async () => {
      mockFindFirst.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/nonexistent/approve",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 if not site admin for site-scoped approval", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "PENDING",
        siteId: "site-1",
        userId: "u1",
      });
      // isSiteAdmin check: select().from().where().get() returns null
      mockSelectGet.mockResolvedValue(null);
      const { app, env } = await createApp(
        makeAuth("SITE_ADMIN", "not-site-admin"),
      );
      const res = await app.request(
        "/approvals/a1/approve",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 if approval is not PENDING", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "APPROVED",
        siteId: null,
        userId: "u1",
      });
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/approve",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("INVALID_STATUS");
    });

    it("returns 409 on conflict (update returns null)", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "PENDING",
        siteId: null,
        userId: "u1",
        requestedDate: "2025-01-15",
      });
      mockReturningGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/approve",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("CONFLICT");
    });

    it("approves successfully", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "a1",
        status: "PENDING",
        siteId: null,
        userId: "u1",
        validDate: new Date("2025-01-15"),
      });
      mockReturningGet.mockResolvedValue({ id: "a1", status: "APPROVED" });
      // existingAttendance check via db.query.attendance.findFirst()
      mockAttendanceFindFirst.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/approve",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.success).toBe(true);
    });
  });

  // ── POST /:id/reject ──
  describe("POST /approvals/:id/reject", () => {
    it("returns 403 for WORKER role", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "test" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 if reason is missing", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 if approval not found", async () => {
      mockFindFirst.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "duplicate" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 if not PENDING", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "REJECTED",
        siteId: null,
        userId: "u1",
      });
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "duplicate" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 on conflict", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "PENDING",
        siteId: null,
        userId: "u1",
      });
      mockReturningGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "duplicate" }),
        },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("rejects successfully", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "PENDING",
        siteId: null,
        userId: "u1",
      });
      mockReturningGet.mockResolvedValue({ id: "a1", status: "REJECTED" });
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Not a valid request" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.success).toBe(true);
    });

    it("returns 403 if not site admin for site-scoped rejection", async () => {
      mockFindFirst.mockResolvedValue({
        id: "a1",
        status: "PENDING",
        siteId: "site-1",
        userId: "u1",
      });
      mockSelectGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "not-admin"));
      const res = await app.request(
        "/approvals/a1/reject",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Not allowed" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });
});
