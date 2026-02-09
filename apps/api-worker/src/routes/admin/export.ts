import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, gte, lt, and, eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import {
  posts,
  users,
  sites,
  pointsLedger,
  siteMemberships,
  reviewStatusEnum,
  membershipStatusEnum,
} from "../../db/schema";
import { error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import {
  requireExportAccess,
  exportRateLimit,
  parseDateParam,
  toExclusiveEndDate,
  formatKst,
  formatYearMonth,
  buildCsv,
  csvResponse,
} from "./helpers";

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

  await logAuditWithContext(
    c,
    db,
    "EXCEL_EXPORT",
    currentUser.id,
    "EXPORT",
    siteId || "ALL",
    {
      exportType: "posts",
      filterConditions: { siteId, status, from: fromParam, to: toParam },
      rowCount: rows.length,
    },
  );

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

  await logAuditWithContext(
    c,
    db,
    "EXCEL_EXPORT",
    currentUser.id,
    "EXPORT",
    siteId || "ALL",
    {
      exportType: "users",
      filterConditions: { siteId, status, from: fromParam, to: toParam },
      rowCount: rows.length,
    },
  );

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

  await logAuditWithContext(
    c,
    db,
    "EXCEL_EXPORT",
    currentUser.id,
    "EXPORT",
    siteId,
    {
      exportType: "points",
      filterConditions: { siteId, month },
      rowCount: rows.length,
    },
  );

  const csv = buildCsv(headers, rows);
  return csvResponse(c, csv, `points-${month}.csv`);
});

export default app;
