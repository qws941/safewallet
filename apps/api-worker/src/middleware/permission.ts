import type { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { users, siteMemberships } from "../db/schema";
import { error } from "../lib/response";
import type { Env, AuthContext } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { auth: AuthContext } }>;
type UserRole = "WORKER" | "SITE_ADMIN" | "SUPER_ADMIN" | "SYSTEM";
type PermissionField =
  | "piiViewFull"
  | "canAwardPoints"
  | "canManageUsers"
  | "canReview"
  | "canExportData";

/**
 * 역할 기반 접근 제어 미들웨어
 * SUPER_ADMIN은 항상 통과
 */
export function requireRole(...roles: UserRole[]) {
  return async (c: AppContext, next: Next) => {
    const auth = c.get("auth");
    if (!auth?.user) {
      return error(c, "UNAUTHORIZED", "인증이 필요합니다", 401);
    }

    const userRole = auth.user.role as UserRole;

    // SUPER_ADMIN bypass
    if (userRole === "SUPER_ADMIN") {
      await next();
      return;
    }

    if (!roles.includes(userRole)) {
      return error(c, "FORBIDDEN", "접근 권한이 없습니다", 403);
    }

    await next();
  };
}

/**
 * 현장 관리자 권한 확인 미들웨어
 * siteId를 요청에서 추출하는 함수를 받아 siteMemberships에서 SITE_ADMIN 역할 확인
 * SUPER_ADMIN은 항상 통과
 */
export function requireSiteAdmin(
  getSiteId: (c: AppContext) => string | Promise<string>,
) {
  return async (c: AppContext, next: Next) => {
    const auth = c.get("auth");
    if (!auth?.user) {
      return error(c, "UNAUTHORIZED", "인증이 필요합니다", 401);
    }

    const userRole = auth.user.role as UserRole;

    // SUPER_ADMIN bypass
    if (userRole === "SUPER_ADMIN") {
      await next();
      return;
    }

    const siteId = await getSiteId(c);
    if (!siteId) {
      return error(c, "BAD_REQUEST", "현장 ID가 필요합니다", 400);
    }

    const db = drizzle(c.env.DB);
    const membership = await db
      .select({ role: siteMemberships.role })
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, auth.user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership || membership.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "해당 현장의 관리자 권한이 필요합니다", 403);
    }

    await next();
  };
}

/**
 * 권한 필드 기반 접근 제어 미들웨어
 * users 테이블의 boolean 권한 필드를 확인
 * SUPER_ADMIN은 모든 권한을 보유
 */
export function requirePermission(permission: PermissionField) {
  return async (c: AppContext, next: Next) => {
    const auth = c.get("auth");
    if (!auth?.user) {
      return error(c, "UNAUTHORIZED", "인증이 필요합니다", 401);
    }

    const userRole = auth.user.role as UserRole;

    // SUPER_ADMIN has all permissions
    if (userRole === "SUPER_ADMIN") {
      await next();
      return;
    }

    const db = drizzle(c.env.DB);
    const userRecord = await db
      .select({
        piiViewFull: users.piiViewFull,
        canAwardPoints: users.canAwardPoints,
        canManageUsers: users.canManageUsers,
        canReview: users.canReview,
        canExportData: users.canExportData,
      })
      .from(users)
      .where(eq(users.id, auth.user.id))
      .get();

    if (!userRecord) {
      return error(c, "NOT_FOUND", "사용자를 찾을 수 없습니다", 404);
    }

    if (!userRecord[permission]) {
      const permissionLabels: Record<PermissionField, string> = {
        piiViewFull: "개인정보 열람",
        canAwardPoints: "포인트 부여",
        canManageUsers: "사용자 관리",
        canReview: "게시물 검토",
        canExportData: "데이터 내보내기",
      };
      return error(
        c,
        "FORBIDDEN",
        `${permissionLabels[permission]} 권한이 필요합니다`,
        403,
      );
    }

    await next();
  };
}

/**
 * 현장 관리자 여부를 인라인으로 확인하는 헬퍼 함수
 * 라우트 핸들러 내에서 직접 호출하여 사용
 */
export async function checkSiteAdmin(
  c: AppContext,
  siteId: string,
): Promise<boolean> {
  const auth = c.get("auth");
  if (!auth?.user) return false;

  const userRole = auth.user.role as UserRole;
  if (userRole === "SUPER_ADMIN") return true;

  const db = drizzle(c.env.DB);
  const membership = await db
    .select({ role: siteMemberships.role })
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, auth.user.id),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  return membership?.role === "SITE_ADMIN";
}

/**
 * 사용자의 특정 권한 보유 여부를 인라인으로 확인하는 헬퍼 함수
 */
export async function checkPermission(
  c: AppContext,
  permission: PermissionField,
): Promise<boolean> {
  const auth = c.get("auth");
  if (!auth?.user) return false;

  const userRole = auth.user.role as UserRole;
  if (userRole === "SUPER_ADMIN") return true;

  const db = drizzle(c.env.DB);
  const userRecord = await db
    .select({
      piiViewFull: users.piiViewFull,
      canAwardPoints: users.canAwardPoints,
      canManageUsers: users.canManageUsers,
      canReview: users.canReview,
      canExportData: users.canExportData,
    })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .get();

  return userRecord?.[permission] ?? false;
}
