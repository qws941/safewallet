import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizePhone,
  detectMessageType,
  NhnCloudSmsProvider,
  NoOpSmsProvider,
  createSmsClient,
} from "../sms";
import type { SmsConfig } from "../sms";

const TEST_CONFIG: SmsConfig = {
  apiKey: "test-app-key",
  apiSecret: "test-secret-key",
  sender: "010-1234-5678",
};

describe("normalizePhone", () => {
  it("converts Korean 0xx format to E.164", () => {
    expect(normalizePhone("010-1234-5678")).toBe("+821012345678");
    expect(normalizePhone("01012345678")).toBe("+821012345678");
  });

  it("handles already-prefixed 82 numbers", () => {
    expect(normalizePhone("821012345678")).toBe("+821012345678");
  });

  it("strips non-digit characters", () => {
    expect(normalizePhone("010-1234-5678")).toBe("+821012345678");
    expect(normalizePhone("(010) 1234 5678")).toBe("+821012345678");
  });

  it("handles numbers without leading 0 or 82", () => {
    expect(normalizePhone("1012345678")).toBe("+1012345678");
  });
});

describe("detectMessageType", () => {
  it("returns SMS for short messages (<=90 bytes)", () => {
    expect(detectMessageType("Hello")).toBe("SMS");
    expect(detectMessageType("A".repeat(90))).toBe("SMS");
  });

  it("returns LMS for long messages (>90 bytes)", () => {
    expect(detectMessageType("A".repeat(91))).toBe("LMS");
  });

  it("returns LMS when title is provided", () => {
    expect(detectMessageType("Short", "Title")).toBe("LMS");
  });

  it("counts Korean characters by byte length", () => {
    // Korean chars are 3 bytes each in UTF-8; 31 Korean chars = 93 bytes > 90
    const koreanText = "가".repeat(31);
    expect(detectMessageType(koreanText)).toBe("LMS");

    // 30 Korean chars = 90 bytes = exactly threshold
    const shortKorean = "가".repeat(30);
    expect(detectMessageType(shortKorean)).toBe("SMS");
  });
});

describe("NhnCloudSmsProvider", () => {
  let provider: NhnCloudSmsProvider;

  beforeEach(() => {
    provider = new NhnCloudSmsProvider(TEST_CONFIG);
    vi.restoreAllMocks();
  });

  describe("send", () => {
    it("sends SMS successfully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            header: {
              isSuccessful: true,
              resultCode: 0,
              resultMessage: "success",
            },
            body: { data: { requestId: "req-123" } },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await provider.send({
        to: "010-9876-5432",
        body: "테스트",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("req-123");
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/appKeys/test-app-key/sender/sms");
      expect(opts.headers).toHaveProperty("X-Secret-Key", "test-secret-key");

      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.sendNo).toBe("01012345678");
    });

    it("uses LMS endpoint when body exceeds 90 bytes", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            header: {
              isSuccessful: true,
              resultCode: 0,
              resultMessage: "success",
            },
            body: { data: { requestId: "req-lms" } },
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await provider.send({
        to: "01098765432",
        body: "A".repeat(100),
        title: "공지",
      });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("/sender/mms");
    });

    it("handles API failure response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              header: {
                isSuccessful: false,
                resultCode: -1000,
                resultMessage: "Invalid sender",
              },
            }),
        }),
      );

      const result = await provider.send({ to: "01098765432", body: "test" });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe("-1000");
      expect(result.statusMessage).toBe("Invalid sender");
    });

    it("handles HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );

      const result = await provider.send({ to: "01098765432", body: "test" });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe("500");
    });

    it("handles network exception", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network timeout")),
      );

      const result = await provider.send({ to: "01098765432", body: "test" });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe("NETWORK_ERROR");
      expect(result.statusMessage).toBe("Network timeout");
    });
  });

  describe("sendBulk", () => {
    it("sends multiple messages with concurrency limit", async () => {
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                header: {
                  isSuccessful: true,
                  resultCode: 0,
                  resultMessage: "ok",
                },
                body: { data: { requestId: `req-${callCount}` } },
              }),
          });
        }),
      );

      const messages = Array.from({ length: 7 }, (_, i) => ({
        to: `010-0000-000${i}`,
        body: `Message ${i}`,
      }));

      const result = await provider.sendBulk(messages);

      expect(result.totalRequested).toBe(7);
      expect(result.successCount).toBe(7);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(7);
    });

    it("tracks failures in bulk send", async () => {
      let callIndex = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          callIndex++;
          if (callIndex === 2) {
            return Promise.resolve({ ok: false, status: 500 });
          }
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                header: {
                  isSuccessful: true,
                  resultCode: 0,
                  resultMessage: "ok",
                },
                body: { data: { requestId: `req-${callIndex}` } },
              }),
          });
        }),
      );

      const messages = [
        { to: "01011111111", body: "A" },
        { to: "01022222222", body: "B" },
        { to: "01033333333", body: "C" },
      ];

      const result = await provider.sendBulk(messages);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
  });

  describe("verify", () => {
    it("returns true with valid config", async () => {
      expect(await provider.verify()).toBe(true);
    });

    it("returns false with empty apiKey", async () => {
      const p = new NhnCloudSmsProvider({ ...TEST_CONFIG, apiKey: "" });
      expect(await p.verify()).toBe(false);
    });
  });
});

describe("NoOpSmsProvider", () => {
  const noop = new NoOpSmsProvider();

  it("send returns NO_PROVIDER", async () => {
    const result = await noop.send({ to: "01012345678", body: "test" });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe("NO_PROVIDER");
  });

  it("sendBulk returns all failures", async () => {
    const result = await noop.sendBulk([
      { to: "01011111111", body: "A" },
      { to: "01022222222", body: "B" },
    ]);
    expect(result.totalRequested).toBe(2);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(2);
  });

  it("verify returns false", async () => {
    expect(await noop.verify()).toBe(false);
  });
});

describe("createSmsClient", () => {
  it("returns NhnCloudSmsProvider when all env vars present", () => {
    const client = createSmsClient({
      SMS_API_KEY: "key",
      SMS_API_SECRET: "secret",
      SMS_SENDER: "01012345678",
    });
    expect(client).toBeInstanceOf(NhnCloudSmsProvider);
  });

  it("returns NoOpSmsProvider when SMS_API_KEY is missing", () => {
    const client = createSmsClient({
      SMS_API_SECRET: "secret",
      SMS_SENDER: "010",
    });
    expect(client).toBeInstanceOf(NoOpSmsProvider);
  });

  it("returns NoOpSmsProvider when all SMS vars are missing", () => {
    const client = createSmsClient({});
    expect(client).toBeInstanceOf(NoOpSmsProvider);
  });
});
