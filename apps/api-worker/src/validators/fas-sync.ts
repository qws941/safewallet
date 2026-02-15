import { z } from "zod";

/**
 * Strict validation schemas for FAS (Foreign Attendance System) sync operations.
 * Prevents SQL injection, DOS, and data corruption.
 */

/**
 * FAS timestamp format: YYYY-MM-DD HH:MM:SS
 */
const FasTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    "Invalid FAS timestamp format (expected YYYY-MM-DD HH:MM:SS)",
  )
  .refine((timestamp) => {
    const date = new Date(timestamp.replace(" ", "T"));
    return (
      !isNaN(date.getTime()) &&
      date.getFullYear() >= 2000 &&
      date.getFullYear() <= 2100
    );
  }, "Timestamp must be valid and within reasonable range (2000-2100)");

/**
 * Individual FAS employee payload schema
 */
export const FasEmployeePayloadSchema = z.object({
  externalWorkerId: z.string().min(1).max(20).trim(),
  name: z.string().min(1).max(100).trim(),
  companyName: z.string().max(100).nullable().optional(),
  position: z.string().max(50).nullable().optional(),
  trade: z.string().max(50).nullable().optional(),
  lastSeen: FasTimestampSchema.nullable().optional(),
});

/**
 * AceViewer employees payload schema
 */
export const AceViewerEmployeesPayloadSchema = z.object({
  employees: z
    .array(FasEmployeePayloadSchema)
    .min(0)
    .max(100000)
    .describe("Array of employee records"),
  total: z
    .number()
    .int()
    .min(0)
    .max(100000)
    .describe("Total count of employees"),
});

/**
 * Parameters for fasGetUpdatedEmployees function
 */
export const FasGetUpdatedEmployeesParamsSchema = z.object({
  sinceTimestamp: FasTimestampSchema.nullable().optional().default(null),
});

/**
 * Parameters for attendance sync endpoint
 */
export const AttendanceSyncEventSchema = z.object({
  fasEventId: z.string().min(1).max(50),
  fasUserId: z.string().min(1).max(20),
  checkinAt: z.string().datetime().or(FasTimestampSchema),
  siteId: z.string().uuid().optional().nullable(),
});

export const AttendanceSyncBodySchema = z.object({
  events: z.array(AttendanceSyncEventSchema).min(1).max(1000),
});

/**
 * Response structure for sync operations
 */
export const SyncResultSchema = z.object({
  fasEventId: z.string(),
  result: z.enum(["SUCCESS", "DUPLICATE", "NOT_FOUND", "MISSING_SITE", "ERROR"]),
});

export const AttendanceSyncResponseSchema = z.object({
  processed: z.number().int().min(0),
  inserted: z.number().int().min(0),
  skipped: z.number().int().min(0),
  failed: z.number().int().min(0),
  results: z.array(SyncResultSchema),
});

// Type exports
export type FasEmployeePayload = z.infer<typeof FasEmployeePayloadSchema>;
export type AceViewerEmployeesPayload = z.infer<
  typeof AceViewerEmployeesPayloadSchema
>;
export type FasGetUpdatedEmployeesParams = z.infer<
  typeof FasGetUpdatedEmployeesParamsSchema
>;
export type AttendanceSyncEvent = z.infer<typeof AttendanceSyncEventSchema>;
export type AttendanceSyncBody = z.infer<typeof AttendanceSyncBodySchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type AttendanceSyncResponse = z.infer<
  typeof AttendanceSyncResponseSchema
>;
