/**
 * Alerting: webhook notifications when operational thresholds are exceeded.
 * KV keys: "alert-config" (JSON thresholds), "alert-cooldown:{type}" (dedup TTL).
 * Formats: Slack, Discord (/slack compat), generic JSON POST.
 */

import { createLogger } from "./logger";

const log = createLogger("alerting");

export type AlertType =
  | "FAS_DOWN"
  | "HIGH_ERROR_RATE"
  | "HIGH_LATENCY"
  | "SYNC_FAILURE"
  | "CRON_FAILURE";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertConfig {
  webhookUrl: string;
  /** Seconds between same-type alerts (default: 300) */
  cooldownSeconds: number;
  enabled: boolean;
  /** 5xx rate % threshold (default: 5) */
  errorRateThresholdPercent: number;
  /** Avg response ms threshold (default: 3000) */
  latencyThresholdMs: number;
  /** FAS failures before alert (default: 1) */
  fasFailureThreshold: number;
}

export interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: AlertConfig = {
  webhookUrl: "",
  cooldownSeconds: 300,
  enabled: true,
  errorRateThresholdPercent: 5,
  latencyThresholdMs: 3000,
  fasFailureThreshold: 1,
};

const CONFIG_KEY = "alert-config";
const COOLDOWN_PREFIX = "alert-cooldown:";

export async function getAlertConfig(kv: KVNamespace): Promise<AlertConfig> {
  const raw = await kv.get(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };

  try {
    const parsed = JSON.parse(raw) as Partial<AlertConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setAlertConfig(
  kv: KVNamespace,
  config: Partial<AlertConfig>,
): Promise<AlertConfig> {
  const current = await getAlertConfig(kv);
  const merged: AlertConfig = { ...current, ...config };
  await kv.put(CONFIG_KEY, JSON.stringify(merged));
  return merged;
}

async function isCoolingDown(
  kv: KVNamespace,
  alertType: AlertType,
): Promise<boolean> {
  const key = `${COOLDOWN_PREFIX}${alertType}`;
  const value = await kv.get(key);
  return value !== null;
}

async function setCooldown(
  kv: KVNamespace,
  alertType: AlertType,
  seconds: number,
): Promise<void> {
  const key = `${COOLDOWN_PREFIX}${alertType}`;
  await kv.put(key, new Date().toISOString(), { expirationTtl: seconds });
}

function formatSlackPayload(alert: AlertPayload): Record<string, unknown> {
  const severityEmoji =
    alert.severity === "critical"
      ? "[CRITICAL]"
      : alert.severity === "warning"
        ? "[WARNING]"
        : "[INFO]";

  const metaLines = alert.metadata
    ? Object.entries(alert.metadata)
        .map(([k, v]) => `- ${k}: ${String(v)}`)
        .join("\n")
    : "";

  return {
    text: `${severityEmoji} ${alert.title}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severityEmoji} ${alert.title}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: alert.message,
        },
      },
      ...(metaLines
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Details:*\n${metaLines}`,
              },
            },
          ]
        : []),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `SafeWork2 | ${alert.type} | ${alert.timestamp}`,
          },
        ],
      },
    ],
  };
}

function formatGenericPayload(alert: AlertPayload): Record<string, unknown> {
  return {
    ...alert,
    service: "safework2-api",
  };
}

function detectWebhookFormat(url: string): "slack" | "discord" | "generic" {
  if (url.includes("hooks.slack.com")) return "slack";
  if (url.includes("discord.com/api/webhooks")) return "discord";
  return "generic";
}

async function sendWebhook(url: string, alert: AlertPayload): Promise<boolean> {
  const format = detectWebhookFormat(url);

  let body: Record<string, unknown>;
  let targetUrl = url;

  switch (format) {
    case "slack":
      body = formatSlackPayload(alert);
      break;
    case "discord":
      body = formatSlackPayload(alert);
      if (!url.endsWith("/slack")) {
        targetUrl = `${url}/slack`;
      }
      break;
    default:
      body = formatGenericPayload(alert);
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      log.warn("Webhook delivery failed", {
        statusCode: response.status,
        alertType: alert.type,
      });
      return false;
    }

    log.info("Webhook delivered", { alertType: alert.type, format });
    return true;
  } catch (err) {
    log.error("Webhook request error", {
      error: err instanceof Error ? err.message : String(err),
      alertType: alert.type,
    });
    return false;
  }
}

export async function fireAlert(
  kv: KVNamespace,
  alert: AlertPayload,
  webhookUrlOverride?: string,
): Promise<boolean> {
  const config = await getAlertConfig(kv);

  if (!config.enabled) {
    log.debug("Alerting disabled, skipping", { alertType: alert.type });
    return false;
  }

  const webhookUrl = webhookUrlOverride || config.webhookUrl;
  if (!webhookUrl) {
    log.debug("No webhook URL configured, skipping alert", {
      alertType: alert.type,
    });
    return false;
  }

  const cooling = await isCoolingDown(kv, alert.type);
  if (cooling) {
    log.debug("Alert in cooldown, skipping", { alertType: alert.type });
    return false;
  }

  const sent = await sendWebhook(webhookUrl, alert);

  if (sent) {
    await setCooldown(kv, alert.type, config.cooldownSeconds);
  }

  return sent;
}

export function buildFasDownAlert(errorMessage: string): AlertPayload {
  return {
    type: "FAS_DOWN",
    severity: "critical",
    title: "FAS MariaDB Connection Failed",
    message:
      "The FAS (Foreign Attendance System) database connection has failed. " +
      "Worker attendance verification is using graceful bypass mode.",
    timestamp: new Date().toISOString(),
    metadata: {
      error: errorMessage,
      impact: "Attendance verification bypassed",
    },
  };
}

export function buildHighErrorRateAlert(
  errorRate: number,
  threshold: number,
  total5xx: number,
  totalRequests: number,
): AlertPayload {
  return {
    type: "HIGH_ERROR_RATE",
    severity: errorRate > threshold * 2 ? "critical" : "warning",
    title: `High Error Rate: ${errorRate.toFixed(1)}%`,
    message:
      `The 5xx error rate has exceeded the threshold of ${threshold}%. ` +
      `Current rate: ${errorRate.toFixed(1)}% (${total5xx} errors out of ${totalRequests} requests).`,
    timestamp: new Date().toISOString(),
    metadata: {
      errorRatePercent: Math.round(errorRate * 100) / 100,
      thresholdPercent: threshold,
      total5xx,
      totalRequests,
    },
  };
}

export function buildHighLatencyAlert(
  avgMs: number,
  threshold: number,
  maxMs: number,
): AlertPayload {
  return {
    type: "HIGH_LATENCY",
    severity: avgMs > threshold * 2 ? "critical" : "warning",
    title: `High Latency: ${Math.round(avgMs)}ms avg`,
    message:
      `Average API response time (${Math.round(avgMs)}ms) exceeds the threshold of ${threshold}ms. ` +
      `Peak latency: ${Math.round(maxMs)}ms.`,
    timestamp: new Date().toISOString(),
    metadata: {
      avgDurationMs: Math.round(avgMs),
      maxDurationMs: Math.round(maxMs),
      thresholdMs: threshold,
    },
  };
}

export function buildCronFailureAlert(
  cronName: string,
  errorMessage: string,
): AlertPayload {
  return {
    type: "CRON_FAILURE",
    severity: "warning",
    title: `CRON Job Failed: ${cronName}`,
    message: `Scheduled task "${cronName}" failed after all retry attempts.`,
    timestamp: new Date().toISOString(),
    metadata: {
      cronName,
      error: errorMessage,
    },
  };
}
