/**
 * SMS sending module — provider-agnostic interface with factory pattern.
 * Env bindings: SMS_API_KEY, SMS_API_SECRET, SMS_SENDER
 * Default provider: NHN Cloud (TOAST).
 */

import { createLogger } from "./logger";

const log = createLogger("sms");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmsMessage {
  to: string;
  body: string;
  title?: string;
  type?: "SMS" | "LMS" | "MMS";
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  statusCode?: string;
  statusMessage?: string;
}

export interface SmsBulkResult {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: SmsSendResult[];
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<SmsSendResult>;
  sendBulk(messages: SmsMessage[]): Promise<SmsBulkResult>;
  verify(): Promise<boolean>;
}

export interface SmsConfig {
  apiKey: string;
  apiSecret: string;
  sender: string;
}

// ─── Utility ────────────────────────────────────────────────────────────────

/** Korean phone → E.164 (+82...). Strips hyphens, handles 0xx and 82xx formats. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("82")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+82${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/** SMS if ≤90 bytes, LMS otherwise (Korean telecom threshold). */
export function detectMessageType(body: string, title?: string): "SMS" | "LMS" {
  const byteLength = new TextEncoder().encode(body).length;
  if (title || byteLength > 90) {
    return "LMS";
  }
  return "SMS";
}

// ─── NHN Cloud Provider ─────────────────────────────────────────────────────

const NHN_BASE_URL = "https://api-sms.cloud.toast.com/sms/v3.0";

export class NhnCloudSmsProvider implements SmsProvider {
  private readonly config: SmsConfig;

  constructor(config: SmsConfig) {
    this.config = config;
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const type = message.type ?? detectMessageType(message.body, message.title);
    const endpoint = type === "SMS" ? "sender/sms" : "sender/mms";
    const url = `${NHN_BASE_URL}/appKeys/${this.config.apiKey}/${endpoint}`;

    const payload: Record<string, unknown> = {
      body: message.body,
      sendNo: this.config.sender.replace(/[^0-9]/g, ""),
      recipientList: [
        {
          recipientNo: normalizePhone(message.to).replace("+82", "0"),
          countryCode: "82",
        },
      ],
    };

    if (type === "LMS" && message.title) {
      payload.title = message.title;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "X-Secret-Key": this.config.apiSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        log.error("NHN Cloud SMS API error", {
          metadata: { status: response.status, to: message.to },
        });
        return {
          success: false,
          statusCode: String(response.status),
          statusMessage: `HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        header: {
          isSuccessful: boolean;
          resultCode: number;
          resultMessage: string;
        };
        body?: { data?: { requestId?: string } };
      };

      if (!data.header.isSuccessful) {
        log.warn("NHN Cloud SMS send failed", {
          metadata: {
            resultCode: data.header.resultCode,
            resultMessage: data.header.resultMessage,
          },
        });
        return {
          success: false,
          statusCode: String(data.header.resultCode),
          statusMessage: data.header.resultMessage,
        };
      }

      return {
        success: true,
        messageId: data.body?.data?.requestId,
        statusCode: "0",
        statusMessage: "success",
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error("NHN Cloud SMS send exception", {
        error: { name: error.name, message: error.message, stack: error.stack },
        metadata: { to: message.to },
      });
      return {
        success: false,
        statusCode: "NETWORK_ERROR",
        statusMessage: error.message,
      };
    }
  }

  async sendBulk(messages: SmsMessage[]): Promise<SmsBulkResult> {
    const results: SmsSendResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    const CONCURRENCY = 5;
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
      const batch = messages.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((msg) => this.send(msg)),
      );
      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      }
    }

    return {
      totalRequested: messages.length,
      successCount,
      failureCount,
      results,
    };
  }

  async verify(): Promise<boolean> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.sender) {
      return false;
    }
    return true;
  }
}

// ─── No-Op Provider ─────────────────────────────────────────────────────────────────

export class NoOpSmsProvider implements SmsProvider {
  async send(message: SmsMessage): Promise<SmsSendResult> {
    log.info("SMS send (no-op): provider not configured", {
      metadata: { to: message.to, bodyLength: message.body.length },
    });
    return {
      success: false,
      statusCode: "NO_PROVIDER",
      statusMessage: "SMS provider not configured",
    };
  }

  async sendBulk(messages: SmsMessage[]): Promise<SmsBulkResult> {
    log.info("SMS sendBulk (no-op): provider not configured", {
      metadata: { count: messages.length },
    });
    return {
      totalRequested: messages.length,
      successCount: 0,
      failureCount: messages.length,
      results: messages.map(() => ({
        success: false,
        statusCode: "NO_PROVIDER",
        statusMessage: "SMS provider not configured",
      })),
    };
  }

  async verify(): Promise<boolean> {
    return false;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export interface SmsEnv {
  SMS_API_KEY?: string;
  SMS_API_SECRET?: string;
  SMS_SENDER?: string;
}

export function createSmsClient(env: SmsEnv): SmsProvider {
  if (!env.SMS_API_KEY || !env.SMS_API_SECRET || !env.SMS_SENDER) {
    log.info("SMS client created in no-op mode (missing env bindings)");
    return new NoOpSmsProvider();
  }

  return new NhnCloudSmsProvider({
    apiKey: env.SMS_API_KEY,
    apiSecret: env.SMS_API_SECRET,
    sender: env.SMS_SENDER,
  });
}
