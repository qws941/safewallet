import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getAlertConfig,
  setAlertConfig,
  fireAlert,
  buildFasDownAlert,
  buildHighErrorRateAlert,
  buildHighLatencyAlert,
  buildCronFailureAlert,
} from "../alerting";
import { createMockKV } from "../../__tests__/helpers";

function mockKV() {
  return createMockKV() as unknown as KVNamespace;
}

describe("alerting", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAlertConfig", () => {
    it("returns defaults when no config in KV", async () => {
      const kv = mockKV();
      const config = await getAlertConfig(kv);

      expect(config.enabled).toBe(true);
      expect(config.webhookUrl).toBe("");
      expect(config.cooldownSeconds).toBe(300);
      expect(config.errorRateThresholdPercent).toBe(5);
      expect(config.latencyThresholdMs).toBe(3000);
      expect(config.fasFailureThreshold).toBe(1);
    });

    it("merges stored config with defaults", async () => {
      const kv = mockKV();
      await kv.put(
        "alert-config",
        JSON.stringify({
          webhookUrl: "https://hooks.slack.com/test",
          cooldownSeconds: 600,
        }),
      );

      const config = await getAlertConfig(kv);
      expect(config.webhookUrl).toBe("https://hooks.slack.com/test");
      expect(config.cooldownSeconds).toBe(600);
      expect(config.errorRateThresholdPercent).toBe(5);
    });

    it("returns defaults on invalid JSON", async () => {
      const kv = mockKV();
      await kv.put("alert-config", "not-json");

      const config = await getAlertConfig(kv);
      expect(config.webhookUrl).toBe("");
    });
  });

  describe("setAlertConfig", () => {
    it("persists partial update merged with current config", async () => {
      const kv = mockKV();
      const result = await setAlertConfig(kv, {
        webhookUrl: "https://example.com/hook",
      });

      expect(result.webhookUrl).toBe("https://example.com/hook");
      expect(result.enabled).toBe(true);
      expect(kv.put).toHaveBeenCalledWith(
        "alert-config",
        expect.stringContaining("https://example.com/hook"),
      );
    });

    it("preserves existing values when updating subset", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, {
        webhookUrl: "https://a.com",
        cooldownSeconds: 900,
      });
      const updated = await setAlertConfig(kv, { enabled: false });

      expect(updated.webhookUrl).toBe("https://a.com");
      expect(updated.cooldownSeconds).toBe(900);
      expect(updated.enabled).toBe(false);
    });
  });

  describe("fireAlert", () => {
    it("returns false when alerting is disabled", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, {
        enabled: false,
        webhookUrl: "https://hook.test",
      });

      const result = await fireAlert(kv, buildFasDownAlert("test error"));
      expect(result).toBe(false);
    });

    it("returns false when no webhook URL configured", async () => {
      const kv = mockKV();

      const result = await fireAlert(kv, buildFasDownAlert("test error"));
      expect(result).toBe(false);
    });

    it("sends webhook and sets cooldown on success", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, { webhookUrl: "https://hooks.slack.com/test" });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
      );

      const result = await fireAlert(
        kv,
        buildFasDownAlert("connection refused"),
      );
      expect(result).toBe(true);

      expect(fetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        expect.objectContaining({ method: "POST" }),
      );

      expect(kv.put).toHaveBeenCalledWith(
        "alert-cooldown:FAS_DOWN",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 }),
      );
    });

    it("skips when in cooldown", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, { webhookUrl: "https://hooks.slack.com/test" });
      await kv.put("alert-cooldown:FAS_DOWN", new Date().toISOString());

      const result = await fireAlert(kv, buildFasDownAlert("test"));
      expect(result).toBe(false);
    });

    it("returns false on webhook delivery failure", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, { webhookUrl: "https://hooks.slack.com/test" });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("error", { status: 500 })),
      );

      const result = await fireAlert(kv, buildFasDownAlert("test"));
      expect(result).toBe(false);
    });

    it("returns false on fetch exception", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, { webhookUrl: "https://hooks.slack.com/test" });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network error")),
      );

      const result = await fireAlert(kv, buildFasDownAlert("test"));
      expect(result).toBe(false);
    });

    it("uses webhookUrlOverride when provided", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, { webhookUrl: "https://default.hook" });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
      );

      await fireAlert(kv, buildFasDownAlert("test"), "https://override.hook");

      expect(fetch).toHaveBeenCalledWith(
        "https://override.hook",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("appends /slack to Discord webhook URL", async () => {
      const kv = mockKV();
      await setAlertConfig(kv, {
        webhookUrl: "https://discord.com/api/webhooks/123/abc",
      });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
      );

      await fireAlert(kv, buildFasDownAlert("test"));

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/123/abc/slack",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("alert builders", () => {
    it("buildFasDownAlert creates critical FAS_DOWN payload", () => {
      const alert = buildFasDownAlert("connection timed out");
      expect(alert.type).toBe("FAS_DOWN");
      expect(alert.severity).toBe("critical");
      expect(alert.metadata?.error).toBe("connection timed out");
    });

    it("buildHighErrorRateAlert severity escalates at 2x threshold", () => {
      const warning = buildHighErrorRateAlert(6, 5, 60, 1000);
      expect(warning.severity).toBe("warning");

      const critical = buildHighErrorRateAlert(11, 5, 110, 1000);
      expect(critical.severity).toBe("critical");
    });

    it("buildHighLatencyAlert severity escalates at 2x threshold", () => {
      const warning = buildHighLatencyAlert(4000, 3000, 8000);
      expect(warning.severity).toBe("warning");

      const critical = buildHighLatencyAlert(7000, 3000, 12000);
      expect(critical.severity).toBe("critical");
    });

    it("buildCronFailureAlert creates warning payload", () => {
      const alert = buildCronFailureAlert("FAS Sync", "timeout");
      expect(alert.type).toBe("CRON_FAILURE");
      expect(alert.severity).toBe("warning");
      expect(alert.metadata?.cronName).toBe("FAS Sync");
    });
  });
});
