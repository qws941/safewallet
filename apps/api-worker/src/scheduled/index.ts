import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { pointsLedger, siteMemberships, auditLogs, users } from "../db/schema";

function getKSTDate(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  return new Date(now.getTime() + kstOffset * 60 * 1000);
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return { start, end };
}

function formatSettleMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function getOrCreateSystemUser(
  db: ReturnType<typeof drizzle>,
): Promise<string> {
  const existingSystem = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "SYSTEM"))
    .get();

  if (existingSystem) {
    return existingSystem.id;
  }

  const systemUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: systemUserId,
    phone: "SYSTEM",
    role: "SYSTEM",
    name: "시스템",
  });

  return systemUserId;
}

async function runMonthEndSnapshot(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const { start, end } = getMonthRange(kstNow);
  const settleMonth = formatSettleMonth(kstNow);

  console.log(`Running month-end snapshot for ${kstNow.toISOString()}`);

  const systemUserId = await getOrCreateSystemUser(db);

  const memberships = await db
    .select({
      userId: siteMemberships.userId,
      siteId: siteMemberships.siteId,
    })
    .from(siteMemberships)
    .where(eq(siteMemberships.status, "ACTIVE"))
    .all();

  let snapshotCount = 0;
  for (const membership of memberships) {
    const result = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
      })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.userId, membership.userId),
          eq(pointsLedger.siteId, membership.siteId),
          gte(pointsLedger.createdAt, start),
          lt(pointsLedger.createdAt, end),
        ),
      )
      .get();

    const monthlyBalance = result?.balance || 0;
    if (monthlyBalance !== 0) {
      await db.insert(pointsLedger).values({
        userId: membership.userId,
        siteId: membership.siteId,
        amount: 0,
        reasonCode: "MONTHLY_SNAPSHOT",
        reasonText: `월간 정산 스냅샷 - ${kstNow.getFullYear()}년 ${kstNow.getMonth() + 1}월 (잔액: ${monthlyBalance})`,
        settleMonth,
      });
      snapshotCount++;
    }
  }

  await db.insert(auditLogs).values({
    actorId: systemUserId,
    action: "MONTH_END_SNAPSHOT",
    targetType: "POINTS",
    targetId: settleMonth,
    reason: JSON.stringify({
      period: settleMonth,
      membershipCount: memberships.length,
      snapshotCount,
    }),
    ip: "SYSTEM",
  });

  console.log(`Snapshot complete: ${snapshotCount} records created`);
}

async function runDataRetention(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(kstNow.getTime() - THREE_YEARS_MS);

  console.log(
    `Running data retention cleanup, cutoff: ${cutoffDate.toISOString()}`,
  );

  const systemUserId = await getOrCreateSystemUser(db);

  const deletedAuditLogs = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoffDate))
    .returning({ id: auditLogs.id });

  console.log(`Deleted ${deletedAuditLogs.length} audit log entries`);

  await db.insert(auditLogs).values({
    actorId: systemUserId,
    action: "DATA_RETENTION_CLEANUP",
    targetType: "SYSTEM",
    targetId: cutoffDate.toISOString(),
    reason: JSON.stringify({
      cutoffDate: cutoffDate.toISOString(),
      deletedAuditLogs: deletedAuditLogs.length,
    }),
    ip: "SYSTEM",
  });
}

export async function scheduled(
  controller: ScheduledController,
  env: Env,
): Promise<void> {
  const trigger = controller.cron;
  console.log(`Scheduled trigger: ${trigger}`);

  try {
    if (trigger === "0 0 1 * *") {
      await runMonthEndSnapshot(env);
    }

    if (trigger === "0 3 * * 0") {
      await runDataRetention(env);
    }
  } catch (error) {
    console.error("Scheduled task error:", error);
    throw error;
  }
}
