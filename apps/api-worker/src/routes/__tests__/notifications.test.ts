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

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockDeleteWhere = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: mockGet,
        all: mockAll,
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: mockInsertValues.mockResolvedValue(undefined),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: mockUpdateSet.mockResolvedValue(undefined),
    })),
  })),
  delete: vi.fn(() => ({
    where: mockDeleteWhere.mockResolvedValue(undefined),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
}));

vi.mock("../../db/schema", () => ({
  pushSubscriptions: {
    id: "id",
    userId: "userId",
    endpoint: "endpoint",
    p256dh: "p256dh",
    auth: "auth",
    createdAt: "createdAt",
    lastUsedAt: "lastUsedAt",
    failCount: "failCount",
    userAgent: "userAgent",
    expiresAt: "expiresAt",
  },
  users: { id: "id" },
}));

vi.mock("../../lib/web-push", () => ({
  sendPushNotification: vi.fn(),
  sendPushBulk: vi.fn(),
  shouldRemoveSubscription: vi.fn(),
}));

const mockSmsSendBulk = vi.fn().mockResolvedValue({
  totalRequested: 0,
  successCount: 0,
  failureCount: 0,
  results: [],
});

vi.mock("../../lib/sms", () => ({
  createSmsClient: vi.fn(() => ({
    send: vi.fn(),
    sendBulk: mockSmsSendBulk,
    verify: vi.fn(),
  })),
}));

const mockEnqueueNotification = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/notification-queue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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

function makeEnv(vapid = true) {
  return {
    DB: {},
    ...(vapid
      ? {
          VAPID_PUBLIC_KEY: "test-vapid-public",
          VAPID_PRIVATE_KEY: "test-vapid-private",
        }
      : {}),
  } as Record<string, unknown>;
}

async function createApp(auth?: AuthContext) {
  const { default: notificationsRoute } = await import("../notifications");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/notifications", notificationsRoute);
  return app;
}

describe("routes/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /notifications/subscribe", () => {
    it("creates a new subscription", async () => {
      mockGet.mockResolvedValue(null);
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "https://push.example.com/sub/1",
            keys: { p256dh: "key1", auth: "auth1" },
          }),
        },
        makeEnv(),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        success: boolean;
        data: { id: string; updated: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(false);
    });

    it("updates existing subscription by endpoint", async () => {
      mockGet.mockResolvedValue({ id: "existing-id" });
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "https://push.example.com/sub/1",
            keys: { p256dh: "key2", auth: "auth2" },
          }),
        },
        makeEnv(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { id: string; updated: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(true);
      expect(body.data.id).toBe("existing-id");
    });

    it("returns 503 if VAPID not configured", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "https://push.example.com/sub/1",
            keys: { p256dh: "key1", auth: "auth1" },
          }),
        },
        makeEnv(false),
      );
      expect(res.status).toBe(503);
    });

    it("validates required fields", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "not-a-url" }),
        },
        makeEnv(),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /notifications/unsubscribe", () => {
    it("deletes subscription by endpoint", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/unsubscribe?endpoint=https://push.example.com/sub/1",
        { method: "DELETE" },
        makeEnv(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { deleted: boolean };
      };
      expect(body.success).toBe(true);
    });

    it("returns 400 without endpoint param", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/unsubscribe",
        { method: "DELETE" },
        makeEnv(),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /notifications/subscriptions", () => {
    it("returns user subscriptions", async () => {
      const subs = [
        {
          id: "sub-1",
          endpoint: "https://push.example.com/sub/1",
          createdAt: new Date(),
          lastUsedAt: null,
          userAgent: "Chrome/120",
        },
      ];
      mockAll.mockResolvedValue(subs);
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/subscriptions",
        {},
        makeEnv(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: typeof subs;
      };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });
  });

  describe("GET /notifications/vapid-key", () => {
    it("returns VAPID public key", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request("/notifications/vapid-key", {}, makeEnv());
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { publicKey: string };
      };
      expect(body.data.publicKey).toBe("test-vapid-public");
    });

    it("returns 503 if VAPID not configured", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/vapid-key",
        {},
        makeEnv(false),
      );
      expect(res.status).toBe(503);
    });
  });

  describe("POST /notifications/send", () => {
    it("returns 403 for non-admin users", async () => {
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/notifications/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: ["user-1"],
            message: { title: "Test", body: "Hello" },
          }),
        },
        makeEnv(),
      );
      expect(res.status).toBe(403);
    });

    it("handles no subscriptions case", async () => {
      mockAll.mockResolvedValue([]);
      const app = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/notifications/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: ["user-1"],
            message: { title: "Test", body: "Hello" },
          }),
        },
        makeEnv(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { sent: number; noSubscriptions: boolean };
      };
      expect(body.data.noSubscriptions).toBe(true);
      expect(body.data.sent).toBe(0);
    });

    it("triggers SMS fallback when no push subscriptions exist", async () => {
      mockAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "user-1", phone: "010-1234-5678" }]);
      mockSmsSendBulk.mockResolvedValueOnce({
        totalRequested: 1,
        successCount: 1,
        failureCount: 0,
        results: [{ success: true }],
      });
      const app = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/notifications/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: ["user-1"],
            message: { title: "Test", body: "Hello" },
          }),
        },
        makeEnv(),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { smsFallback: number; noSubscriptions: boolean };
      };
      expect(body.data.noSubscriptions).toBe(true);
      expect(body.data.smsFallback).toBe(1);
      expect(mockSmsSendBulk).toHaveBeenCalledWith([
        expect.objectContaining({ to: "010-1234-5678" }),
      ]);
    });

    it("returns 503 if VAPID not configured", async () => {
      const app = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/notifications/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: ["user-1"],
            message: { title: "Test", body: "Hello" },
          }),
        },
        makeEnv(false),
      );
      expect(res.status).toBe(503);
    });

    it("enqueues via NOTIFICATION_QUEUE when available", async () => {
      const subs = [
        {
          id: "sub-1",
          userId: "user-1",
          endpoint: "https://push.example.com/sub/1",
          p256dh: "key1",
          auth: "auth1",
          failCount: 0,
          createdAt: new Date(),
          lastUsedAt: null,
          userAgent: "Chrome",
          expiresAt: null,
        },
      ];
      mockAll.mockResolvedValue(subs);
      const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
      const app = await createApp(makeAuth("ADMIN"));
      const env = {
        ...makeEnv(),
        NOTIFICATION_QUEUE: mockQueue,
      };
      const res = await app.request(
        "/notifications/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: ["user-1"],
            message: { title: "Queued", body: "Via queue" },
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { queued: number; async: boolean };
      };
      expect(body.data.queued).toBe(1);
      expect(body.data.async).toBe(true);
      expect(mockEnqueueNotification).toHaveBeenCalledWith(
        mockQueue,
        expect.objectContaining({
          type: "push_bulk",
          subscriptions: expect.arrayContaining([
            expect.objectContaining({ id: "sub-1" }),
          ]),
        }),
      );
    });
  });
});
