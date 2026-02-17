import { createLogger } from "./logger";

const logger = createLogger("session-cache");

const CACHE_PREFIX = "session:";
const CACHE_TTL_SECONDS = 300;

export interface CachedUserData {
  name: string;
  nameMasked: string;
}

export async function getCachedUser(
  kv: KVNamespace,
  userId: string,
): Promise<CachedUserData | null> {
  try {
    const raw = await kv.get(`${CACHE_PREFIX}${userId}`, "json");
    if (
      raw &&
      typeof raw === "object" &&
      "name" in raw &&
      "nameMasked" in raw
    ) {
      return raw as CachedUserData;
    }
    return null;
  } catch (err) {
    logger.warn("KV cache read failed, falling back to D1", {
      userId,
      error: { name: "CacheError", message: String(err) },
    });
    return null;
  }
}

export async function setCachedUser(
  kv: KVNamespace,
  userId: string,
  data: CachedUserData,
): Promise<void> {
  try {
    await kv.put(`${CACHE_PREFIX}${userId}`, JSON.stringify(data), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } catch (err) {
    logger.warn("KV cache write failed", {
      userId,
      error: { name: "CacheError", message: String(err) },
    });
  }
}

export async function invalidateCachedUser(
  kv: KVNamespace,
  userId: string,
): Promise<void> {
  try {
    await kv.delete(`${CACHE_PREFIX}${userId}`);
  } catch (err) {
    logger.warn("KV cache invalidation failed", {
      userId,
      error: { name: "CacheError", message: String(err) },
    });
  }
}
