import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, and, gte, lt, like, inArray, isNull } from "drizzle-orm";
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
} from "../db/schema";
import { dbBatchChunked } from "../db/helpers";
import {
  fasGetUpdatedEmployees,
  fasGetEmployeeInfo,
  testConnection as testFasConnection,
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
import { CROSS_MATCH_CRON_BATCH } from "../lib/constants";

const log = createLogger("scheduled");

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

async function withRetry<T>(
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
    const updatedEmployees = await withRetry(() =>
      fasGetUpdatedEmployees(env.FAS_HYPERDRIVE!, fiveMinutesAgo.toISOString()),
    );

    log.info("Found updated employees", { count: updatedEmployees.length });

    if (updatedEmployees.length === 0) return;

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

    log.info("FAS sync complete", {
      created: syncResult.created,
      updated: syncResult.updated,
      skipped: syncResult.skipped,
      deactivated: deactivatedCount,
    });

    await db.insert(auditLogs).values({
      actorId: "SYSTEM",
      action: "FAS_SYNC_COMPLETED",
      targetType: "FAS_SYNC",
      targetId: "cron",
      reason: JSON.stringify({
        employeesFound: updatedEmployees.length,
        ...syncResult,
        deactivatedCount,
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

    await db.insert(syncErrors).values({
      syncType: "FAS_WORKER",
      status: "OPEN",
      errorCode,
      errorMessage,
      payload: JSON.stringify({ timestamp: new Date().toISOString() }),
    });

    await db.insert(auditLogs).values({
      actorId: "SYSTEM",
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
          actorId: "SYSTEM",
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
        phone: "",
        phoneEncrypted: "",
        phoneHash: "",
        name: "[삭제됨]",
        nameMasked: "[삭제됨]",
        dob: null,
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

    const data = (await object.json()) as {
      employees: Array<{
        externalWorkerId: string;
        name: string;
        companyName: string | null;
        position: string | null;
        trade: string | null;
        lastSeen: string | null;
      }>;
      total: number;
    };
    const aceViewerEmployees = data.employees;

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
          phone: "",
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

      for (const pu of batch) {
        if (!pu.externalWorkerId) {
          fasCrossSkipped++;
          continue;
        }
        try {
          const fasEmployee = await fasGetEmployeeInfo(
            env.FAS_HYPERDRIVE,
            pu.externalWorkerId,
          );
          if (fasEmployee && fasEmployee.phone) {
            await syncSingleFasEmployee(fasEmployee, db, {
              HMAC_SECRET: env.HMAC_SECRET,
              ENCRYPTION_KEY: env.ENCRYPTION_KEY,
            });
            fasCrossMatched++;
          } else {
            fasCrossSkipped++;
          }
        } catch (err) {
          log.error("FAS cross-match failed", {
            externalWorkerId: pu.externalWorkerId,
            error: err instanceof Error ? err.message : String(err),
          });
          fasCrossSkipped++;
        }
      }
    }

    log.info("AceTime R2 sync complete", {
      total: aceViewerEmployees.length,
      created,
      updated,
      skipped,
      fasCrossMatched,
      fasCrossSkipped,
    });
  } finally {
    await releaseSyncLock(env.KV, "acetime");
  }
}

export async function scheduled(
  controller: ScheduledController,
  env: Env,
): Promise<void> {
  const trigger = controller.cron;
  log.info("Scheduled trigger", { trigger });

  try {
    if (trigger.startsWith("*/5 ") || trigger === "*/5 * * * *") {
      await runFasSyncIncremental(env);
      await publishScheduledAnnouncements(env);
      await runAcetimeSyncFromR2(env);
    }

    if (trigger === "0 0 1 * *") {
      await runMonthEndSnapshot(env);
    }

    if (trigger === "0 3 * * 0" || trigger === "0 3 * * SUN") {
      await runDataRetention(env);
    }

    // Daily 6AM KST: overdue action check + PII cleanup
    if (trigger === "0 21 * * *") {
      await runOverdueActionCheck(env);
      await runPiiLifecycleCleanup(env);
    }
  } catch (error) {
    log.error("Scheduled task error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
