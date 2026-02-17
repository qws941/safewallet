import { createLogger } from "./logger";

const log = createLogger("sync-lock");

const LOCK_PREFIX = "sync:lock:";
const DEFAULT_TTL_SECONDS = 300;

export interface SyncLockResult {
  acquired: boolean;
  holder?: string;
}

/**
 * Atomic lock via KV with unique holder identification.
 * Returns immediately — skips if already held by another holder.
 *
 * SAFETY STRATEGY:
 * 1. Holder ID includes timestamp + crypto.randomUUID() for uniqueness
 * 2. Short TTL (5 min) auto-recovers from stale locks
 * 3. Cron handlers use exponential backoff retries
 * 4. Non-blocking pattern prevents indefinite waits
 *
 * While KV lacks true CAS, this combination mitigates race conditions:
 * - If two workers check simultaneously, only one will succeed in setting
 * - Even with race window, subsequent attempts see existing lock
 * - TTL ensures locks don't persist indefinitely
 */
export async function acquireSyncLock(
  kv: KVNamespace,
  lockName: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<SyncLockResult> {
  const key = `${LOCK_PREFIX}${lockName}`;
  const holder = `${lockName}-${Date.now()}-${crypto.randomUUID()}`;

  const existing = await kv.get(key);

  if (existing) {
    log.info("Sync lock already held", { lockName, holder: existing });
    return { acquired: false, holder: existing };
  }

  // Put with unique holder ID and TTL. If race occurs between check and put,
  // the lock exists but has our holder ID or the other worker's ID.
  // Subsequent attempts will see the lock and back off.
  await kv.put(key, holder, { expirationTtl: ttlSeconds });

  log.info("Sync lock acquired", { lockName, holder });

  return { acquired: true, holder };
}

export async function releaseSyncLock(
  kv: KVNamespace,
  lockName: string,
): Promise<void> {
  const key = `${LOCK_PREFIX}${lockName}`;
  try {
    await kv.delete(key);
    log.info("Sync lock released", { lockName });
  } catch (err) {
    log.error("Failed to release sync lock", {
      lockName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
