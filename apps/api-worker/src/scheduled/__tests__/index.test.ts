import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSyncFailureEventId,
  emitSyncFailureToElk,
  formatSettleMonth,
  getElkDailyIndexDate,
  getKSTDate,
  getMonthRange,
  withRetry,
} from "../index";
import type { Env } from "../../types";

describe("scheduled helpers", () => {
  // ---------- getKSTDate ----------

  describe("getKSTDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns a Date object", () => {
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
      const result = getKSTDate();
      expect(result).toBeInstanceOf(Date);
    });

    it("is 9 hours ahead of UTC", () => {
      // 2025-06-15T12:00:00Z -> KST 21:00
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
      const utcNow = new Date();
      const kst = getKSTDate();
      const diffMs = kst.getTime() - utcNow.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      expect(diffHours).toBe(9);
    });

    it("rolls over to next day when UTC is past 15:00", () => {
      // UTC 16:00 = KST 01:00 next day
      vi.setSystemTime(new Date("2025-06-15T16:00:00Z"));
      const kst = getKSTDate();
      expect(kst.getUTCDate()).toBe(16); // Next day in KST
    });
  });

  // ---------- getMonthRange ----------

  describe("getMonthRange", () => {
    it("returns start and end for a given month", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });

    it("start is first day of month at 00:00:00", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCDate()).toBe(1);
      expect(range.start.getUTCHours()).toBe(0);
      expect(range.start.getUTCMinutes()).toBe(0);
      expect(range.start.getUTCSeconds()).toBe(0);
    });

    it("end is last day of month at 23:59:59", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const range = getMonthRange(date);

      // June has 30 days
      expect(range.end.getUTCDate()).toBe(30);
      expect(range.end.getUTCHours()).toBe(23);
      expect(range.end.getUTCMinutes()).toBe(59);
      expect(range.end.getUTCSeconds()).toBe(59);
    });

    it("handles February in leap year", () => {
      const date = new Date("2024-02-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCDate()).toBe(1);
      expect(range.end.getUTCDate()).toBe(29);
    });

    it("handles February in non-leap year", () => {
      const date = new Date("2025-02-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.end.getUTCDate()).toBe(28);
    });

    it("handles December correctly", () => {
      const date = new Date("2025-12-20T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(range.end.getUTCDate()).toBe(31);
    });

    it("handles January correctly", () => {
      const date = new Date("2025-01-05T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCMonth()).toBe(0); // January (0-indexed)
      expect(range.end.getUTCDate()).toBe(31);
    });
  });

  // ---------- formatSettleMonth ----------

  describe("formatSettleMonth", () => {
    it("formats as YYYY-MM", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      expect(formatSettleMonth(date)).toBe("2025-06");
    });

    it("pads single-digit month with zero", () => {
      const date = new Date("2025-01-15T12:00:00Z");
      expect(formatSettleMonth(date)).toBe("2025-01");
    });

    it("formats December correctly", () => {
      const date = new Date("2025-12-01T12:00:00Z");
      expect(formatSettleMonth(date)).toBe("2025-12");
    });
  });

  // ---------- withRetry ----------

  describe("withRetry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await withRetry(fn, 3, 10);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds eventually", async () => {
      vi.useRealTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail1"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, 3, 1);

      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useFakeTimers();
    });

    it("throws after max attempts exhausted", async () => {
      vi.useRealTimers();
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        throw new Error("always-fail");
      });

      await expect(withRetry(fn, 2, 1)).rejects.toThrow("always-fail");
      expect(callCount).toBe(2);
      vi.useFakeTimers();
    });

    it("uses default values (maxAttempts=3, baseDelayMs=1000)", async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const result = await withRetry(fn);
      expect(result).toBe(42);
    });
  });

  describe("ELK telemetry helpers", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("builds daily index date from ISO timestamp", () => {
      expect(getElkDailyIndexDate("2026-02-20T02:03:04.567Z")).toBe(
        "2026.02.20",
      );
    });

    it("builds deterministic sync failure event id", () => {
      const eventId = buildSyncFailureEventId({
        timestamp: "2026-02-20T02:03:04.567Z",
        correlationId: "corr-123",
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: "boom",
        lockName: "fas-full",
      });

      expect(eventId).toBe("FAS_WORKER-corr-123");
    });

    it("skips ELK emission when ELASTICSEARCH_URL is missing", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await emitSyncFailureToElk({} as Env, {
        timestamp: "2026-02-20T02:03:04.567Z",
        correlationId: "corr-123",
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: "boom",
        lockName: "fas-full",
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("emits PUT request with deterministic _doc id", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-123",
          syncType: "FAS_ATTENDANCE",
          errorCode: "FAS_ATTENDANCE_SYNC_FAILED",
          errorMessage: "attendance down",
          lockName: "fas-attendance",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toBe(
        "https://elastic.example/safewallet-logs-2026.02.20/_doc/FAS_ATTENDANCE-corr-123",
      );
      expect(init?.method).toBe("PUT");

      const body = JSON.parse(String(init?.body)) as {
        metadata: { correlationId: string; eventId: string; lockName: string };
      };
      expect(body.metadata.correlationId).toBe("corr-123");
      expect(body.metadata.eventId).toBe("FAS_ATTENDANCE-corr-123");
      expect(body.metadata.lockName).toBe("fas-attendance");
    });

    it("uses overridden Elasticsearch index prefix when provided", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        {
          ELASTICSEARCH_URL: "https://elastic.example",
          ELASTICSEARCH_INDEX_PREFIX: "safework2-logs",
        } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-123",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toBe(
        "https://elastic.example/safework2-logs-2026.02.20/_doc/FAS_WORKER-corr-123",
      );
    });

    it("retries once when first ELK request fails", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("network fail"))
        .mockResolvedValueOnce(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-123",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
