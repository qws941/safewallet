import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import {
  eq,
  sql,
  and,
  gte,
  lt,
  like,
  inArray,
  isNull,
  desc,
} from "drizzle-orm";
import {
  pointsLedger,
  siteMemberships,
  auditLogs,
  users,
  sites,
  syncErrors,
  actions,
  posts,
  announcements,
  voteCandidates,
} from "../db/schema";
import { dbBatchChunked } from "../db/helpers";
import {
  fasGetUpdatedEmployees,
  fasGetEmployeeInfo,
  fasGetEmployeesBatch,
  testConnection as testFasConnection,
  type FasEmployee,
} from "../lib/fas-mariadb";
import {
  syncFasEmployeesToD1,
  syncSingleFasEmployee,
  deactivateRetiredEmployees,
} from "../lib/fas-sync";
import { hmac } from "../lib/crypto";
import { maskName } from "../utils/common";
import { createLogger } from "../lib/logger";
import { acquireSyncLock, releaseSyncLock } from "../lib/sync-lock";
import { AceViewerEmployeesPayloadSchema } from "../validators/fas-sync";
import { CROSS_MATCH_CRON_BATCH } from "../lib/constants";
import {
  fireAlert,
  getAlertConfig,
  buildFasDownAlert,
  buildCronFailureAlert,
  buildHighErrorRateAlert,
  buildHighLatencyAlert,
} from "../lib/alerting";
import { apiMetrics } from "../db/schema";

const log = createLogger("scheduled");

/** @internal Exported for testing */
export function getKSTDate(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  return new Date(now.getTime() + kstOffset * 60 * 1000);
}

/** @internal Exported for testing */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return { start, end };
}

/** @internal Exported for testing */
export function formatSettleMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** @internal Exported for testing */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) =>
        setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)),
      );
    }
  }
  throw new Error("Unreachable");
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
    role: "SYSTEM",
    name: "시스템",
  });

  return systemUserId;
}

/**
 * Ensure all given users have ACTIVE site memberships for all active sites.
 * Skips users who already have a membership (safe to call repeatedly).
 * Chunks queries/inserts to stay within D1 bind-parameter limits.
 */
async function ensureSiteMemberships(
  db: ReturnType<typeof drizzle>,
  userIds: string[],
): Promise<number> {
  if (userIds.length === 0) return 0;

  const activeSites = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.active, true))
    .all();

  if (activeSites.length === 0) return 0;

  let totalCreated = 0;
  const CHUNK_SIZE = 50;

  for (const site of activeSites) {
    const existingSet = new Set<string>();
    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      const existing = await db
        .select({ userId: siteMemberships.userId })
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.siteId, site.id),
            inArray(siteMemberships.userId, chunk),
          ),
        )
        .all();
      for (const m of existing) existingSet.add(m.userId);
    }

    const toInsert = userIds
      .filter((id) => !existingSet.has(id))
      .map((userId) => ({
        userId,
        siteId: site.id,
        role: "WORKER" as const,
        status: "ACTIVE" as const,
      }));

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const chunk = toInsert.slice(i, i + CHUNK_SIZE);
        await db.insert(siteMemberships).values(chunk);
      }
      totalCreated += toInsert.length;
    }
  }

  return totalCreated;
}

async function runMonthEndSnapshot(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const { start, end } = getMonthRange(kstNow);
  const settleMonth = formatSettleMonth(kstNow);

  log.info("Running month-end snapshot", { kstNow: kstNow.toISOString() });

  const systemUserId = await getOrCreateSystemUser(db);

  const memberships = await db
    .select({
      userId: siteMemberships.userId,
      siteId: siteMemberships.siteId,
    })
    .from(siteMemberships)
    .where(eq(siteMemberships.status, "ACTIVE"))
    .all();

  const balances: Array<{
    userId: string;
    siteId: string;
    balance: number;
  }> = [];

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
      balances.push({
        userId: membership.userId,
        siteId: membership.siteId,
        balance: monthlyBalance,
      });
    }
  }

  if (balances.length > 0) {
    const ops: Promise<unknown>[] = balances.map((b) =>
      db.insert(pointsLedger).values({
        userId: b.userId,
        siteId: b.siteId,
        amount: 0,
        reasonCode: "MONTHLY_SNAPSHOT",
        reasonText: `월간 정산 스냅샷 - ${kstNow.getFullYear()}년 ${kstNow.getMonth() + 1}월 (잔액: ${b.balance})`,
        settleMonth,
      }),
    );

    ops.push(
      db.insert(auditLogs).values({
        actorId: systemUserId,
        action: "MONTH_END_SNAPSHOT",
        targetType: "POINTS",
        targetId: settleMonth,
        reason: JSON.stringify({
          period: settleMonth,
          membershipCount: memberships.length,
          snapshotCount: balances.length,
        }),
        ip: "SYSTEM",
      }),
    );

    await dbBatchChunked(db, ops);
  }

  log.info("Snapshot complete", { snapshotCount: balances.length });
}

// Processes PREVIOUS month (unlike runMonthEndSnapshot which processes current month)
async function runAutoNomination(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();

  const prevMonthDate = new Date(
    kstNow.getFullYear(),
    kstNow.getMonth() - 1,
    1,
  );
  const prevMonth = formatSettleMonth(prevMonthDate);
  const { start: monthStart, end: monthEnd } = getMonthRange(prevMonthDate);

  log.info("Running auto-nomination", { month: prevMonth });

  const systemUserId = await getOrCreateSystemUser(db);

  const activeSites = await db
    .select({
      id: sites.id,
      name: sites.name,
      topN: sites.autoNominationTopN,
    })
    .from(sites)
    .where(and(eq(sites.active, true), gte(sites.autoNominationTopN, 1)));

  if (activeSites.length === 0) {
    log.info("No sites with auto-nomination enabled");
    return;
  }

  let totalNominated = 0;

  for (const site of activeSites) {
    const topEarners = await db
      .select({
        userId: pointsLedger.userId,
        totalPoints: sql<number>`SUM(${pointsLedger.amount})`.as("totalPoints"),
      })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.siteId, site.id),
          gte(pointsLedger.createdAt, monthStart),
          lt(pointsLedger.createdAt, monthEnd),
        ),
      )
      .groupBy(pointsLedger.userId)
      .orderBy(desc(sql`SUM(${pointsLedger.amount})`))
      .limit(site.topN);

    if (topEarners.length === 0) {
      log.info("No point earners for site", {
        siteId: site.id,
        siteName: site.name,
      });
      continue;
    }

    const activeMembers = await db
      .select({ userId: siteMemberships.userId })
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.siteId, site.id),
          eq(siteMemberships.status, "ACTIVE"),
          inArray(
            siteMemberships.userId,
            topEarners.map((e) => e.userId),
          ),
        ),
      );

    const activeMemberIds = new Set(activeMembers.map((m) => m.userId));
    const eligibleEarners = topEarners.filter((e) =>
      activeMemberIds.has(e.userId),
    );

    if (eligibleEarners.length === 0) {
      log.info("No eligible earners for site", { siteId: site.id });
      continue;
    }

    const insertOps = eligibleEarners.map((earner) =>
      db
        .insert(voteCandidates)
        .values({
          id: crypto.randomUUID(),
          siteId: site.id,
          month: prevMonth,
          userId: earner.userId,
          source: "AUTO",
        })
        .onConflictDoNothing(),
    );

    await dbBatchChunked(db, insertOps);

    totalNominated += eligibleEarners.length;
    log.info("Auto-nominated candidates for site", {
      siteId: site.id,
      siteName: site.name,
      count: eligibleEarners.length,
      topN: site.topN,
    });
  }

  await db.insert(auditLogs).values({
    action: "AUTO_NOMINATE_CANDIDATES",
    actorId: systemUserId,
    targetType: "VOTE_CANDIDATE",
    targetId: prevMonth,
    reason: JSON.stringify({
      month: prevMonth,
      sitesProcessed: activeSites.length,
      totalNominated,
    }),
    ip: "SYSTEM",
  });

  log.info("Auto-nomination complete", {
    month: prevMonth,
    sitesProcessed: activeSites.length,
    totalNominated,
  });
}

async function runDataRetention(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(kstNow.getTime() - THREE_YEARS_MS);

  log.info("Running data retention cleanup", {
    cutoff: cutoffDate.toISOString(),
  });

  const systemUserId = await getOrCreateSystemUser(db);

  const deletedActions = await db
    .delete(actions)
    .where(lt(actions.createdAt, cutoffDate))
    .returning({ id: actions.id });

  const deletedPosts = await db
    .delete(posts)
    .where(lt(posts.createdAt, cutoffDate))
    .returning({ id: posts.id });

  const deletedAuditLogs = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoffDate))
    .returning({ id: auditLogs.id });

  log.info("Deleted data retention entries", {
    actions: deletedActions.length,
    posts: deletedPosts.length,
    auditLogs: deletedAuditLogs.length,
  });

  await db.insert(auditLogs).values({
    actorId: systemUserId,
    action: "DATA_RETENTION_CLEANUP",
    targetType: "SYSTEM",
    targetId: cutoffDate.toISOString(),
    reason: JSON.stringify({
      cutoffDate: cutoffDate.toISOString(),
      deletedActions: deletedActions.length,
      deletedPosts: deletedPosts.length,
      deletedAuditLogs: deletedAuditLogs.length,
    }),
    ip: "SYSTEM",
  });
}

export async function runFasFullSync(env: Env): Promise<void> {
  if (!env.FAS_HYPERDRIVE) {
    log.info("FAS_HYPERDRIVE not configured, skipping full sync");
    return;
  }

  const locked = await acquireSyncLock(env.KV, "fas-full", 600);
  if (!locked) {
    log.info("FAS full sync already in progress, skipping");
    return;
  }

  const db = drizzle(env.DB);
  const systemUserId = await getOrCreateSystemUser(db);

  try {
    const isConnected = await testFasConnection(env.FAS_HYPERDRIVE);
    if (!isConnected) {
      log.error("FAS MariaDB connection failed during full sync");
      return;
    }

    const allEmployees = await withRetry(() =>
      fasGetUpdatedEmployees(env.FAS_HYPERDRIVE!, null),
    );

    log.info("FAS full sync: fetched all employees", {
      count: allEmployees.length,
    });

    if (allEmployees.length === 0) return;

    const activeEmployees = allEmployees.filter((e) => e.stateFlag === "W");
    const retiredEmplCds = allEmployees
      .filter((e) => e.stateFlag !== "W")
      .map((e) => e.emplCd);

    const BATCH_SIZE = 50;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const totalErrors: string[] = [];

    for (let i = 0; i < activeEmployees.length; i += BATCH_SIZE) {
      const batch = activeEmployees.slice(i, i + BATCH_SIZE);
      const result = await syncFasEmployeesToD1(batch, db, {
        HMAC_SECRET: env.HMAC_SECRET,
        ENCRYPTION_KEY: env.ENCRYPTION_KEY,
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalErrors.push(...result.errors);
    }

    let totalDeactivated = 0;
    if (retiredEmplCds.length > 0) {
      totalDeactivated = await deactivateRetiredEmployees(retiredEmplCds, db);
    }

    // Ensure site memberships for all active FAS users
    let membershipCreated = 0;
    try {
      const fasUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.externalSystem, "FAS"), isNull(users.deletedAt)))
        .all();
      membershipCreated = await ensureSiteMemberships(
        db,
        fasUsers.map((u) => u.id),
      );
    } catch (err) {
      log.error("Failed to ensure site memberships during full sync", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await env.KV.put("fas-last-full-sync", new Date().toISOString());
    await env.KV.delete("fas-status");

    await db.insert(auditLogs).values({
      actorId: systemUserId,
      action: "FAS_FULL_SYNC_COMPLETED",
      targetType: "FAS_SYNC",
      targetId: "cron-full",
      reason: JSON.stringify({
        totalFas: allEmployees.length,
        active: activeEmployees.length,
        retired: retiredEmplCds.length,
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped,
        deactivated: totalDeactivated,
        membershipCreated,
        errors: totalErrors.length,
      }),
    });

    log.info("FAS full sync complete", {
      totalFas: allEmployees.length,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      deactivated: totalDeactivated,
      membershipCreated,
      errors: totalErrors.length,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error("FAS full sync failed", { error: errorMessage });

    try {
      await env.KV.put("fas-status", "down", { expirationTtl: 600 });
    } catch {
      /* KV write failure is non-critical */
    }

    try {
      await db.insert(syncErrors).values({
        syncType: "FAS_WORKER",
        status: "OPEN",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage,
        payload: JSON.stringify({ timestamp: new Date().toISOString() }),
      });
    } catch {
      /* sync_errors insert failure is non-critical */
    }

    throw err;
  } finally {
    await releaseSyncLock(env.KV, "fas-full");
  }
}

async function runFasSyncIncremental(env: Env): Promise<void> {
  if (!env.FAS_HYPERDRIVE) {
    log.info("FAS_HYPERDRIVE not configured, skipping sync");
    return;
  }

  const locked = await acquireSyncLock(env.KV, "fas", 240);
  if (!locked) {
    log.info("FAS sync already in progress, skipping");
    return;
  }

  const db = drizzle(env.DB);
  const systemUserId = await getOrCreateSystemUser(db);
  const kstNow = getKSTDate();
  const fiveMinutesAgo = new Date(kstNow.getTime() - 5 * 60 * 1000);

  log.info("Running FAS incremental sync", {
    since: fiveMinutesAgo.toISOString(),
  });

  const isConnected = await testFasConnection(env.FAS_HYPERDRIVE);
  if (!isConnected) {
    log.error("FAS MariaDB connection failed");
    await releaseSyncLock(env.KV, "fas");
    if (env.KV) {
      await env.KV.put("fas-status", "down", { expirationTtl: 600 });
    }
    return;
  }

  try {
    // FAS expects "YYYY-MM-DD HH:MM:SS" (no T, no Z, no millis)
    const sinceStr = fiveMinutesAgo
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "");
    const updatedEmployees = await withRetry(() =>
      fasGetUpdatedEmployees(env.FAS_HYPERDRIVE!, sinceStr),
    );

    log.info("Found updated employees", { count: updatedEmployees.length });

    if (updatedEmployees.length === 0) {
      if (env.KV) {
        try {
          await env.KV.delete("fas-status");
        } catch {
          /* non-critical */
        }
      }
      return;
    }

    const syncResult = await syncFasEmployeesToD1(updatedEmployees, db, {
      HMAC_SECRET: env.HMAC_SECRET,
      ENCRYPTION_KEY: env.ENCRYPTION_KEY,
    });

    // Deactivate retired employees (stateFlag !== 'W')
    const retiredEmplCds = updatedEmployees
      .filter((e) => e.stateFlag !== "W")
      .map((e) => e.emplCd);

    let deactivatedCount = 0;
    if (retiredEmplCds.length > 0) {
      deactivatedCount = await deactivateRetiredEmployees(retiredEmplCds, db);
    }

    // Ensure site memberships for synced active users
    let membershipCreated = 0;
    try {
      const activeEmplCds = updatedEmployees
        .filter((e) => e.stateFlag === "W")
        .map((e) => e.emplCd);
      if (activeEmplCds.length > 0) {
        const syncedUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.externalSystem, "FAS"),
              inArray(users.externalWorkerId, activeEmplCds),
              isNull(users.deletedAt),
            ),
          )
          .all();
        membershipCreated = await ensureSiteMemberships(
          db,
          syncedUsers.map((u) => u.id),
        );
      }
    } catch (err) {
      log.error("Failed to ensure site memberships during incremental sync", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    log.info("FAS sync complete", {
      created: syncResult.created,
      updated: syncResult.updated,
      skipped: syncResult.skipped,
      deactivated: deactivatedCount,
      membershipCreated,
    });

    await db.insert(auditLogs).values({
      actorId: systemUserId,
      action: "FAS_SYNC_COMPLETED",
      targetType: "FAS_SYNC",
      targetId: "cron",
      reason: JSON.stringify({
        employeesFound: updatedEmployees.length,
        ...syncResult,
        deactivatedCount,
        membershipCreated,
        since: fiveMinutesAgo.toISOString(),
      }),
    });

    if (env.KV) {
      await env.KV.delete("fas-status");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof err.code === "string"
        ? err.code
        : "UNKNOWN";

    log.error("FAS incremental sync failed", {
      error: errorMessage,
      code: errorCode,
    });

    try {
      await env.KV.put("fas-status", "down", { expirationTtl: 600 });
    } catch {
      /* KV write failure is non-critical */
    }

    try {
      await db.insert(syncErrors).values({
        syncType: "FAS_WORKER",
        status: "OPEN",
        errorCode,
        errorMessage,
        payload: JSON.stringify({ timestamp: new Date().toISOString() }),
      });
    } catch {
      /* sync_errors insert failure is non-critical */
    }

    await db.insert(auditLogs).values({
      actorId: systemUserId,
      action: "FAS_SYNC_FAILED",
      targetType: "FAS_SYNC",
      targetId: "cron",
      reason: JSON.stringify({ errorCode, errorMessage }),
    });

    throw err;
  } finally {
    await releaseSyncLock(env.KV, "fas");
  }
}

async function runOverdueActionCheck(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const systemUserId = await getOrCreateSystemUser(db);
  const now = new Date();

  const overdueActions = await db
    .select({ id: actions.id, postId: actions.postId })
    .from(actions)
    .where(
      and(
        sql`${actions.actionStatus} IN ('ASSIGNED', 'IN_PROGRESS')`,
        lt(actions.dueDate, now),
      ),
    );

  if (overdueActions.length === 0) return;

  const ops: Promise<unknown>[] = [];

  for (const action of overdueActions) {
    ops.push(
      db
        .update(actions)
        .set({ actionStatus: "OVERDUE" })
        .where(eq(actions.id, action.id)),
    );

    if (action.postId) {
      ops.push(
        db
          .update(posts)
          .set({ actionStatus: "OVERDUE", updatedAt: now })
          .where(eq(posts.id, action.postId)),
      );

      ops.push(
        db.insert(auditLogs).values({
          actorId: systemUserId,
          action: "ACTION_STATUS_CHANGE",
          targetType: "ACTION",
          targetId: action.id,
          reason: JSON.stringify({
            from: "IN_PROGRESS",
            to: "OVERDUE",
            cause: "automated_overdue_check",
          }),
          createdAt: now,
        }),
      );
    }
  }

  await dbBatchChunked(db, ops);

  log.info("Overdue action check complete", { count: overdueActions.length });
}

async function runPiiLifecycleCleanup(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const usersToHardDelete = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${users.deletionRequestedAt} IS NOT NULL`,
        lt(users.deletionRequestedAt, thirtyDaysAgo),
        sql`${users.deletedAt} IS NULL`,
      ),
    );

  if (usersToHardDelete.length === 0) return;

  const ops = usersToHardDelete.map((user) =>
    db
      .update(users)
      .set({
        phoneEncrypted: "",
        phoneHash: "",
        name: "[삭제됨]",
        nameMasked: "[삭제됨]",
        dobEncrypted: "",
        dobHash: "",
        companyName: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id)),
  );

  await dbBatchChunked(db, ops);

  log.info("PII lifecycle cleanup", {
    usersHardDeleted: usersToHardDelete.length,
  });
}

async function publishScheduledAnnouncements(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const now = new Date();

  const result = await db
    .update(announcements)
    .set({ isPublished: true })
    .where(
      and(
        eq(announcements.isPublished, false),
        lt(announcements.scheduledAt, now),
      ),
    );

  const count = result.meta?.changes ?? 0;
  if (count > 0) {
    log.info("Published scheduled announcements", { count });
  }
}

// AceTime R2 sync — reads employee JSON from R2 bucket and upserts basic user records.
// This is the CRON counterpart to POST /acetime/sync-db (which requires admin auth).
// Does NOT handle PII (phone/dob encryption) — that's runFasSyncIncremental's job.
async function runAcetimeSyncFromR2(env: Env): Promise<void> {
  if (!env.ACETIME_BUCKET) {
    log.info("ACETIME_BUCKET not configured, skipping R2 sync");
    return;
  }

  const locked = await acquireSyncLock(env.KV, "acetime", 240);
  if (!locked) {
    log.info("AceTime sync already in progress, skipping");
    return;
  }

  try {
    const object = await env.ACETIME_BUCKET.get("aceviewer-employees.json");
    if (!object) {
      log.info("aceviewer-employees.json not found in R2, skipping");
      return;
    }

    // Validate R2 payload with strict schema
    let validatedData: ReturnType<typeof AceViewerEmployeesPayloadSchema.parse>;
    try {
      const rawData = await object.json();
      validatedData = AceViewerEmployeesPayloadSchema.parse(rawData);
    } catch (err) {
      if (err instanceof Error) {
        log.error("Invalid aceviewer-employees.json payload", {
          error: err.message,
        });
      } else {
        log.error("Invalid aceviewer-employees.json payload", {
          error: String(err),
        });
      }
      return;
    }
    const aceViewerEmployees = validatedData.employees;

    const db = drizzle(env.DB);

    const existingUsers = await db
      .select({
        id: users.id,
        externalWorkerId: users.externalWorkerId,
      })
      .from(users)
      .where(eq(users.externalSystem, "FAS"));

    const existingMap = new Map(
      existingUsers.map((u) => [u.externalWorkerId, u.id]),
    );

    const newEmployees = aceViewerEmployees.filter(
      (e) => !existingMap.has(e.externalWorkerId),
    );
    const updateEmployees = aceViewerEmployees.filter((e) =>
      existingMap.has(e.externalWorkerId),
    );

    const hashMap = new Map<string, string>();
    await Promise.all(
      newEmployees.map(async (e) => {
        const h = await hmac(env.HMAC_SECRET, `acetime-${e.externalWorkerId}`);
        hashMap.set(e.externalWorkerId, h);
      }),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Batch inserts for new employees
    const insertOps: Promise<unknown>[] = [];
    for (const e of newEmployees) {
      const phoneHash = hashMap.get(e.externalWorkerId) || "";
      insertOps.push(
        db.insert(users).values({
          id: crypto.randomUUID(),
          externalSystem: "FAS",
          externalWorkerId: e.externalWorkerId,
          name: e.name,
          nameMasked: maskName(e.name),
          phoneHash: phoneHash,
          companyName: e.companyName,
          tradeType: e.trade,
          role: "WORKER",
        }),
      );
    }

    if (insertOps.length > 0) {
      try {
        await dbBatchChunked(db, insertOps);
        created = insertOps.length;
      } catch (err) {
        log.error("Failed to batch insert new employees", {
          count: insertOps.length,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped += insertOps.length;
      }
    }

    // Batch updates for existing employees
    const updateOps: Promise<unknown>[] = [];
    for (const e of updateEmployees) {
      const userId = existingMap.get(e.externalWorkerId);
      if (!userId) {
        skipped++;
        continue;
      }
      updateOps.push(
        db
          .update(users)
          .set({
            name: e.name,
            nameMasked: maskName(e.name),
            companyName: e.companyName,
            tradeType: e.trade,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId)),
      );
    }

    if (updateOps.length > 0) {
      try {
        await dbBatchChunked(db, updateOps);
        updated = updateOps.length;
      } catch (err) {
        log.error("Failed to batch update employees", {
          count: updateOps.length,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped += updateOps.length;
      }
    }

    // Step 3: Cross-match placeholder users with FAS MariaDB to fill in phone/dob
    let fasCrossMatched = 0;
    let fasCrossSkipped = 0;

    if (env.FAS_HYPERDRIVE) {
      const placeholderUsers = await db
        .select({
          id: users.id,
          externalWorkerId: users.externalWorkerId,
          phoneHash: users.phoneHash,
        })
        .from(users)
        .where(
          and(
            eq(users.externalSystem, "FAS"),
            like(users.phoneHash, "acetime-%"),
          ),
        );

      // Batch limit to stay within CF Workers CPU time
      const batch = placeholderUsers.slice(0, CROSS_MATCH_CRON_BATCH);

      // BATCH FIX: Load all employees at once instead of per-user
      const emplCds = batch
        .filter((pu) => pu.externalWorkerId)
        .map((pu) => pu.externalWorkerId!);

      let fasEmployeeMap = new Map<string, FasEmployee>();
      try {
        fasEmployeeMap = await fasGetEmployeesBatch(
          env.FAS_HYPERDRIVE,
          emplCds,
        );
      } catch (err) {
        log.error("FAS batch query failed", {
          batchSize: emplCds.length,
          error: err instanceof Error ? err.message : String(err),
        });
        fasCrossSkipped += batch.length;
      }

      // Process batch with pre-loaded data
      for (const pu of batch) {
        if (!pu.externalWorkerId) {
          fasCrossSkipped++;
          continue;
        }

        const fasEmployee = fasEmployeeMap.get(pu.externalWorkerId);
        if (fasEmployee && fasEmployee.phone) {
          try {
            await syncSingleFasEmployee(fasEmployee, db, {
              HMAC_SECRET: env.HMAC_SECRET,
              ENCRYPTION_KEY: env.ENCRYPTION_KEY,
            });
            fasCrossMatched++;
          } catch (err) {
            log.error("FAS cross-match sync failed", {
              externalWorkerId: pu.externalWorkerId,
              error: err instanceof Error ? err.message : String(err),
            });
            fasCrossSkipped++;
          }
        } else {
          fasCrossSkipped++;
        }
      }
    }

    // Ensure site memberships for all synced AceTime employees
    let membershipCreated = 0;
    try {
      const allExternalIds = aceViewerEmployees.map((e) => e.externalWorkerId);
      if (allExternalIds.length > 0) {
        const QUERY_CHUNK = 50;
        const syncedUserIds: string[] = [];
        for (let i = 0; i < allExternalIds.length; i += QUERY_CHUNK) {
          const chunk = allExternalIds.slice(i, i + QUERY_CHUNK);
          const chunkUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.externalSystem, "FAS"),
                inArray(users.externalWorkerId, chunk),
                isNull(users.deletedAt),
              ),
            )
            .all();
          syncedUserIds.push(...chunkUsers.map((u) => u.id));
        }
        membershipCreated = await ensureSiteMemberships(db, syncedUserIds);
      }
    } catch (err) {
      log.error("Failed to ensure site memberships during AceTime sync", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    log.info("AceTime R2 sync complete", {
      total: aceViewerEmployees.length,
      created,
      updated,
      skipped,
      fasCrossMatched,
      fasCrossSkipped,
      membershipCreated,
    });
  } finally {
    await releaseSyncLock(env.KV, "acetime");
  }
}

async function runMetricsAlertCheck(env: Env): Promise<void> {
  if (!env.KV) return;

  const config = await getAlertConfig(env.KV);
  if (!config.enabled || !config.webhookUrl) return;

  const db = drizzle(env.DB);
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const fromBucket = fiveMinAgo.toISOString().slice(0, 16);

  const [summary] = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${apiMetrics.requestCount}), 0)`,
      total5xx: sql<number>`coalesce(sum(${apiMetrics.status5xx}), 0)`,
      avgDurationMs: sql<number>`coalesce(cast(sum(${apiMetrics.totalDurationMs}) as real) / nullif(sum(${apiMetrics.requestCount}), 0), 0)`,
      maxDurationMs: sql<number>`coalesce(max(${apiMetrics.maxDurationMs}), 0)`,
    })
    .from(apiMetrics)
    .where(gte(apiMetrics.bucket, fromBucket));

  if (!summary || summary.totalRequests === 0) return;

  const errorRate = (summary.total5xx / summary.totalRequests) * 100;
  if (errorRate > config.errorRateThresholdPercent) {
    await fireAlert(
      env.KV,
      buildHighErrorRateAlert(
        errorRate,
        config.errorRateThresholdPercent,
        summary.total5xx,
        summary.totalRequests,
      ),
      env.ALERT_WEBHOOK_URL,
    );
  }

  if (summary.avgDurationMs > config.latencyThresholdMs) {
    await fireAlert(
      env.KV,
      buildHighLatencyAlert(
        summary.avgDurationMs,
        config.latencyThresholdMs,
        summary.maxDurationMs,
      ),
      env.ALERT_WEBHOOK_URL,
    );
  }
}

async function runScheduled(
  controller: ScheduledController,
  env: Env,
): Promise<void> {
  const trigger = controller.cron;
  log.info("Scheduled trigger", { trigger });

  try {
    if (trigger.startsWith("*/5 ") || trigger === "*/5 * * * *") {
      const lastFullSync = await env.KV?.get("fas-last-full-sync");
      if (!lastFullSync) {
        try {
          await withRetry(() => runFasFullSync(env), 2, 5000);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          log.error("FAS bootstrap full sync failed", { error: errorMsg });
          if (env.KV) {
            await fireAlert(
              env.KV,
              buildFasDownAlert(errorMsg),
              env.ALERT_WEBHOOK_URL,
            ).catch((alertErr: unknown) => {
              log.error("Alert webhook delivery failed", {
                error:
                  alertErr instanceof Error
                    ? alertErr.message
                    : String(alertErr),
              });
            });
          }
        }
      } else {
        try {
          await withRetry(() => runFasSyncIncremental(env), 3, 5000);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          log.error("FAS sync failed after 3 retries", {
            error: errorMsg,
            trigger,
          });
          if (env.KV) {
            await fireAlert(
              env.KV,
              buildFasDownAlert(errorMsg),
              env.ALERT_WEBHOOK_URL,
            ).catch((alertErr: unknown) => {
              log.error("Alert webhook delivery failed", {
                error:
                  alertErr instanceof Error
                    ? alertErr.message
                    : String(alertErr),
              });
            });
          }
        }
      }

      // announcements, AceTime sync, and metrics check are independent — run in parallel
      await Promise.all([
        publishScheduledAnnouncements(env).catch((err: unknown) => {
          log.error("Announcements publish failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }),
        withRetry(() => runAcetimeSyncFromR2(env), 3, 5000).catch(
          (err: unknown) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            log.error("AceTime sync failed after 3 retries", {
              error: errorMsg,
              trigger,
            });
            if (env.KV) {
              fireAlert(
                env.KV,
                buildCronFailureAlert("AceTime R2 Sync", errorMsg),
                env.ALERT_WEBHOOK_URL,
              ).catch((alertErr: unknown) => {
                log.error("Alert webhook delivery failed", {
                  error:
                    alertErr instanceof Error
                      ? alertErr.message
                      : String(alertErr),
                });
              });
            }
          },
        ),
        runMetricsAlertCheck(env).catch((err: unknown) => {
          log.error("Metrics alert check failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }),
      ]);
    }

    if (trigger === "0 0 1 * *") {
      // Month-end tasks with retry
      try {
        await withRetry(
          () => runMonthEndSnapshot(env),
          2, // Fewer retries for batch operations
          3000,
        );
      } catch (err) {
        log.error("Month-end snapshot failed after 2 retries", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        await withRetry(() => runAutoNomination(env), 2, 3000);
      } catch (err) {
        log.error("Auto-nomination failed after 2 retries", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (trigger === "0 3 * * 0" || trigger === "0 3 * * SUN") {
      // Weekly retention with retry
      try {
        await withRetry(() => runDataRetention(env), 2, 3000);
      } catch (err) {
        log.error("Data retention failed after 2 retries", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (trigger === "0 21 * * *") {
      // FAS full sync first — overdue/PII checks benefit from fresh data
      try {
        await withRetry(() => runFasFullSync(env), 2, 5000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error("FAS daily full sync failed", { error: errorMsg });
        if (env.KV) {
          await fireAlert(
            env.KV,
            buildFasDownAlert(errorMsg),
            env.ALERT_WEBHOOK_URL,
          ).catch((alertErr: unknown) => {
            log.error("Alert webhook delivery failed", {
              error:
                alertErr instanceof Error ? alertErr.message : String(alertErr),
            });
          });
        }
      }

      // Overdue action check and PII cleanup are independent — run in parallel
      await Promise.all([
        withRetry(() => runOverdueActionCheck(env), 2, 3000).catch(
          (err: unknown) => {
            log.error("Overdue action check failed", {
              error: err instanceof Error ? err.message : String(err),
            });
          },
        ),
        withRetry(() => runPiiLifecycleCleanup(env), 2, 3000).catch(
          (err: unknown) => {
            log.error("PII cleanup failed", {
              error: err instanceof Error ? err.message : String(err),
            });
          },
        ),
      ]);
    }

    log.info("Scheduled tasks completed", { trigger });
  } catch (error) {
    log.error("Scheduled task fatal error", {
      error: error instanceof Error ? error.message : String(error),
      trigger,
    });
    throw error;
  }
}

/**
 * Exported scheduled handler — thin wrapper that hands async work to
 * ctx.waitUntil() so the runtime correctly tracks the invocation lifecycle
 * and records the correct status in "Past Cron Events".
 */
export function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): void {
  ctx.waitUntil(runScheduled(controller, env));
}
