import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { sendPushToUser, sendPushToSiteAdmins } from "./push";

type Env = {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

type NotifyEvent =
  | {
      type: "POST_APPROVED";
      postId: string;
      userId: string;
      siteId: string;
      points?: number;
    }
  | {
      type: "POST_REJECTED";
      postId: string;
      userId: string;
      siteId: string;
      reasonCode: string;
      comment?: string;
    }
  | {
      type: "INFO_REQUESTED";
      postId: string;
      userId: string;
      siteId: string;
      comment?: string;
    }
  | {
      type: "NEW_POST";
      postId: string;
      userId: string;
      siteId: string;
      category: string;
      isUrgent?: boolean;
    }
  | { type: "URGENT_FLAGGED"; postId: string; siteId: string }
  | {
      type: "ACTION_ASSIGNED";
      postId: string;
      actionId: string;
      assigneeId: string;
      siteId: string;
      dueDate?: string;
    }
  | {
      type: "ACTION_COMPLETED";
      postId: string;
      actionId: string;
      siteId: string;
    }
  | {
      type: "POINTS_AWARDED";
      userId: string;
      siteId: string;
      amount: number;
      reason: string;
    }
  | {
      type: "DISPUTE_RESOLVED";
      disputeId: string;
      userId: string;
      siteId: string;
      resolution: string;
    };

const MESSAGES: Record<
  NotifyEvent["type"],
  (e: NotifyEvent) => { title: string; body: string }
> = {
  POST_APPROVED: () => ({
    title: "게시물 승인",
    body: "게시물이 승인되었습니다. 포인트가 적립되었습니다.",
  }),
  POST_REJECTED: (e) => ({
    title: "게시물 반려",
    body: `게시물이 반려되었습니다.${(e as { comment?: string }).comment ? ` 사유: ${(e as { comment?: string }).comment}` : ""}`,
  }),
  INFO_REQUESTED: () => ({
    title: "추가 정보 요청",
    body: "게시물에 추가 정보가 필요합니다. 확인해주세요.",
  }),
  NEW_POST: (e) => ({
    title: (e as { isUrgent?: boolean }).isUrgent
      ? "🚨 긴급 게시물"
      : "새 게시물",
    body: `새로운 안전 보고가 접수되었습니다.`,
  }),
  URGENT_FLAGGED: () => ({
    title: "🚨 긴급 지정",
    body: "게시물이 긴급으로 지정되었습니다. 즉시 확인이 필요합니다.",
  }),
  ACTION_ASSIGNED: (e) => ({
    title: "시정조치 배정",
    body: `시정조치가 배정되었습니다.${(e as { dueDate?: string }).dueDate ? ` 기한: ${(e as { dueDate?: string }).dueDate}` : ""}`,
  }),
  ACTION_COMPLETED: () => ({
    title: "시정조치 완료",
    body: "시정조치가 완료 보고되었습니다. 확인해주세요.",
  }),
  POINTS_AWARDED: (e) => ({
    title: "포인트 적립",
    body: `${(e as { amount: number }).amount}포인트가 적립되었습니다.`,
  }),
  DISPUTE_RESOLVED: () => ({
    title: "이의제기 처리 완료",
    body: "이의제기가 처리되었습니다. 결과를 확인해주세요.",
  }),
};

export async function notifyEvent(env: Env, event: NotifyEvent): Promise<void> {
  const message = MESSAGES[event.type](event);
  const db = drizzle(env.DB);
  const payload = { title: message.title, body: message.body };

  try {
    switch (event.type) {
      case "POST_APPROVED":
      case "POST_REJECTED":
      case "INFO_REQUESTED":
      case "POINTS_AWARDED":
      case "DISPUTE_RESOLVED":
        await sendPushToUser(db, env, event.userId, payload);
        break;

      case "ACTION_ASSIGNED":
        await sendPushToUser(db, env, event.assigneeId, payload);
        break;

      case "NEW_POST":
      case "URGENT_FLAGGED":
      case "ACTION_COMPLETED":
        await sendPushToSiteAdmins(db, env, event.siteId, payload);
        break;
    }
  } catch {
    // Notification failure is non-fatal: silent catch prevents push errors from breaking business logic
  }
}
