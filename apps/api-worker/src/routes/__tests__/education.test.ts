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
  chain.values = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.onConflictDoNothing = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      return target[prop as string];
    },
  });
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = vi.fn(self);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      return target[prop as string];
    },
  });
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.where = vi.fn(self);
  chain.run = mockRun;
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      return target[prop as string];
    },
  });
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
  sql: Object.assign((..._args: unknown[]) => ({ as: () => "alias" }), {
    raw: vi.fn(),
  }),
}));

vi.mock("../../db/schema", () => ({
  educationContents: {
    id: "id",
    siteId: "siteId",
    title: "title",
    contentType: "contentType",
    isActive: "isActive",
    createdAt: "createdAt",
  },
  quizzes: {
    id: "id",
    siteId: "siteId",
    title: "title",
    status: "status",
    passingScore: "passingScore",
    pointsReward: "pointsReward",
    createdAt: "createdAt",
    createdById: "createdById",
  },
  quizQuestions: {
    id: "id",
    quizId: "quizId",
    question: "question",
    options: "options",
    correctAnswer: "correctAnswer",
    orderIndex: "orderIndex",
  },
  quizAttempts: {
    id: "id",
    quizId: "quizId",
    userId: "userId",
    passed: "passed",
    completedAt: "completedAt",
  },
  pointPolicies: {
    siteId: "siteId",
    reasonCode: "reasonCode",
    isActive: "isActive",
    defaultAmount: "defaultAmount",
  },
  statutoryTrainings: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    trainingType: "trainingType",
    status: "status",
    createdAt: "createdAt",
  },
  tbmRecords: {
    id: "id",
    siteId: "siteId",
    date: "date",
    topic: "topic",
    leaderId: "leaderId",
    createdAt: "createdAt",
  },
  tbmAttendees: {
    id: "id",
    tbmRecordId: "tbmRecordId",
    userId: "userId",
    attendedAt: "attendedAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  pointsLedger: { id: "id" },
  users: { id: "id", name: "name" },
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
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

function makeAuth(role = "WORKER"): AuthContext {
  return {
    user: {
      id: "user-1",
      name: "Kim",
      nameMasked: "K**",
      phone: "010-1234",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: route } = await import("../education");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("education", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockDb.delete.mockImplementation(() => makeDeleteChain());
  });

  describe("POST /contents", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Test" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Test",
            contentType: "VIDEO",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("creates content as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "content-1",
        siteId: "site-1",
        title: "Test",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Test",
            contentType: "VIDEO",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /contents", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns contents for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([{ id: "c1", title: "Test" }]);
      mockGet.mockResolvedValueOnce({ count: 1 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /contents/:id", () => {
    it("returns 404 when content not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns content for SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce({
        id: "c1",
        siteId: "site-1",
        title: "Test",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /contents/:id", () => {
    it("returns 404 when content not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", { method: "DELETE" }, env);
      expect(res.status).toBe(404);
    });

    it("soft-deletes content", async () => {
      mockGet.mockResolvedValueOnce({
        id: "c1",
        siteId: "site-1",
        title: "Test",
      });
      mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /quizzes", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Quiz" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates quiz as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "quiz-1",
        siteId: "site-1",
        title: "Quiz",
        status: "DRAFT",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", title: "Quiz" }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /quizzes", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns quizzes for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /quizzes/:id", () => {
    it("returns 404 when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes/q1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns quiz with questions", async () => {
      mockGet.mockResolvedValueOnce({
        id: "q1",
        siteId: "site-1",
        title: "Quiz",
      });
      mockAll.mockResolvedValueOnce([{ id: "qq1", question: "Q?" }]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes/q1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /quizzes/:quizId/questions", () => {
    it("returns 404 when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Q?",
            options: ["A", "B"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("creates quiz question", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "qq1", question: "Q?" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Q?",
            options: ["A", "B"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("POST /quizzes/:quizId/attempt", () => {
    it("returns 404 when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0, 1] }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when quiz not published", async () => {
      mockGet.mockResolvedValueOnce({
        id: "q1",
        siteId: "site-1",
        status: "DRAFT",
        passingScore: 70,
        pointsReward: 10,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("submits quiz attempt and scores", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          passingScore: 50,
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" });
      mockAll.mockResolvedValueOnce([
        { id: "qq1", correctAnswer: 0, orderIndex: 0 },
        { id: "qq2", correctAnswer: 1, orderIndex: 1 },
      ]);
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ defaultAmount: 20 })
        .mockResolvedValueOnce({
          id: "attempt-1",
          score: 100,
          passed: true,
          pointsAwarded: 20,
        });
      mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0, 1] }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("POST /statutory", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates statutory training as SUPER_ADMIN", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "worker-1",
            trainingType: "NEW_WORKER",
            trainingName: "신규 교육",
            trainingDate: "2025-01-15",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /statutory", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/statutory", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns statutory trainings for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/statutory?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /tbm", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates TBM record as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "tbm-1",
        siteId: "site-1",
        topic: "Safety",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            date: "2025-01-15",
            topic: "Morning Safety",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /tbm", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns TBM records for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /tbm/:id", () => {
    it("returns 404 when TBM not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/tbm-1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns TBM with attendees", async () => {
      mockGet.mockResolvedValueOnce({
        record: { id: "tbm-1", siteId: "site-1", topic: "Safety" },
        leaderName: "Kim",
      });
      mockAll.mockResolvedValueOnce([
        { attendee: { id: "a1" }, userName: "Lee" },
      ]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/tbm-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /tbm/:tbmId/attend", () => {
    it("returns 404 when TBM not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("attends TBM successfully", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "att-1",
          tbmRecordId: "tbm-1",
          userId: "user-1",
        });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 400 for duplicate attendance", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "existing" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /tbm/:tbmId/attendees", () => {
    it("returns 404 when TBM not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/tbm/tbm-1/attendees", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns attendees list", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });
      mockAll.mockResolvedValueOnce([
        { attendee: { id: "a1" }, userName: "Lee" },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/tbm/tbm-1/attendees", {}, env);
      expect(res.status).toBe(200);
    });
  });
});
