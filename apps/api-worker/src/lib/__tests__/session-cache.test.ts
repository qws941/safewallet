import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getCachedUser,
  setCachedUser,
  invalidateCachedUser,
} from "../session-cache";

vi.mock("../logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => {
      const val = store.get(key);
      return val ? JSON.parse(val) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

describe("session-cache", () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    kv = createMockKV();
    vi.clearAllMocks();
  });

  describe("getCachedUser", () => {
    it("returns null on cache miss", async () => {
      const result = await getCachedUser(kv, "user-1");
      expect(result).toBeNull();
      expect(kv.get).toHaveBeenCalledWith("session:user-1", "json");
    });

    it("returns cached data on hit", async () => {
      kv._store.set(
        "session:user-1",
        JSON.stringify({ name: "홍길동", nameMasked: "홍*동" }),
      );

      const result = await getCachedUser(kv, "user-1");
      expect(result).toEqual({ name: "홍길동", nameMasked: "홍*동" });
    });

    it("returns null when cached value has wrong shape", async () => {
      (kv.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        bad: "data",
      });

      const result = await getCachedUser(kv, "user-1");
      expect(result).toBeNull();
    });

    it("returns null on KV error without throwing", async () => {
      (kv.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("KV unavailable"),
      );

      const result = await getCachedUser(kv, "user-1");
      expect(result).toBeNull();
    });
  });

  describe("setCachedUser", () => {
    it("stores user data with TTL", async () => {
      await setCachedUser(kv, "user-1", {
        name: "홍길동",
        nameMasked: "홍*동",
      });

      expect(kv.put).toHaveBeenCalledWith(
        "session:user-1",
        JSON.stringify({ name: "홍길동", nameMasked: "홍*동" }),
        { expirationTtl: 300 },
      );
    });

    it("does not throw on KV error", async () => {
      (kv.put as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("KV write failed"),
      );

      await expect(
        setCachedUser(kv, "user-1", { name: "test", nameMasked: "t*t" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("invalidateCachedUser", () => {
    it("deletes the cache key", async () => {
      kv._store.set("session:user-1", "{}");

      await invalidateCachedUser(kv, "user-1");

      expect(kv.delete).toHaveBeenCalledWith("session:user-1");
    });

    it("does not throw on KV error", async () => {
      (kv.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("KV delete failed"),
      );

      await expect(invalidateCachedUser(kv, "user-1")).resolves.toBeUndefined();
    });
  });

  describe("integration: cache lifecycle", () => {
    it("set → get → invalidate → get returns null", async () => {
      await setCachedUser(kv, "user-1", {
        name: "홍길동",
        nameMasked: "홍*동",
      });

      const hit = await getCachedUser(kv, "user-1");
      expect(hit).toEqual({ name: "홍길동", nameMasked: "홍*동" });

      await invalidateCachedUser(kv, "user-1");

      const miss = await getCachedUser(kv, "user-1");
      expect(miss).toBeNull();
    });
  });
});
