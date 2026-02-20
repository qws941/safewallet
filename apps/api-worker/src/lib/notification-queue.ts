import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { pushSubscriptions } from "../db/schema";
import {
  sendPushBulk,
  shouldRemoveSubscription,
  type PushMessage,
  type VapidKeys,
} from "./web-push";
import { createLogger } from "./logger";
import type { Env } from "../types";

const logger = createLogger("notification-queue");

export interface NotificationQueueMessage {
  type: "push_bulk";
  subscriptions: Array<{
    id: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    failCount: number;
  }>;
  message: PushMessage;
  enqueuedAt: string;
}

export async function enqueueNotification(
  queue: Queue,
  msg: NotificationQueueMessage,
): Promise<void> {
  try {
    await queue.send(msg);
    logger.info("Notification enqueued", {
      metadata: {
        type: msg.type,
        subscriptionCount: msg.subscriptions.length,
      },
    });
  } catch (err) {
    logger.error("Failed to enqueue notification", {
      error: {
        name: "QueueError",
        message: err instanceof Error ? err.message : String(err),
      },
      metadata: { type: msg.type },
    });
    throw err;
  }
}

export async function processNotificationBatch(
  batch: MessageBatch<NotificationQueueMessage>,
  env: Env,
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    logger.error("VAPID keys not configured, retrying later", {});
    batch.retryAll();
    return;
  }

  const vapidKeys: VapidKeys = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const db = drizzle(env.DB);

  for (const message of batch.messages) {
    try {
      await processOneMessage(message.body, vapidKeys, db, env.VAPID_SUBJECT);
      message.ack();
    } catch (err) {
      logger.error("Queue message processing failed", {
        error: {
          name: "ProcessError",
          message: err instanceof Error ? err.message : String(err),
        },
        metadata: {
          subscriptionCount: message.body.subscriptions.length,
        },
      });
      message.retry();
    }
  }
}

async function processOneMessage(
  msg: NotificationQueueMessage,
  vapidKeys: VapidKeys,
  db: ReturnType<typeof drizzle>,
  vapidSubject?: string,
): Promise<void> {
  const pushSubs = msg.subscriptions.map((s) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }));

  const results = await sendPushBulk(
    pushSubs,
    msg.message,
    vapidKeys,
    vapidSubject,
  );

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const sub = msg.subscriptions[i];

    if (result.success) {
      sent++;
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date(), failCount: 0 })
        .where(eq(pushSubscriptions.id, sub.id));
    } else if (shouldRemoveSubscription(result)) {
      removed++;
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id));
    } else {
      failed++;
      await db
        .update(pushSubscriptions)
        .set({ failCount: sub.failCount + 1 })
        .where(eq(pushSubscriptions.id, sub.id));
    }
  }

  logger.info("Queue message processed", {
    metadata: { sent, failed, removed, total: results.length },
  });
}
