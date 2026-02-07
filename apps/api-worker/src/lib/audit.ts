import { drizzle } from "drizzle-orm/d1";
import { auditLogs } from "../db/schema";
import type { Context } from "hono";

/**
 * Audit log action types as defined in PRD Appendix B
 */
export type AuditAction =
  | "PII_VIEW" // When piiViewFull is used to decrypt PII
  | "EXCEL_EXPORT" // CSV/Excel data export
  | "IMAGE_DOWNLOAD" // Bulk image download
  | "POINT_AWARD" // Manual point award
  | "POLICY_CHANGE" // Point policy modification
  | "PERMISSION_CHANGE" // Role or flag changes
  | "FORCED_STATUS_CHANGE" // Admin override of post status
  // Legacy actions (kept for compatibility)
  | "LOGIN_LOCKOUT_RESET"
  | "USER_RESTRICTION_CLEARED"
  | "USER_ROLE_CHANGED"
  | "FAS_WORKERS_SYNCED"
  | "POST_REVIEWED"
  | "MANUAL_APPROVAL_CREATED"
  | "MANUAL_APPROVAL_APPROVED"
  | "MANUAL_APPROVAL_REJECTED"
  | "VOTE_CANDIDATE_ADDED"
  | "VOTE_CANDIDATE_REMOVED"
  | "EXPORT_POSTS"
  | "EXPORT_USERS"
  | "EXPORT_POINTS"
  | "PUSH_NOTIFICATION_SENT"
  | "MONTHLY_SUMMARY_SENT"
  | "AUDIT_LOG_CLEANUP"
  | "ROLE_CHANGE"
  | "EDUCATION_CONTENT_CREATED"
  | "EDUCATION_CONTENT_DELETED"
  | "QUIZ_CREATED"
  | "QUIZ_POINTS_AWARDED"
  | "STATUTORY_TRAINING_CREATED"
  | "TBM_CREATED";

/**
 * Target types for audit logging
 */
export type AuditTargetType =
  | "USER"
  | "POST"
  | "SITE"
  | "EXPORT"
  | "IMAGE"
  | "POINT"
  | "POLICY"
  | "PERMISSION"
  | "REVIEW"
  | "VOTE_CANDIDATE"
  | "MANUAL_APPROVAL"
  | "LOGIN_LOCKOUT"
  | "NOTIFICATION"
  | "EDUCATION_CONTENT"
  | "QUIZ"
  | "STATUTORY_TRAINING"
  | "TBM_RECORD"
  | "SYSTEM";

/**
 * Audit log details interface for structured data
 */
export interface AuditDetails {
  // PII_VIEW
  field?: string;
  reason?: string;
  targetUserId?: string;

  // EXCEL_EXPORT
  filterConditions?: Record<string, unknown>;
  rowCount?: number;

  // IMAGE_DOWNLOAD
  imageIds?: string[];

  // POINT_AWARD
  amount?: number;
  postId?: string;
  reasonCode?: string;
  userId?: string;

  // POLICY_CHANGE
  policyKey?: string;
  oldValue?: unknown;
  newValue?: unknown;

  // PERMISSION_CHANGE
  role?: string;
  flag?: string;
  action?: string;
  oldRole?: string;
  newRole?: string;
  oldFlags?: Record<string, boolean>;
  newFlags?: Record<string, boolean>;

  // FORCED_STATUS_CHANGE
  oldStatus?: string;
  newStatus?: string;

  // Generic
  [key: string]: unknown;
}

/**
 * Get client IP from request context
 */
export function getClientIp(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown"
  );
}

/**
 * Get user agent from request context
 */
export function getUserAgent(c: Context): string {
  return c.req.header("User-Agent") || "";
}

/**
 * Insert an audit log entry with all required fields
 *
 * @param db D1 database binding
 * @param action The audit action type (from PRD Appendix B)
 * @param actorId ID of the user performing the action
 * @param targetType Type of the target entity
 * @param targetId ID of the target entity
 * @param details Structured details object (JSON serialized)
 * @param ip Client IP address
 * @param userAgent Client user agent string
 */
export async function logAudit(
  db: ReturnType<typeof drizzle>,
  action: AuditAction,
  actorId: string,
  targetType: AuditTargetType,
  targetId: string,
  details: AuditDetails,
  ip: string,
  userAgent: string,
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId,
    action,
    targetType,
    targetId,
    reason: JSON.stringify(details),
    ip,
    userAgent,
  });
}

/**
 * Convenience function to log audit with context extraction
 */
export async function logAuditWithContext(
  c: Context,
  db: ReturnType<typeof drizzle>,
  action: AuditAction,
  actorId: string,
  targetType: AuditTargetType,
  targetId: string,
  details: AuditDetails,
): Promise<void> {
  await logAudit(
    db,
    action,
    actorId,
    targetType,
    targetId,
    details,
    getClientIp(c),
    getUserAgent(c),
  );
}
