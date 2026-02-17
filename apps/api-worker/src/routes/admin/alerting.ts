import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import {
  getAlertConfig,
  setAlertConfig,
  fireAlert,
  type AlertConfig,
} from "../../lib/alerting";
import { success, error } from "../../lib/response";
import { requireAdmin, type AppContext } from "./helpers";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/alerting/config", requireAdmin, async (c: AppContext) => {
  const config = await getAlertConfig(c.env.KV);
  return success(c, config);
});

app.put("/alerting/config", requireAdmin, async (c: AppContext) => {
  const body = await c.req.json<Partial<AlertConfig>>();

  const allowedKeys: Array<keyof AlertConfig> = [
    "webhookUrl",
    "cooldownSeconds",
    "enabled",
    "errorRateThresholdPercent",
    "latencyThresholdMs",
    "fasFailureThreshold",
  ];

  const filtered: Partial<AlertConfig> = {};
  for (const key of allowedKeys) {
    if (key in body) {
      (filtered as Record<string, unknown>)[key] = body[key];
    }
  }

  if (
    filtered.cooldownSeconds !== undefined &&
    (filtered.cooldownSeconds < 60 || filtered.cooldownSeconds > 86400)
  ) {
    return error(
      c,
      "VALIDATION_ERROR",
      "cooldownSeconds must be between 60 and 86400",
    );
  }

  if (
    filtered.errorRateThresholdPercent !== undefined &&
    (filtered.errorRateThresholdPercent < 0.1 ||
      filtered.errorRateThresholdPercent > 100)
  ) {
    return error(
      c,
      "VALIDATION_ERROR",
      "errorRateThresholdPercent must be between 0.1 and 100",
    );
  }

  if (
    filtered.latencyThresholdMs !== undefined &&
    (filtered.latencyThresholdMs < 100 || filtered.latencyThresholdMs > 60000)
  ) {
    return error(
      c,
      "VALIDATION_ERROR",
      "latencyThresholdMs must be between 100 and 60000",
    );
  }

  const updated = await setAlertConfig(c.env.KV, filtered);
  return success(c, updated);
});

app.post("/alerting/test", requireAdmin, async (c: AppContext) => {
  const config = await getAlertConfig(c.env.KV);
  const webhookUrl = config.webhookUrl || c.env.ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    return error(c, "NO_WEBHOOK_URL", "No webhook URL configured");
  }

  const testPayload = {
    type: "HIGH_ERROR_RATE" as const,
    severity: "info" as const,
    title: "Test Alert from SafeWork2",
    message: "This is a test alert to verify webhook connectivity.",
    timestamp: new Date().toISOString(),
    metadata: { test: true, triggeredBy: c.var.auth.user.name },
  };

  const sent = await fireAlert(c.env.KV, testPayload, webhookUrl);

  if (!sent) {
    return error(
      c,
      "WEBHOOK_FAILED",
      "Failed to deliver test alert (check webhook URL)",
      500,
    );
  }

  return success(c, { delivered: true });
});

app.get("/maintenance", requireAdmin, async (c: AppContext) => {
  const raw = await c.env.KV.get("maintenance-message");
  if (!raw) {
    return success(c, { active: false, message: null, severity: null });
  }

  try {
    const parsed = JSON.parse(raw) as {
      message: string;
      severity?: string;
    };
    return success(c, {
      active: true,
      message: parsed.message,
      severity: parsed.severity ?? "info",
    });
  } catch {
    return success(c, { active: true, message: raw, severity: "info" });
  }
});

app.put("/maintenance", requireAdmin, async (c: AppContext) => {
  const body = await c.req.json<{
    message: string;
    severity?: "warning" | "critical" | "info";
    ttlSeconds?: number;
  }>();

  if (!body.message || typeof body.message !== "string") {
    return error(c, "VALIDATION_ERROR", "message is required");
  }

  if (body.message.length > 500) {
    return error(
      c,
      "VALIDATION_ERROR",
      "message must be 500 characters or less",
    );
  }

  const severity = body.severity ?? "info";
  const validSeverities = ["warning", "critical", "info"];
  if (!validSeverities.includes(severity)) {
    return error(
      c,
      "VALIDATION_ERROR",
      "severity must be warning, critical, or info",
    );
  }

  const ttl = body.ttlSeconds ?? 86400;
  if (ttl < 60 || ttl > 604800) {
    return error(
      c,
      "VALIDATION_ERROR",
      "ttlSeconds must be between 60 and 604800",
    );
  }

  const payload = JSON.stringify({ message: body.message, severity });
  await c.env.KV.put("maintenance-message", payload, { expirationTtl: ttl });

  return success(c, {
    active: true,
    message: body.message,
    severity,
    ttlSeconds: ttl,
  });
});

app.delete("/maintenance", requireAdmin, async (c: AppContext) => {
  await c.env.KV.delete("maintenance-message");
  return success(c, { active: false });
});

export default app;
