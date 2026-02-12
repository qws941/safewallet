import { Hono, type Context, type Next } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  users,
  siteMemberships,
  auditLogs,
  pushSubscriptions,
} from "../db/schema";
import {
  sendSMS,
  buildNotificationMessage,
  type NotificationType,
} from "../lib/notification";
import { success, error } from "../lib/response";
import {
  PushNotificationSendSchema,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
  SmsSendSchema,
} from "../validators/schemas";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

app.get("/vapid-key", async (c) => {
  return success(c, { publicKey: c.env.VAPID_PUBLIC_KEY });
});

const requireSiteAdmin = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "Site admin access required", 403);
  }
  await next();
};

app.post(
  "/sms/send",
  requireSiteAdmin,
  zValidator("json", SmsSendSchema as never),
  async (c) => {
    const body: z.infer<typeof SmsSendSchema> = c.req.valid("json");

    const { siteId, userIds, message } = body;

    if (!siteId || !userIds?.length || !message) {
      return error(
        c,
        "INVALID_INPUT",
        "siteId, userIds, message required",
        400,
      );
    }

    if (userIds.length > 100) {
      return error(c, "TOO_MANY_RECIPIENTS", "Max 100 recipients", 400);
    }

    if (message.length > 500) {
      return error(c, "MESSAGE_TOO_LONG", "Max 500 characters", 400);
    }

    const { user: adminUser } = c.get("auth");
    const db = drizzle(c.env.DB);

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, adminUser.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership || membership.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "현장 관리자 권한이 필요합니다", 403);
    }

    const targetUsers = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .innerJoin(
        siteMemberships,
        and(
          eq(siteMemberships.userId, users.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .where(inArray(users.id, userIds))
      .all();

    const results: Array<{ userId: string; success: boolean; error?: string }> =
      [];

    for (const user of targetUsers) {
      if (!user.phone) {
        results.push({ userId: user.id, success: false, error: "NO_PHONE" });
        continue;
      }

      const smsResult = await sendSMS(c.env, user.phone, message);
      results.push({
        userId: user.id,
        success: smsResult.success,
        error: smsResult.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await db.insert(auditLogs).values({
      actorId: adminUser.id,
      action: "SMS_BULK_SEND",
      targetType: "SITE",
      targetId: siteId,
      reason: JSON.stringify({
        messagePreview: message.substring(0, 50),
        totalTargets: userIds.length,
        successCount,
        failCount,
      }),
      ip: c.req.header("cf-connecting-ip") || "unknown",
    });

    return success(c, {
      sent: successCount,
      failed: failCount,
      results,
    });
  },
);

app.post(
  "/send",
  requireSiteAdmin,
  zValidator("json", PushNotificationSendSchema as never),
  async (c) => {
    const body: z.infer<typeof PushNotificationSendSchema> =
      c.req.valid("json");

    const { siteId, userIds, params } = body;
    const type = body.type as NotificationType;

    if (!siteId || !userIds?.length || !type) {
      return error(c, "INVALID_INPUT", "siteId, userIds, type required", 400);
    }

    if (userIds.length > 100) {
      return error(c, "TOO_MANY_RECIPIENTS", "Max 100 recipients", 400);
    }

    const { user: adminUser } = c.get("auth");
    const db = drizzle(c.env.DB);

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, adminUser.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership || membership.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "현장 관리자 권한이 필요합니다", 403);
    }

    const notification = buildNotificationMessage(type, params || {});

    const targetUsers = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .where(inArray(users.id, userIds))
      .all();

    const results: Array<{ userId: string; success: boolean; error?: string }> =
      [];

    for (const user of targetUsers) {
      if (!user.phone) {
        results.push({ userId: user.id, success: false, error: "NO_PHONE" });
        continue;
      }

      const smsMessage = `[SafeWork] ${notification.title}\n${notification.body}`;
      const smsResult = await sendSMS(c.env, user.phone, smsMessage);
      results.push({
        userId: user.id,
        success: smsResult.success,
        error: smsResult.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;

    await db.insert(auditLogs).values({
      actorId: adminUser.id,
      action: "NOTIFICATION_SEND",
      targetType: "SITE",
      targetId: siteId,
      reason: JSON.stringify({
        type,
        totalTargets: userIds.length,
        successCount,
      }),
      ip: c.req.header("cf-connecting-ip") || "unknown",
    });

    return success(c, {
      sent: successCount,
      failed: results.length - successCount,
      results,
    });
  },
);

app.post(
  "/push/subscribe",
  zValidator("json", PushSubscribeSchema as never),
  async (c) => {
    const { user } = c.get("auth");
    const db = drizzle(c.env.DB);

    const body: z.infer<typeof PushSubscribeSchema> = c.req.valid("json");

    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return error(
        c,
        "INVALID_INPUT",
        "endpoint, keys.p256dh, keys.auth required",
        400,
      );
    }

    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .get();

    const userAgent = c.req.header("user-agent") || null;

    if (existing) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
          lastUsedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing.id));

      return success(c, {
        subscriptionId: existing.id,
        message: "Subscription updated",
      });
    }

    const subscriptionId = crypto.randomUUID();
    await db.insert(pushSubscriptions).values({
      id: subscriptionId,
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    });

    return success(c, {
      subscriptionId,
      message: "Subscription created",
    });
  },
);

app.get("/push/subscriptions", async (c) => {
  const { user } = c.get("auth");
  const db = drizzle(c.env.DB);

  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id))
    .all();

  return success(c, { subscriptions });
});

app.delete(
  "/push/unsubscribe",
  zValidator("json", PushUnsubscribeSchema as never),
  async (c) => {
    const { user } = c.get("auth");
    const db = drizzle(c.env.DB);

    const body: z.infer<typeof PushUnsubscribeSchema> = c.req.valid("json");
    const { endpoint } = body;

    if (!endpoint) {
      return error(c, "INVALID_INPUT", "endpoint required", 400);
    }

    const result = await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, user.id),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
      .returning({ id: pushSubscriptions.id });

    if (!result.length) {
      return error(c, "NOT_FOUND", "Subscription not found", 404);
    }

    return success(c, { message: "Subscription removed" });
  },
);

app.delete("/push/subscriptions/:id", async (c) => {
  const { user } = c.get("auth");
  const db = drizzle(c.env.DB);
  const subscriptionId = c.req.param("id");

  const result = await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, user.id),
      ),
    )
    .returning({ id: pushSubscriptions.id });

  if (!result.length) {
    return error(c, "NOT_FOUND", "Subscription not found", 404);
  }

  return success(c, { message: "Subscription removed" });
});

export default app;

// ─── 알림톡 (Alimtalk) Endpoints ──────────────────────────────────────────────

import { sendAligoAlimtalk, sendSmartNotification } from "../lib/aligo";
import {
  AlimtalkSendSchema,
  SmartNotificationSendSchema,
} from "../validators/schemas";

app.post(
  "/alimtalk/send",
  requireSiteAdmin,
  zValidator("json", AlimtalkSendSchema as never),
  async (c) => {
    const body: z.infer<typeof AlimtalkSendSchema> = c.req.valid("json");

    const { siteId, userIds, templateCode, message, button, fallbackSms } =
      body;

    if (!siteId || !userIds?.length || !templateCode || !message) {
      return error(
        c,
        "INVALID_INPUT",
        "siteId, userIds, templateCode, message required",
        400,
      );
    }

    if (userIds.length > 100) {
      return error(c, "TOO_MANY_RECIPIENTS", "Max 100 recipients", 400);
    }

    if (message.length > 1000) {
      return error(c, "MESSAGE_TOO_LONG", "Max 1000 characters", 400);
    }

    const { user: adminUser } = c.get("auth");
    const db = drizzle(c.env.DB);

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, adminUser.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership || membership.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "현장 관리자 권한이 필요합니다", 403);
    }

    const targetUsers = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .innerJoin(
        siteMemberships,
        and(
          eq(siteMemberships.userId, users.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .where(inArray(users.id, userIds))
      .all();

    const results: Array<{ userId: string; success: boolean; error?: string }> =
      [];

    for (const user of targetUsers) {
      if (!user.phone) {
        results.push({ userId: user.id, success: false, error: "NO_PHONE" });
        continue;
      }

      const alimtalkResult = await sendAligoAlimtalk(
        c.env,
        user.phone,
        templateCode,
        message,
        {
          button,
          fallbackSms: fallbackSms ?? false,
        },
      );

      results.push({
        userId: user.id,
        success: alimtalkResult.success,
        error: alimtalkResult.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await db.insert(auditLogs).values({
      actorId: adminUser.id,
      action: "ALIMTALK_BULK_SEND",
      targetType: "SITE",
      targetId: siteId,
      reason: JSON.stringify({
        templateCode,
        messagePreview: message.substring(0, 50),
        totalTargets: userIds.length,
        successCount,
        failCount,
      }),
      ip: c.req.header("cf-connecting-ip") || "unknown",
    });

    return success(c, {
      sent: successCount,
      failed: failCount,
      results,
    });
  },
);

app.post(
  "/alimtalk/send-smart",
  requireSiteAdmin,
  zValidator("json", SmartNotificationSendSchema as never),
  async (c) => {
    const body: z.infer<typeof SmartNotificationSendSchema> =
      c.req.valid("json");

    const { siteId, userIds, templateCode, message, smsTitle, button } = body;

    if (!siteId || !userIds?.length || !templateCode || !message) {
      return error(
        c,
        "INVALID_INPUT",
        "siteId, userIds, templateCode, message required",
        400,
      );
    }

    if (userIds.length > 100) {
      return error(c, "TOO_MANY_RECIPIENTS", "Max 100 recipients", 400);
    }

    if (message.length > 1000) {
      return error(c, "MESSAGE_TOO_LONG", "Max 1000 characters", 400);
    }

    const { user: adminUser } = c.get("auth");
    const db = drizzle(c.env.DB);

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, adminUser.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership || membership.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "현장 관리자 권한이 필요합니다", 403);
    }

    const targetUsers = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .innerJoin(
        siteMemberships,
        and(
          eq(siteMemberships.userId, users.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .where(inArray(users.id, userIds))
      .all();

    const results: Array<{
      userId: string;
      success: boolean;
      method?: string;
      error?: string;
    }> = [];

    for (const user of targetUsers) {
      if (!user.phone) {
        results.push({ userId: user.id, success: false, error: "NO_PHONE" });
        continue;
      }

      const smartResult = await sendSmartNotification(
        c.env,
        user.phone,
        templateCode,
        message,
        smsTitle || "[SafeWork]",
        { button },
      );

      results.push({
        userId: user.id,
        success: smartResult.success,
        method: smartResult.method,
        error: smartResult.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const alimtalkCount = results.filter((r) => r.method === "alimtalk").length;
    const smsCount = results.filter((r) => r.method === "sms").length;

    await db.insert(auditLogs).values({
      actorId: adminUser.id,
      action: "SMART_NOTIFICATION_SEND",
      targetType: "SITE",
      targetId: siteId,
      reason: JSON.stringify({
        templateCode,
        messagePreview: message.substring(0, 50),
        totalTargets: userIds.length,
        successCount,
        failCount,
        alimtalkCount,
        smsCount,
      }),
      ip: c.req.header("cf-connecting-ip") || "unknown",
    });

    return success(c, {
      sent: successCount,
      failed: failCount,
      alimtalkSent: alimtalkCount,
      smsSent: smsCount,
      results,
    });
  },
);
