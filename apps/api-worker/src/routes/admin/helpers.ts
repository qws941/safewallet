import type { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { users, siteMemberships } from "../../db/schema";
import { error } from "../../lib/response";

export type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

export const DAY_CUTOFF_HOUR = 5;
export const EXPORT_RATE_LIMIT = { maxRequests: 5, windowMs: 60 * 1000 };
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);

  const kstBoundary = new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      DAY_CUTOFF_HOUR,
      0,
      0,
      0,
    ),
  );

  if (kstNow.getUTCHours() < DAY_CUTOFF_HOUR) {
    kstBoundary.setUTCDate(kstBoundary.getUTCDate() - 1);
  }

  const start = new Date(kstBoundary.getTime() - KST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

export function getClientIp(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown"
  );
}

export function parseDateParam(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function getKstDayRangeFromDate(value?: string): {
  start: Date;
  end: Date;
} | null {
  if (!value) {
    return null;
  }

  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }

  const year = Number(dateOnly.slice(0, 4));
  const month = Number(dateOnly.slice(5, 7));
  const day = Number(dateOnly.slice(8, 10));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function toExclusiveEndDate(value?: string): Date | null {
  const parsed = parseDateParam(value);
  if (!parsed) {
    return null;
  }
  if (value && value.length <= 10) {
    const end = new Date(parsed);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return end;
  }
  return parsed;
}

export function formatKst(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function formatYearMonth(value: Date): string {
  const koreaTime = new Date(
    value.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

export function csvResponse(
  c: Context,
  csv: string,
  filename: string,
): Response {
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(csv);
}

export const requireAdmin = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  if (
    user.role !== "ADMIN" &&
    user.role !== "SITE_ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
  }
  await next();
};

export const requireExportAccess = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  if (user.role === "SUPER_ADMIN") {
    await next();
    return;
  }

  const db = drizzle(c.env.DB);
  const userRecord = await db
    .select({ canExport: users.canManageUsers })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (!userRecord?.canExport) {
    return error(
      c,
      "EXPORT_ACCESS_REQUIRED",
      "Export permission required",
      403,
    );
  }

  await next();
};

export const exportRateLimit = rateLimitMiddleware({
  ...EXPORT_RATE_LIMIT,
  keyGenerator: (c) => {
    const auth = c.get("auth");
    return auth?.user?.id ? `export:${auth.user.id}` : "export:anonymous";
  },
});

export const requireManagerOrAdmin = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId") || c.req.param("siteId");

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    await next();
    return;
  }

  if (!siteId) {
    return error(c, "SITE_ID_REQUIRED", "Site ID required", 400);
  }

  const db = drizzle(c.env.DB);
  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership || membership.role === "WORKER") {
    return error(c, "MANAGER_ACCESS_REQUIRED", "Manager access required", 403);
  }

  await next();
};
