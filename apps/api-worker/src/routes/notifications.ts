import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, inArray } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { pushSubscriptions, users } from "../db/schema";
import { success, error } from "../lib/response";
import {
  sendPushNotification,
  sendPushBulk,
  shouldRemoveSubscription,
  type PushMessage,
  type VapidKeys,
} from "../lib/web-push";
import { createSmsClient } from "../lib/sms";
import { createLogger } from "../lib/logger";
import {
  enqueueNotification,
  type NotificationQueueMessage,
} from "../lib/notification-queue";

const log = createLogger("notifications");

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

app.post("/subscribe", zValidator("json", SubscribeSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const body = c.req.valid("json");

  if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) {
    return error(
      c,
      "PUSH_NOT_CONFIGURED",
      "푸시 알림이 설정되지 않았습니다.",
      503,
    );
  }

  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, body.endpoint))
    .get();

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: user.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        lastUsedAt: new Date(),
        failCount: 0,
        userAgent: body.userAgent ?? null,
      })
      .where(eq(pushSubscriptions.id, existing.id));

    return success(c, { id: existing.id, updated: true });
  }

  const id = crypto.randomUUID();
  await db.insert(pushSubscriptions).values({
    id,
    userId: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    createdAt: new Date(),
    failCount: 0,
    userAgent: body.userAgent ?? null,
  });

  log.info("Push subscription created", { userId: user.id });
  return success(c, { id, updated: false }, 201);
});

app.delete("/unsubscribe", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const endpoint = c.req.query("endpoint");

  if (!endpoint) {
    return error(c, "MISSING_ENDPOINT", "endpoint 파라미터가 필요합니다.");
  }

  const result = await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return success(c, { deleted: true });
});

app.get("/subscriptions", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
      userAgent: pushSubscriptions.userAgent,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id))
    .all();

  return success(c, subs);
});

app.get("/vapid-key", async (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) {
    return error(
      c,
      "PUSH_NOT_CONFIGURED",
      "푸시 알림이 설정되지 않았습니다.",
      503,
    );
  }
  return success(c, { publicKey: c.env.VAPID_PUBLIC_KEY });
});

const SendPushSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  message: z.object({
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(500),
    icon: z.string().optional(),
    badge: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    actions: z
      .array(z.object({ action: z.string(), title: z.string() }))
      .optional(),
  }),
});

app.post("/send", zValidator("json", SendPushSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return error(c, "FORBIDDEN", "관리자만 푸시 알림을 보낼 수 있습니다.", 403);
  }

  if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) {
    return error(
      c,
      "PUSH_NOT_CONFIGURED",
      "VAPID 키가 설정되지 않았습니다.",
      503,
    );
  }

  const body = c.req.valid("json");
  const vapidKeys: VapidKeys = {
    publicKey: c.env.VAPID_PUBLIC_KEY,
    privateKey: c.env.VAPID_PRIVATE_KEY,
  };

  const allSubs = [];
  for (const userId of body.userIds) {
    const subs = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        failCount: pushSubscriptions.failCount,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .all();

    for (const sub of subs) {
      allSubs.push({ ...sub, userId });
    }
  }

  const usersWithNoSubs = new Set<string>();
  for (const userId of body.userIds) {
    if (!allSubs.some((s) => s.userId === userId)) {
      usersWithNoSubs.add(userId);
    }
  }

  if (allSubs.length === 0) {
    const smsFallbackCount = await sendSmsFallback(
      c.env,
      db,
      body.userIds,
      body.message,
    );

    return success(c, {
      sent: 0,
      failed: 0,
      removed: 0,
      smsFallback: smsFallbackCount,
      noSubscriptions: true,
    });
  }

  if (c.env.NOTIFICATION_QUEUE) {
    const queueMsg: NotificationQueueMessage = {
      type: "push_bulk",
      subscriptions: allSubs.map((s) => ({
        id: s.id,
        userId: s.userId,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
        failCount: s.failCount,
      })),
      message: body.message,
      enqueuedAt: new Date().toISOString(),
    };

    await enqueueNotification(c.env.NOTIFICATION_QUEUE, queueMsg);

    let smsFallbackCount = 0;
    if (usersWithNoSubs.size > 0) {
      smsFallbackCount = await sendSmsFallback(
        c.env,
        db,
        [...usersWithNoSubs],
        body.message,
      );
    }

    log.info("Push notifications enqueued", {
      metadata: {
        queued: allSubs.length,
        smsFallback: smsFallbackCount,
      },
    });

    return success(c, {
      queued: allSubs.length,
      smsFallback: smsFallbackCount,
      async: true,
    });
  }

  const pushSubs = allSubs.map((s) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }));

  const results = await sendPushBulk(pushSubs, body.message, vapidKeys);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  const userPushSuccess = new Map<string, boolean>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const sub = allSubs[i];

    if (result.success) {
      sent++;
      userPushSuccess.set(sub.userId, true);
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

  const smsFallbackUserIds: string[] = [...usersWithNoSubs];
  for (const userId of body.userIds) {
    if (!usersWithNoSubs.has(userId) && !userPushSuccess.get(userId)) {
      smsFallbackUserIds.push(userId);
    }
  }

  let smsFallbackCount = 0;
  if (smsFallbackUserIds.length > 0) {
    smsFallbackCount = await sendSmsFallback(
      c.env,
      db,
      smsFallbackUserIds,
      body.message,
    );
  }

  log.info("Push bulk send completed", {
    metadata: {
      sent,
      failed,
      removed,
      smsFallback: smsFallbackCount,
      total: allSubs.length,
    },
  });

  return success(c, { sent, failed, removed, smsFallback: smsFallbackCount });
});

async function sendSmsFallback(
  env: Env,
  db: DrizzleD1Database,
  userIds: string[],
  message: { title: string; body: string },
): Promise<number> {
  const smsClient = createSmsClient(env);

  const targetUsers = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(inArray(users.id, userIds))
    .all();

  const validTargets = targetUsers.filter(
    (u): u is typeof u & { phone: string } => !!u.phone,
  );

  if (validTargets.length === 0) {
    return 0;
  }

  const smsBody = `[SafetyWallet] ${message.title}\n${message.body}`;
  const smsMessages = validTargets.map((u) => ({
    to: u.phone,
    body: smsBody,
  }));

  const result = await smsClient.sendBulk(smsMessages);

  log.info("SMS fallback completed", {
    metadata: {
      requested: validTargets.length,
      sent: result.successCount,
      failed: result.failureCount,
    },
  });

  return result.successCount;
}

export default app;
