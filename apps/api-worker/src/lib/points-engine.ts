import { eq, and, gte, sql, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type Category =
  | "HAZARD"
  | "UNSAFE_BEHAVIOR"
  | "INCONVENIENCE"
  | "SUGGESTION"
  | "BEST_PRACTICE";
type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

interface PointCalculationInput {
  postId: string;
  userId: string;
  siteId: string;
  category: Category;
  riskLevel: RiskLevel | null;
  locationFloor: string | null;
  locationZone: string | null;
}

interface PointCalculationResult {
  totalPoints: number;
  basePoints: number;
  riskBonus: number;
  breakdown: string;
  blocked: boolean;
  blockReason: string | null;
}

const DEFAULT_BASE_POINTS: Record<Category, number> = {
  HAZARD: 10,
  UNSAFE_BEHAVIOR: 8,
  INCONVENIENCE: 5,
  SUGGESTION: 7,
  BEST_PRACTICE: 10,
};

const DEFAULT_RISK_BONUS: Record<RiskLevel, number> = {
  HIGH: 5,
  MEDIUM: 3,
  LOW: 0,
};

const DAILY_POINT_LIMIT = 30;
const DAILY_POST_LIMIT = 3;
const FALSE_REPORT_PENALTY_MULTIPLIER = 2;
const DUPLICATE_WINDOW_HOURS = 24;

function getKSTToday(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const cutoffHour = 5;
  if (kst.getUTCHours() < cutoffHour) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  kst.setUTCHours(cutoffHour, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000);
}

export async function calculateApprovalPoints(
  db: ReturnType<typeof drizzle>,
  input: PointCalculationInput,
): Promise<PointCalculationResult> {
  const todayStart = getKSTToday();

  const [dailyStats, sitePolicy, duplicateCheck] = await Promise.all([
    getDailyStats(db, input.userId, input.siteId, todayStart),
    getSitePolicy(db, input.siteId, input.category),
    checkDuplicate(db, input),
  ]);

  if (duplicateCheck) {
    return {
      totalPoints: 0,
      basePoints: 0,
      riskBonus: 0,
      breakdown: "중복 게시물 (24시간 내 동일 위치+카테고리)",
      blocked: true,
      blockReason: "DUPLICATE_WITHIN_24H",
    };
  }

  if (dailyStats.postCount >= DAILY_POST_LIMIT) {
    return {
      totalPoints: 0,
      basePoints: 0,
      riskBonus: 0,
      breakdown: `일일 게시물 한도 초과 (${DAILY_POST_LIMIT}건)`,
      blocked: true,
      blockReason: "DAILY_POST_LIMIT",
    };
  }

  const basePoints =
    sitePolicy?.defaultAmount ?? DEFAULT_BASE_POINTS[input.category];
  const riskBonus = input.riskLevel ? DEFAULT_RISK_BONUS[input.riskLevel] : 0;
  let totalPoints = basePoints + riskBonus;

  const remainingDaily = DAILY_POINT_LIMIT - dailyStats.totalPoints;
  if (remainingDaily <= 0) {
    return {
      totalPoints: 0,
      basePoints,
      riskBonus,
      breakdown: `일일 포인트 한도 초과 (${DAILY_POINT_LIMIT}점)`,
      blocked: true,
      blockReason: "DAILY_POINT_LIMIT",
    };
  }

  if (totalPoints > remainingDaily) {
    totalPoints = remainingDaily;
  }

  const parts: string[] = [];
  parts.push(`기본 ${basePoints}점`);
  if (riskBonus > 0) {
    parts.push(`위험도 보너스 ${riskBonus}점`);
  }
  if (totalPoints < basePoints + riskBonus) {
    parts.push(`일일 한도로 ${totalPoints}점 조정`);
  }

  return {
    totalPoints,
    basePoints,
    riskBonus,
    breakdown: parts.join(" + "),
    blocked: false,
    blockReason: null,
  };
}

export async function calculateFalseReportPenalty(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  originalPostId: string,
): Promise<{ penaltyAmount: number; breakdown: string }> {
  const originalLedger = await db
    .select({ amount: schema.pointsLedger.amount })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.postId, originalPostId),
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reasonCode, "POST_APPROVED"),
      ),
    )
    .limit(1);

  const originalAmount = originalLedger[0]?.amount ?? 0;
  const penaltyAmount = -(originalAmount * FALSE_REPORT_PENALTY_MULTIPLIER);

  return {
    penaltyAmount,
    breakdown: `허위 신고 페널티: 원래 ${originalAmount}점 × ${FALSE_REPORT_PENALTY_MULTIPLIER}배 = ${Math.abs(penaltyAmount)}점 차감`,
  };
}

export async function awardApprovalPoints(
  db: ReturnType<typeof drizzle>,
  input: PointCalculationInput,
  adminId: string,
): Promise<{
  awarded: boolean;
  result: PointCalculationResult;
  ledgerId?: string;
}> {
  const result = await calculateApprovalPoints(db, input);

  if (result.blocked || result.totalPoints <= 0) {
    return { awarded: false, result };
  }

  const now = new Date();
  const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const insertResult = await db
    .insert(schema.pointsLedger)
    .values({
      userId: input.userId,
      siteId: input.siteId,
      postId: input.postId,
      amount: result.totalPoints,
      reasonCode: "POST_APPROVED",
      reasonText: result.breakdown,
      adminId,
      settleMonth,
      occurredAt: now,
      createdAt: now,
    })
    .returning({ id: schema.pointsLedger.id });

  const ledgerId = insertResult[0]?.id ?? "";

  return { awarded: true, result, ledgerId };
}

export async function applyFalseReportPenalty(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  postId: string,
  adminId: string,
): Promise<{ penaltyAmount: number; ledgerId: string }> {
  const { penaltyAmount, breakdown } = await calculateFalseReportPenalty(
    db,
    userId,
    siteId,
    postId,
  );

  const now = new Date();
  const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ledgerId = crypto.randomUUID();

  await db.insert(schema.pointsLedger).values({
    id: ledgerId,
    userId,
    siteId,
    postId,
    amount: penaltyAmount,
    reasonCode: "FALSE_REPORT_PENALTY",
    reasonText: breakdown,
    adminId,
    settleMonth,
    occurredAt: now,
    createdAt: now,
  });

  return { penaltyAmount, ledgerId };
}

async function getDailyStats(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  todayStart: Date,
): Promise<{ postCount: number; totalPoints: number }> {
  const result = await db
    .select({
      postCount: count(),
      totalPoints: sum(schema.pointsLedger.amount),
    })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.siteId, siteId),
        eq(schema.pointsLedger.reasonCode, "POST_APPROVED"),
        gte(schema.pointsLedger.createdAt, todayStart),
      ),
    );

  return {
    postCount: result[0]?.postCount ?? 0,
    totalPoints: Number(result[0]?.totalPoints ?? 0),
  };
}

async function getSitePolicy(
  db: ReturnType<typeof drizzle>,
  siteId: string,
  category: Category,
): Promise<{ defaultAmount: number } | null> {
  const reasonCode = `POST_${category}`;

  const policy = await db
    .select({ defaultAmount: schema.pointPolicies.defaultAmount })
    .from(schema.pointPolicies)
    .where(
      and(
        eq(schema.pointPolicies.siteId, siteId),
        eq(schema.pointPolicies.reasonCode, reasonCode),
        eq(schema.pointPolicies.isActive, true),
      ),
    )
    .limit(1);

  return policy[0] ?? null;
}

async function checkDuplicate(
  db: ReturnType<typeof drizzle>,
  input: PointCalculationInput,
): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const duplicates = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.userId, input.userId),
        eq(schema.posts.siteId, input.siteId),
        eq(schema.posts.category, input.category),
        eq(schema.posts.locationFloor, input.locationFloor ?? ""),
        eq(schema.posts.locationZone, input.locationZone ?? ""),
        gte(schema.posts.createdAt, windowStart),
        sql`${schema.posts.id} != ${input.postId}`,
      ),
    )
    .limit(1);

  return duplicates.length > 0;
}
