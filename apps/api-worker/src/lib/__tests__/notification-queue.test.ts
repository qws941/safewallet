import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NotificationQueueMessage } from "../notification-queue";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

vi.mock("../../db/schema", () => ({
  pushSubscriptions: {
    id: "id",
    lastUsedAt: "lastUsedAt",
    failCount: "failCount",
  },
}));

const mockSendPushBulk = vi.fn();
const mockShouldRemoveSubscription = vi.fn();

vi.mock("../web-push", () => ({
  sendPushBulk: (...args: unknown[]) => mockSendPushBulk(...args),
  shouldRemoveSubscription: (...args: unknown[]) =>
    mockShouldRemoveSubscription(...args),
}));

vi.mock("../logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

const mockUpdateSet = vi.fn();
const mockDeleteWhere = vi.fn();

const mockDb = {
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: mockUpdateSet.mockResolvedValue(undefined),
    })),
  })),
  delete: vi.fn(() => ({
    where: mockDeleteWhere.mockResolvedValue(undefined),
  })),
};

function makeQueueMessage(): NotificationQueueMessage {
  return {
    type: "push_bulk",
    subscriptions: [
      {
        id: "sub-1",
        userId: "user-1",
        endpoint: "https://push.example.com/sub/1",
        p256dh: "key1",
        auth: "auth1",
        failCount: 0,
      },
      {
        id: "sub-2",
        userId: "user-2",
        endpoint: "https://push.example.com/sub/2",
        p256dh: "key2",
        auth: "auth2",
        failCount: 1,
      },
    ],
    message: { title: "Test", body: "Hello" },
    enqueuedAt: new Date().toISOString(),
  };
}

function makeEnv() {
  return {
    DB: {} as D1Database,
    VAPID_PUBLIC_KEY: "test-public",
    VAPID_PRIVATE_KEY: "test-private",
  };
}

describe("notification-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueNotification", () => {
    it("sends message to queue", async () => {
      const { enqueueNotification } = await import("../notification-queue");
      const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
      const msg = makeQueueMessage();

      await enqueueNotification(mockQueue as unknown as Queue, msg);

      expect(mockQueue.send).toHaveBeenCalledWith(msg);
    });

    it("throws when queue.send fails", async () => {
      const { enqueueNotification } = await import("../notification-queue");
      const mockQueue = {
        send: vi.fn().mockRejectedValue(new Error("Queue full")),
      };

      await expect(
        enqueueNotification(mockQueue as unknown as Queue, makeQueueMessage()),
      ).rejects.toThrow("Queue full");
    });
  });

  describe("processNotificationBatch", () => {
    it("retries all when VAPID keys missing", async () => {
      const { processNotificationBatch } =
        await import("../notification-queue");
      const retryAll = vi.fn();
      const batch = {
        messages: [],
        retryAll,
        ackAll: vi.fn(),
        queue: "notification-queue",
      } as unknown as MessageBatch<NotificationQueueMessage>;

      await processNotificationBatch(batch, {
        ...makeEnv(),
        VAPID_PUBLIC_KEY: undefined,
        VAPID_PRIVATE_KEY: undefined,
      } as unknown as import("../../types").Env);

      expect(retryAll).toHaveBeenCalled();
    });

    it("acks message on successful processing", async () => {
      const { processNotificationBatch } =
        await import("../notification-queue");

      mockSendPushBulk.mockResolvedValue([
        { success: true },
        { success: true },
      ]);

      const ack = vi.fn();
      const retry = vi.fn();
      const batch = {
        messages: [
          {
            body: makeQueueMessage(),
            ack,
            retry,
            id: "msg-1",
            timestamp: new Date(),
            attempts: 1,
          },
        ],
        retryAll: vi.fn(),
        ackAll: vi.fn(),
        queue: "notification-queue",
      } as unknown as MessageBatch<NotificationQueueMessage>;

      await processNotificationBatch(
        batch,
        makeEnv() as unknown as import("../../types").Env,
      );

      expect(ack).toHaveBeenCalled();
      expect(retry).not.toHaveBeenCalled();
      expect(mockSendPushBulk).toHaveBeenCalledWith(
        [
          {
            endpoint: "https://push.example.com/sub/1",
            keys: { p256dh: "key1", auth: "auth1" },
          },
          {
            endpoint: "https://push.example.com/sub/2",
            keys: { p256dh: "key2", auth: "auth2" },
          },
        ],
        { title: "Test", body: "Hello" },
        { publicKey: "test-public", privateKey: "test-private" },
      );
    });

    it("retries message on processing failure", async () => {
      const { processNotificationBatch } =
        await import("../notification-queue");

      mockSendPushBulk.mockRejectedValue(new Error("Push service down"));

      const ack = vi.fn();
      const retry = vi.fn();
      const batch = {
        messages: [
          {
            body: makeQueueMessage(),
            ack,
            retry,
            id: "msg-1",
            timestamp: new Date(),
            attempts: 1,
          },
        ],
        retryAll: vi.fn(),
        ackAll: vi.fn(),
        queue: "notification-queue",
      } as unknown as MessageBatch<NotificationQueueMessage>;

      await processNotificationBatch(
        batch,
        makeEnv() as unknown as import("../../types").Env,
      );

      expect(retry).toHaveBeenCalled();
      expect(ack).not.toHaveBeenCalled();
    });

    it("removes expired subscriptions from D1", async () => {
      const { processNotificationBatch } =
        await import("../notification-queue");

      mockSendPushBulk.mockResolvedValue([
        { success: true },
        { success: false, status: 410 },
      ]);
      mockShouldRemoveSubscription.mockImplementation(
        (result: { status?: number }) => result.status === 410,
      );

      const ack = vi.fn();
      const batch = {
        messages: [
          {
            body: makeQueueMessage(),
            ack,
            retry: vi.fn(),
            id: "msg-1",
            timestamp: new Date(),
            attempts: 1,
          },
        ],
        retryAll: vi.fn(),
        ackAll: vi.fn(),
        queue: "notification-queue",
      } as unknown as MessageBatch<NotificationQueueMessage>;

      await processNotificationBatch(
        batch,
        makeEnv() as unknown as import("../../types").Env,
      );

      expect(ack).toHaveBeenCalled();
      // sub-1 succeeded → update, sub-2 expired → delete
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("increments failCount for non-expired failures", async () => {
      const { processNotificationBatch } =
        await import("../notification-queue");

      mockSendPushBulk.mockResolvedValue([{ success: false, status: 500 }]);
      mockShouldRemoveSubscription.mockReturnValue(false);

      const msg = makeQueueMessage();
      msg.subscriptions = [msg.subscriptions[0]];

      const ack = vi.fn();
      const batch = {
        messages: [
          {
            body: msg,
            ack,
            retry: vi.fn(),
            id: "msg-1",
            timestamp: new Date(),
            attempts: 1,
          },
        ],
        retryAll: vi.fn(),
        ackAll: vi.fn(),
        queue: "notification-queue",
      } as unknown as MessageBatch<NotificationQueueMessage>;

      await processNotificationBatch(
        batch,
        makeEnv() as unknown as import("../../types").Env,
      );

      expect(ack).toHaveBeenCalled();
      // failCount should be incremented (was 0 → set to 1)
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("processes multiple messages in a batch", async () => {
      const { processNotificationBatch } =
        await import("../notification-queue");

      mockSendPushBulk
        .mockResolvedValueOnce([{ success: true }])
        .mockRejectedValueOnce(new Error("fail"));

      const msg1 = makeQueueMessage();
      msg1.subscriptions = [msg1.subscriptions[0]];
      const msg2 = makeQueueMessage();
      msg2.subscriptions = [msg2.subscriptions[1]];

      const ack1 = vi.fn();
      const retry1 = vi.fn();
      const ack2 = vi.fn();
      const retry2 = vi.fn();

      const batch = {
        messages: [
          {
            body: msg1,
            ack: ack1,
            retry: retry1,
            id: "msg-1",
            timestamp: new Date(),
            attempts: 1,
          },
          {
            body: msg2,
            ack: ack2,
            retry: retry2,
            id: "msg-2",
            timestamp: new Date(),
            attempts: 1,
          },
        ],
        retryAll: vi.fn(),
        ackAll: vi.fn(),
        queue: "notification-queue",
      } as unknown as MessageBatch<NotificationQueueMessage>;

      await processNotificationBatch(
        batch,
        makeEnv() as unknown as import("../../types").Env,
      );

      expect(ack1).toHaveBeenCalled();
      expect(retry1).not.toHaveBeenCalled();
      expect(ack2).not.toHaveBeenCalled();
      expect(retry2).toHaveBeenCalled();
    });
  });
});
