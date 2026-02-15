import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, gte, lt, and, eq, sql } from "drizzle-orm";
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
import { z } from "zod";
import {
  ExportPostsQuerySchema,
  ExportUsersQuerySchema,
  ExportAttendanceQuerySchema,
} from "../../validators/export";

const app = new Hono<Env>();

const EXPORT_PAGE_SIZE = 10000;

app.get("/users", async (c) => {
  const auth = c.get("auth");
  await requireExportAccess(c);
  await exportRateLimit(c);

  const query = c.req.query();
  const parsed = ExportUsersQuerySchema.safeParse(query);
  if (!parsed.success) {
    return error(c, 400, "잘못된 쿼리 파라미터");
  }

  const db = drizzle(c.env.DB);
  const { search, status, role, site, startDate, endDate, page = "1" } =
    parsed.data;

  const pageNum = Math.max(1, parseInt(page, 10));
  const offset = (pageNum - 1) * EXPORT_PAGE_SIZE;

  let whereCondition = undefined;
  const conditions = [];

  if (search) {
    conditions.push(
      sql`${users.phone} LIKE ${"%" + search + "%"} OR ${users.name} LIKE ${
        "%" + search + "%"
      }`
    );
  }

  if (status) {
    conditions.push(eq(users.status, status));
  }

  if (role) {
    conditions.push(eq(users.role, role));
  }

  if (site) {
    const siteData = await db
      .select()
      .from(sites)
      .where(eq(sites.id, site))
      .limit(1);
    if (siteData.length === 0) {
      return error(c, 404, "사이트를 찾을 수 없습니다");
    }

    conditions.push(
      sql`${users.id} IN (SELECT ${siteMemberships.userId} FROM ${siteMemberships} WHERE ${eq(
        siteMemberships.siteId,
        site
      )})`
    );
  }

  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate
      ? new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
      : new Date();

    conditions.push(and(gte(users.createdAt, start), lt(users.createdAt, end)));
  }

  if (conditions.length > 0) {
    whereCondition = and(...conditions);
  }

  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereCondition)
    .limit(EXPORT_PAGE_SIZE)
    .offset(offset);

  const countResult = await db
    .select({ count: sql`COUNT(*)` })
    .from(users)
    .where(whereCondition);
  const totalCount = (countResult[0].count as number) || 0;
  const totalPages = Math.ceil(totalCount / EXPORT_PAGE_SIZE);

  if (pageNum > totalPages && totalPages > 0) {
    return error(c, 400, "페이지 범위를 초과했습니다");
  }

  const csv = buildCsv(
    ["ID", "이름", "전화번호", "역할", "상태", "생성일"],
    userList.map((u) => [
      u.id,
      u.name || "",
      u.phone || "",
      u.role || "",
      u.status || "",
      formatKst(new Date(u.createdAt)),
    ])
  );

  await logAuditWithContext(c, auth.userId, "EXPORT_USERS", {
    searchTerm: search,
    status,
    role,
    site,
    startDate,
    endDate,
    pageNum,
    rowCount: userList.length,
  });

  return csvResponse(
    c,
    csv,
    `users_${formatYearMonth(new Date())}_p${pageNum}.csv`,
    { totalPages, pageNum, totalCount }
  );
});

app.get("/posts", async (c) => {
  const auth = c.get("auth");
  await requireExportAccess(c);
  await exportRateLimit(c);

  const query = c.req.query();
  const parsed = ExportPostsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return error(c, 400, "잘못된 쿼리 파라미터");
  }

  const db = drizzle(c.env.DB);
  const {
    site,
    category,
    status,
    startDate,
    endDate,
    withContent = false,
    page = "1",
  } = parsed.data;

  const pageNum = Math.max(1, parseInt(page, 10));
  const offset = (pageNum - 1) * EXPORT_PAGE_SIZE;

  let whereCondition = undefined;
  const conditions = [];

  if (site) {
    conditions.push(eq(posts.siteId, site));
  }

  if (category) {
    conditions.push(eq(posts.category, category));
  }

  if (status) {
    conditions.push(eq(posts.status, status));
  }

  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate
      ? new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
      : new Date();

    conditions.push(and(gte(posts.createdAt, start), lt(posts.createdAt, end)));
  }

  if (conditions.length > 0) {
    whereCondition = and(...conditions);
  }

  const postList = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: withContent ? posts.content : undefined,
      category: posts.category,
      status: posts.status,
      author: posts.authorId,
      createdAt: posts.createdAt,
      siteId: posts.siteId,
    })
    .from(posts)
    .where(whereCondition)
    .limit(EXPORT_PAGE_SIZE)
    .offset(offset);

  const countResult = await db
    .select({ count: sql`COUNT(*)` })
    .from(posts)
    .where(whereCondition);
  const totalCount = (countResult[0].count as number) || 0;
  const totalPages = Math.ceil(totalCount / EXPORT_PAGE_SIZE);

  if (pageNum > totalPages && totalPages > 0) {
    return error(c, 400, "페이지 범위를 초과했습니다");
  }

  const headers = ["ID", "제목", "카테고리", "상태", "작성자", "생성일"];
  if (withContent) {
    headers.push("내용");
  }

  const csv = buildCsv(
    headers,
    postList.map((p) => {
      const row = [
        p.id,
        p.title || "",
        p.category || "",
        p.status || "",
        p.author || "",
        formatKst(new Date(p.createdAt)),
      ];
      if (withContent && p.content) {
        row.push(p.content);
      }
      return row;
    })
  );

  await logAuditWithContext(c, auth.userId, "EXPORT_POSTS", {
    site,
    category,
    status,
    startDate,
    endDate,
    pageNum,
    rowCount: postList.length,
  });

  return csvResponse(
    c,
    csv,
    `posts_${formatYearMonth(new Date())}_p${pageNum}.csv`,
    { totalPages, pageNum, totalCount }
  );
});

app.get("/attendance", async (c) => {
  const auth = c.get("auth");
  await requireExportAccess(c);
  await exportRateLimit(c);

  const query = c.req.query();
  const parsed = ExportAttendanceQuerySchema.safeParse(query);
  if (!parsed.success) {
    return error(c, 400, "잘못된 쿼리 파라미터");
  }

  const db = drizzle(c.env.DB);
  const { site, userId, startDate, endDate, page = "1" } = parsed.data;

  const pageNum = Math.max(1, parseInt(page, 10));
  const offset = (pageNum - 1) * EXPORT_PAGE_SIZE;

  let whereCondition = undefined;
  const conditions = [];

  if (site) {
    conditions.push(eq(siteMemberships.siteId, site));
  }

  if (userId) {
    conditions.push(eq(siteMemberships.userId, userId));
  }

  const startDateObj = startDate ? parseDateParam(startDate) : new Date(0);
  const endDateObj = endDate
    ? toExclusiveEndDate(parseDateParam(endDate))
    : new Date();

  if (conditions.length > 0) {
    whereCondition = and(...conditions);
  }

  const memberList = await db
    .select({
      userId: siteMemberships.userId,
      siteId: siteMemberships.siteId,
    })
    .from(siteMemberships)
    .where(whereCondition);

  if (memberList.length === 0) {
    const csv = buildCsv(["사용자ID", "사이트ID", "체크인", "체크아웃"], []);
    return csvResponse(
      c,
      csv,
      `attendance_${formatYearMonth(new Date())}_p${pageNum}.csv`,
      { totalPages: 1, pageNum, totalCount: 0 }
    );
  }

  const countResult = await db
    .select({ count: sql`COUNT(*)` })
    .from(siteMemberships)
    .where(whereCondition);
  const totalCount = (countResult[0].count as number) || 0;
  const totalPages = Math.ceil(totalCount / EXPORT_PAGE_SIZE);

  if (pageNum > totalPages && totalPages > 0) {
    return error(c, 400, "페이지 범위를 초과했습니다");
  }

  const csv = buildCsv(
    ["사용자ID", "사이트ID", "체크인", "체크아웃"],
    memberList.map((m) => [
      m.userId,
      m.siteId,
      formatKst(new Date(startDateObj)),
      formatKst(new Date(endDateObj)),
    ])
  );

  await logAuditWithContext(c, auth.userId, "EXPORT_ATTENDANCE", {
    site,
    userId,
    startDate,
    endDate,
    pageNum,
    rowCount: memberList.length,
  });

  return csvResponse(
    c,
    csv,
    `attendance_${formatYearMonth(new Date())}_p${pageNum}.csv`,
    { totalPages, pageNum, totalCount }
  );
});

export default app;
