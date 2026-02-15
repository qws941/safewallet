/**
 * FAS → D1 실시간 동기화 모듈
 *
 * FAS MariaDB(AceView)가 source of truth.
 * D1은 통합 DB로, FAS 데이터를 실시간 반영.
 *
 * 사용처:
 * - 로그인 시 on-demand sync (단건)
 * - CRON every-5-min incremental sync (변경분)
 * - 수동 bulk sync 엔드포인트 (전체)
 */

import { eq, and } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../db/schema";
import { dbBatchChunked } from "../db/helpers";
import { hmac, encrypt } from "./crypto";
import type { FasEmployee } from "./fas-mariadb";

// ─── Types ───────────────────────────────────────────────────────

export interface FasSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SyncEnv {
  HMAC_SECRET: string;
  ENCRYPTION_KEY: string;
}

// ─── socialNo → dob 변환 ─────────────────────────────────────────

/**
 * 주민번호 앞 7자리에서 생년월일(YYYYMMDD) 추출
 * socialNo: "7104101" → "19710410"
 * 7번째 자리: 1,2 = 1900년대 / 3,4 = 2000년대 / 9,0 = 1800년대
 */
export function socialNoToDob(socialNo: string | null): string | null {
  if (!socialNo || socialNo.length < 7) return null;

  const yymmdd = socialNo.substring(0, 6);
  const genderDigit = socialNo.charAt(6);

  let century: string;
  switch (genderDigit) {
    case "1":
    case "2":
    case "5":
    case "6":
      century = "19";
      break;
    case "3":
    case "4":
    case "7":
    case "8":
      century = "20";
      break;
    case "9":
    case "0":
      century = "18";
      break;
    default:
      return null;
  }

  return `${century}${yymmdd}`;
}

// ─── 전화번호 정규화 ─────────────────────────────────────────────

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, "");
}

// ─── 단건 동기화 (로그인 on-demand) ──────────────────────────────

/**
 * FAS 직원 1명을 D1에 동기화 (upsert).
 * 기존 app 데이터(role, points, permissions)는 보존.
 * 반환: D1 user record 또는 null (동기화 실패 시)
 */
export async function syncSingleFasEmployee(
  employee: FasEmployee,
  db: DrizzleD1Database,
  env: SyncEnv,
): Promise<typeof users.$inferSelect | null> {
  try {
    const normalizedPhone = normalizePhone(employee.phone);
    const dob = socialNoToDob(employee.socialNo);

    if (!normalizedPhone) return null;

    const phoneHash = await hmac(env.HMAC_SECRET, normalizedPhone);
    const dobHash = dob ? await hmac(env.HMAC_SECRET, dob) : null;
    const phoneEncrypted = await encrypt(env.ENCRYPTION_KEY, normalizedPhone);
    const dobEncrypted = dob ? await encrypt(env.ENCRYPTION_KEY, dob) : null;

    // externalWorkerId로 기존 유저 검색
    const existing = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.externalSystem, "FAS"),
          eq(users.externalWorkerId, employee.emplCd),
        ),
      )
      .get();

    const now = new Date();

    if (existing) {
      // UPDATE: FAS 필드만 덮어쓰기, app 필드 보존
      await db
        .update(users)
        .set({
          name: employee.name,
          nameMasked: maskName(employee.name),
          phone: normalizedPhone,
          phoneHash,
          phoneEncrypted,
          dob: dob,
          dobHash,
          dobEncrypted,
          companyName: employee.companyName || null,
          tradeType: employee.partCd || null,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));

      // 업데이트된 레코드 반환
      return (
        (await db
          .select()
          .from(users)
          .where(eq(users.id, existing.id))
          .get()) ?? null
      );
    } else {
      // INSERT: 새 유저 생성
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: employee.name,
        nameMasked: maskName(employee.name),
        phone: normalizedPhone,
        phoneHash,
        phoneEncrypted,
        dob: dob,
        dobHash,
        dobEncrypted,
        externalSystem: "FAS",
        externalWorkerId: employee.emplCd,
        companyName: employee.companyName || null,
        tradeType: employee.partCd || null,
        role: "WORKER",
        createdAt: now,
        updatedAt: now,
      });

      return (
        (await db.select().from(users).where(eq(users.id, userId)).get()) ??
        null
      );
    }
  } catch (e) {
    // Error tracked in result errors array
    return null;
  }
}

// ─── 일괄 동기화 (CRON / bulk) ───────────────────────────────────

/**
 * FAS 직원 목록을 D1에 일괄 동기화.
 * D1 batch write 제한 고려하여 순차 처리.
 */
export async function syncFasEmployeesToD1(
  employees: FasEmployee[],
  db: DrizzleD1Database,
  env: SyncEnv,
): Promise<FasSyncResult> {
  const result: FasSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const emp of employees) {
    try {
      const normalizedPhone = normalizePhone(emp.phone);
      const dob = socialNoToDob(emp.socialNo);

      // 전화번호 없으면 스킵
      if (!normalizedPhone) {
        result.skipped++;
        continue;
      }

      const phoneHash = await hmac(env.HMAC_SECRET, normalizedPhone);
      const dobHash = dob ? await hmac(env.HMAC_SECRET, dob) : null;
      const phoneEncrypted = await encrypt(env.ENCRYPTION_KEY, normalizedPhone);
      const dobEncrypted = dob ? await encrypt(env.ENCRYPTION_KEY, dob) : null;

      // externalWorkerId로 기존 유저 검색
      const existing = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.externalSystem, "FAS"),
            eq(users.externalWorkerId, emp.emplCd),
          ),
        )
        .get();

      const now = new Date();

      if (existing) {
        await db
          .update(users)
          .set({
            name: emp.name,
            nameMasked: maskName(emp.name),
            phone: normalizedPhone,
            phoneHash,
            phoneEncrypted,
            dob: dob,
            dobHash,
            dobEncrypted,
            companyName: emp.companyName || null,
            tradeType: emp.partCd || null,
            updatedAt: now,
          })
          .where(eq(users.id, existing.id));
        result.updated++;
      } else {
        const userId = crypto.randomUUID();
        await db.insert(users).values({
          id: userId,
          name: emp.name,
          nameMasked: maskName(emp.name),
          phone: normalizedPhone,
          phoneHash,
          phoneEncrypted,
          dob: dob,
          dobHash,
          dobEncrypted,
          externalSystem: "FAS",
          externalWorkerId: emp.emplCd,
          companyName: emp.companyName || null,
          tradeType: emp.partCd || null,
          role: "WORKER",
          createdAt: now,
          updatedAt: now,
        });
        result.created++;
      }
    } catch (e) {
      const msg = `${emp.emplCd}: ${e instanceof Error ? e.message : String(e)}`;
      result.errors.push(msg);
    }
  }

  return result;
}

// ─── 퇴직자 처리 ────────────────────────────────────────────────

/**
 * FAS에서 퇴직(stateFlag≠'W') 처리된 직원을 D1에서 soft delete.
 * 퇴직자 코드 목록을 받아 해당 유저만 비활성화한다.
 */
export async function deactivateRetiredEmployees(
  retiredEmplCds: string[],
  db: DrizzleD1Database,
): Promise<number> {
  if (retiredEmplCds.length === 0) return 0;

  const retiredSet = new Set(retiredEmplCds);

  const fasUsers = await db
    .select({
      id: users.id,
      externalWorkerId: users.externalWorkerId,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.externalSystem, "FAS"))
    .all();

  const deactivateOps: Promise<unknown>[] = [];
  const now = new Date();

  for (const u of fasUsers) {
    if (
      u.externalWorkerId &&
      retiredSet.has(u.externalWorkerId) &&
      !u.deletedAt
    ) {
      deactivateOps.push(
        db
          .update(users)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(users.id, u.id)),
      );
    }
  }

  if (deactivateOps.length > 0) {
    await dbBatchChunked(db, deactivateOps);
  }

  return deactivateOps.length;
}

// ─── 이름 마스킹 ────────────────────────────────────────────────

function maskName(name: string): string {
  if (!name || name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}
