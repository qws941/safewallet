import type { Env } from "../types";

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushResult {
  success: boolean;
  error?: string;
}

export async function sendSMS(
  env: Env,
  to: string,
  message: string,
): Promise<SMSResult> {
  if (!env.SMS_API_KEY || !env.SMS_API_SECRET || !env.SMS_SENDER) {
    console.warn("SMS credentials not configured");
    return { success: false, error: "SMS_NOT_CONFIGURED" };
  }

  const cleanPhone = to.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 10) {
    return { success: false, error: "INVALID_PHONE" };
  }

  try {
    const timestamp = Date.now().toString();
    const signature = await generateHMAC(
      `${timestamp}${env.SMS_API_KEY}`,
      env.SMS_API_SECRET,
    );

    const response = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${env.SMS_API_KEY}, date=${timestamp}, salt=${timestamp}, signature=${signature}`,
      },
      body: JSON.stringify({
        message: {
          to: cleanPhone,
          from: env.SMS_SENDER,
          text: message,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS API error:", errorText);
      return { success: false, error: `API_ERROR: ${response.status}` };
    }

    const result = (await response.json()) as { messageId?: string };
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("SMS send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    };
  }
}

export async function sendPushNotification(
  _env: Env,
  _subscription: PushSubscription,
  _payload: { title: string; body: string; data?: Record<string, string> },
): Promise<PushResult> {
  console.warn(
    "Push notification not yet implemented - requires web-push library",
  );
  return { success: false, error: "PUSH_NOT_IMPLEMENTED" };
}

export type NotificationType =
  | "POST_APPROVED"
  | "POST_REJECTED"
  | "POINTS_AWARDED"
  | "DISPUTE_RESOLVED"
  | "ANNOUNCEMENT";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export function buildNotificationMessage(
  type: NotificationType,
  params: Record<string, string | number>,
): NotificationPayload {
  switch (type) {
    case "POST_APPROVED":
      return {
        type,
        title: "게시물 승인됨",
        body: `작성하신 안전 제보가 승인되었습니다. ${params.points || 0}포인트가 적립되었습니다.`,
        data: { postId: String(params.postId || "") },
      };

    case "POST_REJECTED":
      return {
        type,
        title: "게시물 반려됨",
        body: `작성하신 안전 제보가 반려되었습니다. 사유: ${params.reason || "미기재"}`,
        data: { postId: String(params.postId || "") },
      };

    case "POINTS_AWARDED":
      return {
        type,
        title: "포인트 지급",
        body: `${params.points || 0}포인트가 지급되었습니다. 사유: ${params.reason || "관리자 지급"}`,
      };

    case "DISPUTE_RESOLVED":
      return {
        type,
        title: "이의신청 처리완료",
        body: `등록하신 이의신청이 처리되었습니다.`,
        data: { disputeId: String(params.disputeId || "") },
      };

    case "ANNOUNCEMENT":
      return {
        type,
        title: String(params.title || "공지사항"),
        body: String(params.body || ""),
      };

    default:
      return {
        type: "ANNOUNCEMENT",
        title: "알림",
        body: String(params.message || ""),
      };
  }
}

async function generateHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
