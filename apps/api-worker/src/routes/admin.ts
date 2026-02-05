import { Hono, type Context, type Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, desc, gte, lt } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import {
  users,
  sites,
  siteMemberships,
  posts,
  manualApprovals,
  auditLogs,
  attendance,
  reviews,
  pointsLedger,
  userRoleEnum,
  membershipStatusEnum,
  reviewStatusEnum,
  voteCandidates,
} from "../db/schema";
import { hmac, encrypt, decrypt } from "../lib/crypto";
import { success, error } from "../lib/response";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

type UserExportRow = {
  user: typeof users.$inferSelect;
  membership?: {
    siteId: string;
    status: (typeof membershipStatusEnum)[number];
    joinedAt: Date | null;
  };
};

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

const DAY_CUTOFF_HOUR = 5;
const EXPORT_RATE_LIMIT = { maxRequests: 5, windowMs: 60 * 1000 };

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const koreaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );

  if (koreaTime.getHours() < DAY_CUTOFF_HOUR) {
    koreaTime.setDate(koreaTime.getDate() - 1);
  }

  const start = new Date(koreaTime);
  start.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);

  const end = new Date(koreaTime);
  end.setDate(end.getDate() + 1);
  end.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);

  return { start, end };
}

function getClientIp(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown"
  );
}

function parseDateParam(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toExclusiveEndDate(value?: string): Date | null {
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

function formatKst(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatYearMonth(value: Date): string {
  const koreaTime = new Date(
    value.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

function csvResponse(c: Context, csv: string, filename: string): Response {
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(csv);
}

const requireAdmin = async (c: AppContext, next: Next) => {
  const { user } = c.get("auth");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
  }
  await next();
};

const requireExportAccess = async (c: AppContext, next: Next) => {
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

const exportRateLimit = rateLimitMiddleware({
  ...EXPORT_RATE_LIMIT,
  keyGenerator: (c) => {
    const auth = c.get("auth");
    return auth?.user?.id ? `export:${auth.user.id}` : "export:anonymous";
  },
});

app.get("/unlock-user/:phoneHash", requireAdmin, async (c) => {
  const phoneHash = c.req.param("phoneHash");
  if (!phoneHash) {
    return error(c, "PHONE_HASH_REQUIRED", "phoneHash is required", 400);
  }

  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const key = `login_attempts:${phoneHash}`;

  await c.env.KV.delete(key);

  await db.insert(auditLogs).values({
    action: "LOGIN_LOCKOUT_RESET",
    actorId: currentUser.id,
    targetType: "LOGIN_LOCKOUT",
    targetId: phoneHash,
    reason: "Admin unlock",
  });

  return success(c, { unlocked: true });
});

app.get("/export/posts", requireExportAccess, exportRateLimit, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const format = c.req.query("format") || "csv";
  const siteId = c.req.query("siteId");
  const status = c.req.query("status");
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  if (format !== "csv") {
    return error(c, "UNSUPPORTED_FORMAT", "Only csv format supported", 400);
  }

  if (
    status &&
    !reviewStatusEnum.includes(status as (typeof reviewStatusEnum)[number])
  ) {
    return error(
      c,
      "INVALID_STATUS",
      `Invalid status. Must be one of: ${reviewStatusEnum.join(", ")}`,
      400,
    );
  }

  const fromDate = parseDateParam(fromParam);
  const toExclusive = toExclusiveEndDate(toParam);
  if (fromParam && !fromDate) {
    return error(c, "INVALID_FROM", "Invalid from date", 400);
  }
  if (toParam && !toExclusive) {
    return error(c, "INVALID_TO", "Invalid to date", 400);
  }

  const conditions = [];
  if (siteId) {
    conditions.push(eq(posts.siteId, siteId));
  }
  if (status) {
    const reviewStatus = status as (typeof reviewStatusEnum)[number];
    conditions.push(eq(posts.reviewStatus, reviewStatus));
  }
  if (fromDate) {
    conditions.push(gte(posts.createdAt, fromDate));
  }
  if (toExclusive) {
    conditions.push(lt(posts.createdAt, toExclusive));
  }

  const results = await db
    .select({
      post: posts,
      site: { id: sites.id, name: sites.name },
      author: { id: users.id, nameMasked: users.nameMasked },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .leftJoin(sites, eq(posts.siteId, sites.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .all();

  const headers = [
    "게시글 ID",
    "현장 ID",
    "현장명",
    "작성자 ID",
    "작성자",
    "카테고리",
    "위험도",
    "검토 상태",
    "조치 상태",
    "익명 여부",
    "중복 의심",
    "내용",
    "작성일시",
  ];

  const rows = results.map((row) => [
    row.post.id,
    row.post.siteId,
    row.site?.name || "",
    row.post.userId,
    row.author?.nameMasked || "",
    row.post.category,
    row.post.riskLevel || "",
    row.post.reviewStatus,
    row.post.actionStatus,
    row.post.isAnonymous ? "Y" : "N",
    row.post.isPotentialDuplicate ? "Y" : "N",
    row.post.content,
    formatKst(row.post.createdAt),
  ]);

  await db.insert(auditLogs).values({
    action: "EXPORT_POSTS",
    actorId: currentUser.id,
    targetType: "EXPORT",
    targetId: siteId || "ALL",
    reason: `from=${fromParam || ""}, to=${toParam || ""}, status=${status || ""}`,
    ip: getClientIp(c),
    userAgent: c.req.header("User-Agent") || "",
  });

  const filenameDate = fromDate
    ? formatYearMonth(fromDate)
    : toExclusive
      ? formatYearMonth(new Date(toExclusive.getTime() - 1))
      : formatYearMonth(new Date());
  const csv = buildCsv(headers, rows);
  return csvResponse(c, csv, `posts-${filenameDate}.csv`);
});

app.get("/export/users", requireExportAccess, exportRateLimit, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const format = c.req.query("format") || "csv";
  const siteId = c.req.query("siteId");
  const status = c.req.query("status");
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  if (format !== "csv") {
    return error(c, "UNSUPPORTED_FORMAT", "Only csv format supported", 400);
  }

  if (
    status &&
    !membershipStatusEnum.includes(
      status as (typeof membershipStatusEnum)[number],
    )
  ) {
    return error(
      c,
      "INVALID_STATUS",
      `Invalid status. Must be one of: ${membershipStatusEnum.join(", ")}`,
      400,
    );
  }

  if (status && !siteId) {
    return error(
      c,
      "SITE_ID_REQUIRED",
      "siteId is required for status filter",
      400,
    );
  }

  const fromDate = parseDateParam(fromParam);
  const toExclusive = toExclusiveEndDate(toParam);
  if (fromParam && !fromDate) {
    return error(c, "INVALID_FROM", "Invalid from date", 400);
  }
  if (toParam && !toExclusive) {
    return error(c, "INVALID_TO", "Invalid to date", 400);
  }

  const conditions = [];
  if (fromDate) {
    conditions.push(gte(users.createdAt, fromDate));
  }
  if (toExclusive) {
    conditions.push(lt(users.createdAt, toExclusive));
  }

  if (siteId) {
    conditions.push(eq(siteMemberships.siteId, siteId));
  }
  if (status) {
    const membershipStatus = status as (typeof membershipStatusEnum)[number];
    conditions.push(eq(siteMemberships.status, membershipStatus));
  }

  const results: UserExportRow[] =
    siteId || status
      ? await db
          .select({
            user: users,
            membership: {
              siteId: siteMemberships.siteId,
              status: siteMemberships.status,
              joinedAt: siteMemberships.joinedAt,
            },
          })
          .from(users)
          .innerJoin(siteMemberships, eq(siteMemberships.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(users.createdAt))
          .all()
      : await db
          .select({ user: users })
          .from(users)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(users.createdAt))
          .all();

  const headers = [
    "사용자 ID",
    "이름",
    "역할",
    "회사명",
    "직종",
    "현장 ID",
    "멤버십 상태",
    "가입일",
    "생성일시",
  ];

  const rows = results.map((row) => {
    const membership = row.membership;
    return [
      row.user.id,
      row.user.nameMasked || "",
      row.user.role,
      row.user.companyName || "",
      row.user.tradeType || "",
      membership?.siteId || siteId || "",
      membership?.status || "",
      formatKst(membership?.joinedAt || null),
      formatKst(row.user.createdAt),
    ];
  });

  await db.insert(auditLogs).values({
    action: "EXPORT_USERS",
    actorId: currentUser.id,
    targetType: "EXPORT",
    targetId: siteId || "ALL",
    reason: `from=${fromParam || ""}, to=${toParam || ""}, status=${status || ""}`,
    ip: getClientIp(c),
    userAgent: c.req.header("User-Agent") || "",
  });

  const filenameDate = fromDate
    ? formatYearMonth(fromDate)
    : toExclusive
      ? formatYearMonth(new Date(toExclusive.getTime() - 1))
      : formatYearMonth(new Date());
  const csv = buildCsv(headers, rows);
  return csvResponse(c, csv, `users-${filenameDate}.csv`);
});

app.get("/export/points", requireExportAccess, exportRateLimit, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const format = c.req.query("format") || "csv";
  const siteId = c.req.query("siteId");
  const month = c.req.query("month");

  if (format !== "csv") {
    return error(c, "UNSUPPORTED_FORMAT", "Only csv format supported", 400);
  }

  if (!siteId || !month) {
    return error(c, "MISSING_PARAMS", "siteId and month are required", 400);
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
  }

  const results = await db
    .select({
      ledger: pointsLedger,
      site: { id: sites.id, name: sites.name },
      user: { id: users.id, nameMasked: users.nameMasked },
    })
    .from(pointsLedger)
    .leftJoin(users, eq(pointsLedger.userId, users.id))
    .leftJoin(sites, eq(pointsLedger.siteId, sites.id))
    .where(
      and(eq(pointsLedger.siteId, siteId), eq(pointsLedger.settleMonth, month)),
    )
    .orderBy(desc(pointsLedger.occurredAt))
    .all();

  const headers = [
    "정산 ID",
    "현장 ID",
    "현장명",
    "사용자 ID",
    "사용자",
    "게시글 ID",
    "점수",
    "사유 코드",
    "사유",
    "정산 월",
    "발생일시",
    "관리자 ID",
  ];

  const rows = results.map((row) => [
    row.ledger.id,
    row.ledger.siteId,
    row.site?.name || "",
    row.ledger.userId,
    row.user?.nameMasked || "",
    row.ledger.postId || "",
    row.ledger.amount,
    row.ledger.reasonCode,
    row.ledger.reasonText || "",
    row.ledger.settleMonth,
    formatKst(row.ledger.occurredAt),
    row.ledger.adminId || "",
  ]);

  await db.insert(auditLogs).values({
    action: "EXPORT_POINTS",
    actorId: currentUser.id,
    targetType: "EXPORT",
    targetId: siteId,
    reason: `month=${month}`,
    ip: getClientIp(c),
    userAgent: c.req.header("User-Agent") || "",
  });

  const csv = buildCsv(headers, rows);
  return csvResponse(c, csv, `points-${month}.csv`);
});

const requireManagerOrAdmin = async (c: AppContext, next: Next) => {
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

app.get("/users", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const currentUserRecord = await db
    .select({ piiViewFull: users.piiViewFull })
    .from(users)
    .where(eq(users.id, currentUser.id))
    .get();
  const canViewFullPii = currentUserRecord?.piiViewFull ?? false;

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      phoneEncrypted: users.phoneEncrypted,
      dobEncrypted: users.dobEncrypted,
      role: users.role,
      falseReportCount: users.falseReportCount,
      restrictedUntil: users.restrictedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .get();

  const usersWithPii = canViewFullPii
    ? await Promise.all(
        allUsers.map(async (row) => ({
          id: row.id,
          name: row.name,
          nameMasked: row.nameMasked,
          phone: row.phoneEncrypted
            ? await decrypt(c.env.ENCRYPTION_KEY, row.phoneEncrypted)
            : null,
          dob: row.dobEncrypted
            ? await decrypt(c.env.ENCRYPTION_KEY, row.dobEncrypted)
            : null,
          role: row.role,
          falseReportCount: row.falseReportCount,
          restrictedUntil: row.restrictedUntil,
          createdAt: row.createdAt,
        })),
      )
    : allUsers.map((row) => ({
        id: row.id,
        name: row.name,
        nameMasked: row.nameMasked,
        phone: null,
        dob: null,
        role: row.role,
        falseReportCount: row.falseReportCount,
        restrictedUntil: row.restrictedUntil,
        createdAt: row.createdAt,
      }));

  return success(c, {
    users: usersWithPii,
    total: totalResult?.count || 0,
  });
});

app.get("/users/restrictions", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const activeOnly = c.req.query("activeOnly") === "true";
  const now = new Date();

  const conditions = [];
  if (activeOnly) {
    conditions.push(gte(users.restrictedUntil, now));
  }

  const restrictedUsers = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      role: users.role,
      falseReportCount: users.falseReportCount,
      restrictedUntil: users.restrictedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.restrictedUntil))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .get();

  return success(c, {
    users: restrictedUsers,
    total: totalResult?.count || 0,
  });
});

app.post("/users/:id/restriction/clear", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const userId = c.req.param("id");

  const updated = await db
    .update(users)
    .set({ falseReportCount: 0, restrictedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  await db.insert(auditLogs).values({
    action: "USER_RESTRICTION_CLEARED",
    actorId: currentUser.id,
    targetType: "USER",
    targetId: userId,
    reason: "False report restriction cleared",
  });

  return success(c, { user: updated });
});

app.patch("/users/:id/role", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const userId = c.req.param("id");

  let body: { role?: string };
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  const validRoles: readonly string[] = userRoleEnum;
  if (!body.role || !validRoles.includes(body.role)) {
    return error(
      c,
      "INVALID_ROLE",
      `Invalid role. Must be one of: ${userRoleEnum.join(", ")}`,
      400,
    );
  }
  const role = body.role as (typeof userRoleEnum)[number];

  if (userId === currentUser.id) {
    return error(
      c,
      "CANNOT_CHANGE_OWN_ROLE",
      "Cannot change your own role",
      400,
    );
  }

  const updated = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  await db.insert(auditLogs).values({
    action: "USER_ROLE_CHANGED",
    actorId: currentUser.id,
    targetType: "USER",
    targetId: userId,
    reason: `Role changed to ${role}`,
  });

  return success(c, { user: updated });
});

interface FasWorkerInput {
  externalWorkerId: string;
  name: string;
  phone: string;
  dob: string;
}

interface SyncFasWorkersBody {
  siteId: string;
  workers: FasWorkerInput[];
}

app.post("/fas/sync-workers", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");

  let body: SyncFasWorkersBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.siteId || !Array.isArray(body.workers)) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "siteId and workers array required",
      400,
    );
  }

  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.id, body.siteId))
    .get();

  if (!site) {
    return error(c, "SITE_NOT_FOUND", "Site not found", 404);
  }

  const results = {
    created: 0,
    updated: 0,
    membershipCreated: 0,
  };

  for (const worker of body.workers) {
    if (
      !worker.externalWorkerId ||
      !worker.name ||
      !worker.phone ||
      !worker.dob
    ) {
      continue;
    }

    const normalizedPhone = worker.phone.replace(/[^0-9]/g, "");
    const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
    const dobHash = await hmac(c.env.HMAC_SECRET, worker.dob);
    const phoneEncrypted = await encrypt(c.env.ENCRYPTION_KEY, normalizedPhone);
    const dobEncrypted = await encrypt(c.env.ENCRYPTION_KEY, worker.dob);

    let existingUser = await db
      .select()
      .from(users)
      .where(eq(users.externalWorkerId, worker.externalWorkerId))
      .get();

    if (!existingUser) {
      existingUser = await db
        .select()
        .from(users)
        .where(eq(users.phoneHash, phoneHash))
        .get();
    }

    if (existingUser) {
      await db
        .update(users)
        .set({
          externalWorkerId: worker.externalWorkerId,
          name: worker.name,
          nameMasked:
            worker.name.length > 1
              ? worker.name[0] + "*".repeat(worker.name.length - 1)
              : worker.name,
          phone: phoneHash,
          phoneHash,
          phoneEncrypted,
          dob: null,
          dobHash,
          dobEncrypted,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
      results.updated++;
    } else {
      const newUser = await db
        .insert(users)
        .values({
          externalWorkerId: worker.externalWorkerId,
          externalSystem: "FAS",
          phone: phoneHash,
          phoneHash,
          phoneEncrypted,
          dob: null,
          dobHash,
          dobEncrypted,
          name: worker.name,
          nameMasked:
            worker.name.length > 1
              ? worker.name[0] + "*".repeat(worker.name.length - 1)
              : worker.name,
          role: "WORKER",
        })
        .returning()
        .get();
      existingUser = newUser;
      results.created++;
    }

    const existingMembership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, existingUser.id),
          eq(siteMemberships.siteId, body.siteId),
        ),
      )
      .get();

    if (!existingMembership) {
      await db.insert(siteMemberships).values({
        userId: existingUser.id,
        siteId: body.siteId,
        role: "WORKER",
        status: "ACTIVE",
      });
      results.membershipCreated++;
    }
  }

  await db.insert(auditLogs).values({
    action: "FAS_WORKERS_SYNCED",
    actorId: currentUser.id,
    targetType: "SITE",
    targetId: body.siteId,
    reason: `Synced ${results.created} created, ${results.updated} updated, ${results.membershipCreated} memberships`,
  });

  return success(c, { results });
});

app.get("/posts/pending-review", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [];
  if (siteId) {
    conditions.push(eq(posts.siteId, siteId));
  }

  const pendingPosts = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    posts: pendingPosts.map((row) => ({
      ...row.post,
      author: row.author,
      duplicateWarning: row.post.isPotentialDuplicate,
    })),
  });
});

interface ReviewPostBody {
  action: "APPROVE" | "REJECT" | "REQUEST_MORE";
  comment?: string;
  pointsToAward?: number;
  reasonCode?: string;
}

app.post("/posts/:id/review", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: reviewer } = c.get("auth");
  const postId = c.req.param("id");

  let body: ReviewPostBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  const validActions = ["APPROVE", "REJECT", "REQUEST_MORE"];
  if (!body.action || !validActions.includes(body.action)) {
    return error(c, "INVALID_ACTION", "Invalid action", 400);
  }

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  if (body.action === "APPROVE") {
    const { start, end } = getTodayRange();
    const [approvedCountRow, pointsSumRow] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(reviews)
        .innerJoin(posts, eq(reviews.postId, posts.id))
        .where(
          and(
            eq(reviews.action, "APPROVE"),
            eq(posts.userId, post.userId),
            eq(posts.siteId, post.siteId),
            gte(reviews.createdAt, start),
            lt(reviews.createdAt, end),
          ),
        )
        .get(),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
        })
        .from(pointsLedger)
        .where(
          and(
            eq(pointsLedger.userId, post.userId),
            eq(pointsLedger.siteId, post.siteId),
            gte(pointsLedger.occurredAt, start),
            lt(pointsLedger.occurredAt, end),
          ),
        )
        .get(),
    ]);

    const approvedCount = approvedCountRow?.count ?? 0;
    const pointsAwarded = pointsSumRow?.total ?? 0;
    const pointsToAward = body.pointsToAward ?? 0;
    const projectedPoints =
      pointsAwarded + (pointsToAward > 0 ? pointsToAward : 0);

    if (approvedCount >= 3 || pointsAwarded >= 30 || projectedPoints > 30) {
      return error(
        c,
        "DAILY_LIMIT_EXCEEDED",
        `Daily limit exceeded: ${approvedCount} approved posts and ${pointsAwarded} points today for this site.`,
        400,
      );
    }
  }

  const review = await db
    .insert(reviews)
    .values({
      postId,
      adminId: reviewer.id,
      action: body.action,
      comment: body.comment,
      reasonCode: body.reasonCode,
    })
    .returning()
    .get();

  const pointsToAward = post.isPotentialDuplicate ? 0 : body.pointsToAward || 0;

  if (body.action === "APPROVE" && pointsToAward > 0) {
    const now = new Date();
    const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await db.insert(pointsLedger).values({
      userId: post.userId,
      siteId: post.siteId,
      postId: post.id,
      amount: pointsToAward,
      reasonCode: "POST_APPROVED",
      reasonText: `Post approved: ${post.id}`,
      adminId: reviewer.id,
      settleMonth,
    });
  }

  if (body.action === "REJECT" && body.reasonCode === "FALSE") {
    const userRecord = await db
      .select({
        falseReportCount: users.falseReportCount,
        restrictedUntil: users.restrictedUntil,
      })
      .from(users)
      .where(eq(users.id, post.userId))
      .get();

    if (userRecord) {
      const nextCount = (userRecord.falseReportCount ?? 0) + 1;
      const now = new Date();
      let restrictedUntil = userRecord.restrictedUntil ?? null;

      if (nextCount >= 3 && (!restrictedUntil || restrictedUntil <= now)) {
        restrictedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      await db
        .update(users)
        .set({
          falseReportCount: nextCount,
          restrictedUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, post.userId));
    }
  }

  await db.insert(auditLogs).values({
    action: "POST_REVIEWED",
    actorId: reviewer.id,
    targetType: "POST",
    targetId: postId,
    reason: `Action: ${body.action}, Points: ${pointsToAward}`,
  });

  return success(c, { review });
});

interface ManualApprovalBody {
  userId: string;
  siteId: string;
  reason: string;
}

app.post("/manual-approval", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: approver } = c.get("auth");

  let body: ManualApprovalBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.userId || !body.siteId || !body.reason) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "userId, siteId, and reason are required",
      400,
    );
  }

  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.id, body.userId))
    .get();

  if (!targetUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  const now = new Date();
  const approval = await db
    .insert(manualApprovals)
    .values({
      userId: body.userId,
      siteId: body.siteId,
      approvedById: approver.id,
      reason: body.reason,
      validDate: now,
    })
    .returning()
    .get();

  await db.insert(auditLogs).values({
    action: "MANUAL_APPROVAL_CREATED",
    actorId: approver.id,
    targetType: "MANUAL_APPROVAL",
    targetId: approval.id,
    reason: `User: ${body.userId}, Site: ${body.siteId}`,
  });

  return success(c, { approval }, 201);
});

app.get("/audit-logs", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const action = c.req.query("action");

  const conditions = [];
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  const logs = await db
    .select({
      log: auditLogs,
      performer: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    logs: logs.map((row) => ({
      ...row.log,
      performer: row.performer,
    })),
  });
});

app.get("/stats", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [userCount, siteCount, postCount, activeAttendanceCount] =
    await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .get(),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(sites)
        .get(),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(posts)
        .get(),
      db
        .select({ count: sql<number>`COUNT(DISTINCT user_id)` })
        .from(attendance)
        .where(
          and(
            gte(attendance.checkinAt, today),
            lt(attendance.checkinAt, tomorrow),
          ),
        )
        .get(),
    ]);

  return success(c, {
    stats: {
      totalUsers: userCount?.count || 0,
      totalSites: siteCount?.count || 0,
      totalPosts: postCount?.count || 0,
      activeUsersToday: activeAttendanceCount?.count || 0,
    },
  });
});

app.get("/votes/candidates", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const month = c.req.query("month"); // YYYY-MM

  if (!siteId || !month) {
    return error(c, "MISSING_PARAMS", "siteId and month are required", 400);
  }

  const candidates = await db
    .select({
      id: voteCandidates.id,
      month: voteCandidates.month,
      source: voteCandidates.source,
      createdAt: voteCandidates.createdAt,
      user: {
        id: users.id,
        name: users.name,
        nameMasked: users.nameMasked,
        companyName: users.companyName,
        tradeType: users.tradeType,
      },
    })
    .from(voteCandidates)
    .innerJoin(users, eq(voteCandidates.userId, users.id))
    .where(
      and(eq(voteCandidates.siteId, siteId), eq(voteCandidates.month, month)),
    )
    .orderBy(desc(voteCandidates.createdAt))
    .all();

  return success(c, { candidates });
});

app.post("/votes/candidates", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");

  let body: { userId: string; siteId: string; month: string };
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.userId || !body.siteId || !body.month) {
    return error(
      c,
      "MISSING_FIELDS",
      "userId, siteId, and month are required",
      400,
    );
  }

  // Check duplicate
  const existing = await db
    .select()
    .from(voteCandidates)
    .where(
      and(
        eq(voteCandidates.siteId, body.siteId),
        eq(voteCandidates.userId, body.userId),
        eq(voteCandidates.month, body.month),
      ),
    )
    .get();

  if (existing) {
    return error(
      c,
      "DUPLICATE_CANDIDATE",
      "Candidate already exists for this month",
      409,
    );
  }

  const newCandidate = await db
    .insert(voteCandidates)
    .values({
      userId: body.userId,
      siteId: body.siteId,
      month: body.month,
      source: "ADMIN",
    })
    .returning()
    .get();

  await db.insert(auditLogs).values({
    action: "VOTE_CANDIDATE_ADDED",
    actorId: currentUser.id,
    targetType: "VOTE_CANDIDATE",
    targetId: newCandidate.id,
    reason: `Added candidate ${body.userId} for ${body.month}`,
  });

  return success(c, { candidate: newCandidate }, 201);
});

app.delete("/votes/candidates/:id", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(voteCandidates)
    .where(eq(voteCandidates.id, id))
    .get();

  if (!existing) {
    return error(c, "CANDIDATE_NOT_FOUND", "Candidate not found", 404);
  }

  await db.delete(voteCandidates).where(eq(voteCandidates.id, id)).run();

  await db.insert(auditLogs).values({
    action: "VOTE_CANDIDATE_REMOVED",
    actorId: currentUser.id,
    targetType: "VOTE_CANDIDATE",
    targetId: id,
    reason: `Removed candidate ${existing.userId} from ${existing.month}`,
  });

  return success(c, { success: true });
});

export default app;
