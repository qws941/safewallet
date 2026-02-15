import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../types";
import { users, posts } from "../../db/schema";
import { error, success } from "../../lib/response";
import { createLogger } from "../../lib/logger";
import { 
  requireExportAccess, 
  exportRateLimit,
  csvResponse,
  buildCsv,
  formatYearMonth,
  formatKst,
} from "./helpers";
import {
  ExportPostsQuerySchema,
  ExportUsersQuerySchema,
  ExportAttendanceQuerySchema,
} from "../../validators/export";

const logger = createLogger("admin/export");

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// Users CSV export endpoint
app.get("/users", requireExportAccess, exportRateLimit, async (c) => {
  const auth = c.get("auth");
  const query = c.req.query();
  const parsed = ExportUsersQuerySchema.safeParse(query);
  
  if (!parsed.success) {
    return error(c, "INVALID_QUERY_PARAMS", "잘못된 쿼리 파라미터", 400);
  }

  const db = drizzle(c.env!.DB);
  const page = typeof parsed.data.page === "string" ? parseInt(parsed.data.page, 10) : parsed.data.page;
  const pageNum = Math.max(1, page || 1);

  try {
    // Basic user export without complex filters for now
    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .limit(10000);

    const csv = buildCsv(
      ["ID", "이름", "전화번호", "역할", "생성일"],
      userList.map((u) => [
        u.id,
        u.name || "",
        u.phone || "",
        u.role || "",
        formatKst(u.createdAt),
      ])
    );

    logger.info("User export completed", { userId: auth.user.id, rowCount: userList.length });
    return csvResponse(c, csv, `users_${formatYearMonth(new Date())}_p${pageNum}.csv`);
  } catch (e) {
    logger.error("User export failed", { error: e instanceof Error ? e.message : String(e) });
    return error(c, "EXPORT_FAILED", "내보내기 처리 중 오류가 발생했습니다", 500);
  }
});

// Posts CSV export endpoint
app.get("/posts", requireExportAccess, exportRateLimit, async (c) => {
  const auth = c.get("auth");
  const query = c.req.query();
  const parsed = ExportPostsQuerySchema.safeParse(query);
  
  if (!parsed.success) {
    return error(c, "INVALID_QUERY_PARAMS", "잘못된 쿼리 파라미터", 400);
  }

  const db = drizzle(c.env!.DB);
  const page = typeof parsed.data.page === "string" ? parseInt(parsed.data.page, 10) : parsed.data.page;
  const pageNum = Math.max(1, page || 1);

  try {
    // Basic post export without complex filters for now
    const postList = await db
      .select({
        id: posts.id,
        content: posts.content,
        category: posts.category,
        reviewStatus: posts.reviewStatus,
        userId: posts.userId,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .limit(10000);

    const csv = buildCsv(
      ["ID", "카테고리", "상태", "작성자", "생성일"],
      postList.map((p) => [
        p.id,
        p.category || "",
        p.reviewStatus || "",
        p.userId || "",
        formatKst(p.createdAt),
      ])
    );

    logger.info("Post export completed", { userId: auth.user.id, rowCount: postList.length });
    return csvResponse(c, csv, `posts_${formatYearMonth(new Date())}_p${pageNum}.csv`);
  } catch (e) {
    logger.error("Post export failed", { error: e instanceof Error ? e.message : String(e) });
    return error(c, "EXPORT_FAILED", "내보내기 처리 중 오류가 발생했습니다", 500);
  }
});

// Attendance CSV export endpoint  
app.get("/attendance", requireExportAccess, exportRateLimit, async (c) => {
  const auth = c.get("auth");
  const query = c.req.query();
  const parsed = ExportAttendanceQuerySchema.safeParse(query);
  
  if (!parsed.success) {
    return error(c, "INVALID_QUERY_PARAMS", "잘못된 쿼리 파라미터", 400);
  }

  // Return empty CSV for now - attendance export requires more complex logic
  const csv = buildCsv(
    ["사용자ID", "사이트ID", "체크인", "체크아웃"],
    []
  );

  logger.info("Attendance export requested", { userId: auth.user.id });
  return csvResponse(c, csv, `attendance_${formatYearMonth(new Date())}_p1.csv`);
});

export default app;
