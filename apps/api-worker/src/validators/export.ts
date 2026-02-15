import { z } from "zod";

/**
 * Strict date validation for export query parameters.
 * Only accepts ISO 8601 YYYY-MM-DD format.
 */
const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((dateStr) => {
    const date = new Date(`${dateStr}T00:00:00Z`);
    return (
      !isNaN(date.getTime()) &&
      date.getFullYear() >= 2000 &&
      date.getFullYear() <= 2100
    );
  }, "Date must be valid and within reasonable range (2000-2100)");

/**
 * Query schema for POST CSV export endpoint
 */
export const ExportPostsQuerySchema = z.object({
  format: z.enum(["csv"]).default("csv"),
  site: z.string().uuid().optional(),
  category: z.string().optional(),
  status: z
    .enum(["PENDING", "RECEIVED", "IN_REVIEW", "APPROVED", "REJECTED", "NEED_INFO"])
    .optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
  withContent: z.boolean().optional().default(false),
  page: z
    .string()
    .optional()
    .transform((p) => {
      if (!p) return 1;
      const num = parseInt(p, 10);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
});

/**
 * Query schema for USER CSV export endpoint
 */
export const ExportUsersQuerySchema = z.object({
  format: z.enum(["csv"]).default("csv"),
  search: z.string().optional(),
  site: z.string().uuid().optional(),
  role: z.string().optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
  page: z
    .string()
    .optional()
    .transform((p) => {
      if (!p) return 1;
      const num = parseInt(p, 10);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
});

/**
 * Query schema for ATTENDANCE CSV export endpoint
 */
export const ExportAttendanceQuerySchema = z.object({
  format: z.enum(["csv"]).default("csv"),
  site: z.string().uuid().optional(),
  userId: z.string().optional(),
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
  page: z
    .string()
    .optional()
    .transform((p) => {
      if (!p) return 1;
      const num = parseInt(p, 10);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
});

export type ExportPostsQuery = z.infer<typeof ExportPostsQuerySchema>;
export type ExportUsersQuery = z.infer<typeof ExportUsersQuerySchema>;
export type ExportAttendanceQuery = z.infer<
  typeof ExportAttendanceQuerySchema
>;
