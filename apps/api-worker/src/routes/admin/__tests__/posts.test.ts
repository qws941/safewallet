import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

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

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../helpers", () => ({
  requireManagerOrAdmin: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
  getTodayRange: vi.fn(() => ({
    start: new Date("2025-01-01T00:00:00Z"),
    end: new Date("2025-01-02T00:00:00Z"),
  })),
  AppContext: {},
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

vi.mock("../../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
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

vi.mock("../../../db/helpers", () => ({
  dbBatchChunked: vi.fn(),
}));

const mockGetQueue: unknown[] = [];
const mockAllQueue: unknown[] = [];
const mockReturningGetQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : undefined;
}

function dequeueAll() {
  return mockAllQueue.length > 0 ? mockAllQueue.shift() : [];
}

function dequeueReturningGet() {
  return mockReturningGetQueue.length > 0
    ? mockReturningGetQueue.shift()
    : undefined;
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => dequeueAll());
  chain.as = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueReturningGet());
  chain.run = vi.fn(async () => ({ success: true }));
  chain.onConflictDoNothing = vi.fn(() => chain);
  return chain;
}

const mockDeleteWhere = vi.fn().mockReturnValue({
  run: vi.fn().mockResolvedValue({ success: true }),
});
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  delete: vi.fn(() => ({
    where: mockDeleteWhere,
  })),
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockResolvedValue({ success: true }),
    }),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../../db/schema", () => ({
  posts: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    category: "category",
    riskLevel: "riskLevel",
    reviewStatus: "reviewStatus",
    isUrgent: "isUrgent",
    createdAt: "createdAt",
    isPotentialDuplicate: "isPotentialDuplicate",
  },
  postImages: { postId: "postId", fileUrl: "fileUrl" },
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    falseReportCount: "falseReportCount",
    restrictedUntil: "restrictedUntil",
  },
  sites: { id: "id", name: "name" },
  reviews: {
    id: "id",
    postId: "postId",
    action: "action",
    createdAt: "createdAt",
  },
  pointsLedger: {
    postId: "postId",
    userId: "userId",
    siteId: "siteId",
    amount: "amount",
    occurredAt: "occurredAt",
  },
  actions: { id: "id", postId: "postId" },
  actionImages: { actionId: "actionId", fileUrl: "fileUrl" },
  manualApprovals: { id: "id" },
  auditLogs: {},
  categoryEnum: ["HAZARD", "UNSAFE_BEHAVIOR"],
  riskLevelEnum: ["HIGH", "MEDIUM", "LOW"],
  reviewStatusEnum: ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"],
}));

function makeAuth(role = "ADMIN", userId = "admin-1"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Admin",
      nameMasked: "Ad**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth: AuthContext) {
  const { default: adminPostsRoute } = await import("../posts");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  app.route("/admin", adminPostsRoute);
  const env = {
    DB: {},
    R2: { delete: vi.fn() },
  } as Record<string, unknown>;
  return { app, env };
}

describe("routes/admin/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockReturningGetQueue.length = 0;
  });

  describe("GET /admin/posts", () => {
    it("returns posts list", async () => {
      mockAllQueue.push([
        {
          post: { id: "p1", category: "HAZARD", reviewStatus: "PENDING" },
          author: { id: "u1", name: "Kim", nameMasked: "K**" },
          site: { id: "s1", name: "Severance" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/admin/posts", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { posts: Array<{ id: string; author: unknown; site: unknown }> };
      };
      expect(body.data.posts).toHaveLength(1);
      expect(body.data.posts[0].id).toBe("p1");
    });

    it("applies filter query params", async () => {
      mockAllQueue.push([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts?siteId=s1&category=HAZARD&riskLevel=HIGH&reviewStatus=PENDING&isUrgent=true&startDate=2025-01-01&endDate=2025-01-31&limit=10&offset=0",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns empty when no posts", async () => {
      mockAllQueue.push([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/admin/posts", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { posts: unknown[] } };
      expect(body.data.posts).toHaveLength(0);
    });
  });

  describe("GET /admin/posts/pending-review", () => {
    it("returns pending review posts", async () => {
      mockAllQueue.push([
        {
          post: {
            id: "p1",
            reviewStatus: "PENDING",
            isPotentialDuplicate: false,
          },
          author: { id: "u1", name: "K**" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/admin/posts/pending-review", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          posts: Array<{ id: string; duplicateWarning: boolean }>;
        };
      };
      expect(body.data.posts).toHaveLength(1);
      expect(body.data.posts[0].duplicateWarning).toBe(false);
    });

    it("filters by siteId", async () => {
      mockAllQueue.push([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/pending-review?siteId=s1",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST /admin/posts/:id/review", () => {
    it("approves a post successfully", async () => {
      // db.select().from(posts).where().get() → found post
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: false,
      });
      // insert(reviews).select(...).returning().get() → review created
      mockReturningGetQueue.push({
        id: "r1",
        postId: "p1",
        adminId: "admin-1",
        action: "APPROVE",
      });
      // insert(pointsLedger).select(...).returning().get() → points created
      mockReturningGetQueue.push({
        id: "pt1",
        userId: "u1",
        amount: 5,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
            pointsToAward: 5,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { review: { id: string; action: string } };
      };
      expect(body.data.review.action).toBe("APPROVE");
    });

    it("rejects a post", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: false,
      });
      mockReturningGetQueue.push({
        id: "r1",
        postId: "p1",
        action: "REJECT",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REJECT", reasonCode: "DUPLICATE" }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("returns 404 when post not found", async () => {
      mockGetQueue.push(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/nonexistent/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE" }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid action", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: false,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "INVALID_ACTION" }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("handles daily limit exceeded on approve", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: false,
      });
      // insert(reviews).select(...).returning().get() → null (limit exceeded)
      mockReturningGetQueue.push(undefined);
      // Promise.all for approved count + points sum
      mockGetQueue.push({ count: 3 });
      mockGetQueue.push({ total: 30 });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", pointsToAward: 5 }),
        },
        env,
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: { code: string };
      };
      expect(body.error.code).toBe("DAILY_LIMIT_EXCEEDED");
    });

    it("returns 500 when review creation fails for non-approve action", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: false,
      });
      mockReturningGetQueue.push(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REJECT" }),
        },
        env,
      );

      expect(res.status).toBe(500);
    });

    it("handles false report rejection with user penalty", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: false,
      });
      mockReturningGetQueue.push({
        id: "r1",
        postId: "p1",
        action: "REJECT",
      });
      // select user for false report count
      mockGetQueue.push({
        falseReportCount: 2,
        restrictedUntil: null,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REJECT", reasonCode: "FALSE" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockUpdateSet).toHaveBeenCalled();
    });

    it("sets 0 points for potential duplicate posts", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        siteId: "s1",
        isPotentialDuplicate: true,
      });
      mockReturningGetQueue.push({
        id: "r1",
        postId: "p1",
        action: "APPROVE",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/posts/p1/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", pointsToAward: 5 }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("POST /admin/manual-approval", () => {
    it("creates manual approval", async () => {
      // select user
      mockGetQueue.push({ id: "u1", name: "Kim" });
      // insert approval returning
      mockReturningGetQueue.push({
        id: "ma1",
        userId: "u1",
        siteId: "s1",
        status: "APPROVED",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/manual-approval",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "u1",
            siteId: "s1",
            reason: "Manual override needed",
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { approval: { id: string; status: string } };
      };
      expect(body.data.approval.status).toBe("APPROVED");
    });

    it("returns 404 when target user not found", async () => {
      mockGetQueue.push(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/admin/manual-approval",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "nonexistent",
            siteId: "s1",
            reason: "Test",
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/posts/:id/emergency-purge", () => {
    it("purges a post with all related data", async () => {
      // select post
      mockGetQueue.push({ id: "p1", userId: "u1" });
      // Promise.all: images, reviews, points
      mockAllQueue.push([{ fileUrl: "img1.jpg" }, { fileUrl: "img2.jpg" }]);
      mockAllQueue.push([{ id: "r1" }]);
      mockAllQueue.push([{ id: "pt1" }]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/admin/posts/p1/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Emergency deletion for compliance reasons",
            confirmPostId: "p1",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          deleted: boolean;
          purgedImages: number;
          purgedReviews: number;
          purgedPoints: number;
        };
      };
      expect(body.data.deleted).toBe(true);
      expect(body.data.purgedImages).toBe(2);
      expect(body.data.purgedReviews).toBe(1);
      expect(body.data.purgedPoints).toBe(1);
    });

    it("returns 403 for non-SUPER_ADMIN", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/admin/posts/p1/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Emergency deletion for compliance reasons",
            confirmPostId: "p1",
          }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when confirmPostId does not match", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/admin/posts/p1/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Emergency deletion for compliance reasons",
            confirmPostId: "WRONG_ID",
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 when post not found", async () => {
      mockGetQueue.push(undefined);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/admin/posts/nonexistent/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Emergency deletion for compliance reasons",
            confirmPostId: "nonexistent",
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/actions/:id/emergency-purge", () => {
    it("purges an action with images", async () => {
      mockGetQueue.push({ id: "a1", postId: "p1" });
      mockAllQueue.push([
        { fileUrl: "action-img1.jpg" },
        { fileUrl: "action-img2.jpg" },
      ]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/admin/actions/a1/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Compliance requirement",
            confirmActionId: "a1",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { deleted: boolean; purgedImages: number };
      };
      expect(body.data.deleted).toBe(true);
      expect(body.data.purgedImages).toBe(2);
    });

    it("returns 403 for non-SUPER_ADMIN", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/admin/actions/a1/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test",
            confirmActionId: "a1",
          }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when confirmActionId does not match", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/admin/actions/a1/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test",
            confirmActionId: "WRONG_ID",
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 when action not found", async () => {
      mockGetQueue.push(undefined);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/admin/actions/nonexistent/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test",
            confirmActionId: "nonexistent",
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });
  });
});
