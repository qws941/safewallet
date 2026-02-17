import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  base64urlEncode,
  base64urlDecode,
  shouldRemoveSubscription,
  isRetryableError,
  type PushResult,
} from "../web-push";

describe("base64urlEncode", () => {
  it("encodes ArrayBuffer to base64url string", () => {
    const data = new TextEncoder().encode("Hello, World!");
    const encoded = base64urlEncode(data);
    expect(encoded).toBe("SGVsbG8sIFdvcmxkIQ");
  });

  it("encodes Uint8Array to base64url string", () => {
    const data = new Uint8Array([0, 1, 2, 3, 255]);
    const encoded = base64urlEncode(data);
    expect(encoded).toBeTruthy();
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("encodes empty buffer", () => {
    const data = new Uint8Array(0);
    expect(base64urlEncode(data)).toBe("");
  });

  it("handles ArrayBuffer input", () => {
    const data = new Uint8Array([65, 66, 67]).buffer;
    const encoded = base64urlEncode(data);
    expect(encoded).toBe("QUJD");
  });
});

describe("base64urlDecode", () => {
  it("decodes base64url string to Uint8Array", () => {
    const decoded = base64urlDecode("SGVsbG8sIFdvcmxkIQ");
    expect(new TextDecoder().decode(decoded)).toBe("Hello, World!");
  });

  it("handles standard base64 with padding", () => {
    const decoded = base64urlDecode("QUJD");
    expect(Array.from(decoded)).toEqual([65, 66, 67]);
  });

  it("roundtrips with encode", () => {
    const original = new Uint8Array([0, 128, 255, 1, 254]);
    const encoded = base64urlEncode(original);
    const decoded = base64urlDecode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("handles base64url with - and _", () => {
    const encoded = base64urlEncode(new Uint8Array([251, 239, 191]));
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    const decoded = base64urlDecode(encoded);
    expect(Array.from(decoded)).toEqual([251, 239, 191]);
  });
});

describe("shouldRemoveSubscription", () => {
  it("returns true for 404 status", () => {
    const result: PushResult = {
      success: false,
      statusCode: 404,
      endpoint: "https://push.example.com/sub/1",
      error: "Not Found",
    };
    expect(shouldRemoveSubscription(result)).toBe(true);
  });

  it("returns true for 410 Gone status", () => {
    const result: PushResult = {
      success: false,
      statusCode: 410,
      endpoint: "https://push.example.com/sub/1",
      error: "Gone",
    };
    expect(shouldRemoveSubscription(result)).toBe(true);
  });

  it("returns false for other status codes", () => {
    const result: PushResult = {
      success: false,
      statusCode: 500,
      endpoint: "https://push.example.com/sub/1",
      error: "Server Error",
    };
    expect(shouldRemoveSubscription(result)).toBe(false);
  });

  it("returns false for successful result", () => {
    const result: PushResult = {
      success: true,
      statusCode: 201,
      endpoint: "https://push.example.com/sub/1",
    };
    expect(shouldRemoveSubscription(result)).toBe(false);
  });
});

describe("isRetryableError", () => {
  it("returns true for 429 rate limit", () => {
    const result: PushResult = {
      success: false,
      statusCode: 429,
      endpoint: "https://push.example.com/sub/1",
      error: "Too Many Requests",
    };
    expect(isRetryableError(result)).toBe(true);
  });

  it("returns true for 5xx server errors", () => {
    for (const code of [500, 502, 503, 504]) {
      const result: PushResult = {
        success: false,
        statusCode: code,
        endpoint: "https://push.example.com/sub/1",
        error: "Server Error",
      };
      expect(isRetryableError(result)).toBe(true);
    }
  });

  it("returns false for 4xx client errors (except 429)", () => {
    for (const code of [400, 401, 403, 404, 410]) {
      const result: PushResult = {
        success: false,
        statusCode: code,
        endpoint: "https://push.example.com/sub/1",
        error: "Client Error",
      };
      expect(isRetryableError(result)).toBe(false);
    }
  });

  it("returns false for 0 (network error)", () => {
    const result: PushResult = {
      success: false,
      statusCode: 0,
      endpoint: "https://push.example.com/sub/1",
      error: "Network Error",
    };
    expect(isRetryableError(result)).toBe(false);
  });
});
