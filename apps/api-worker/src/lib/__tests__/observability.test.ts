import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { log, startTimer } from "../observability";

describe("observability (re-export from logger)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("log", () => {
    it("logs debug messages with metadata", () => {
      log.debug("debug-msg", { metadata: { extra: "data" } });
      expect(console.log).toHaveBeenCalledOnce();
      const [payload] = (console.log as ReturnType<typeof vi.fn>).mock.calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      expect(entry.level).toBe("debug");
      expect(entry.message).toBe("debug-msg");
      expect(entry.metadata).toEqual({ extra: "data" });
    });

    it("logs info messages", () => {
      log.info("info-msg");
      const [payload] = (console.log as ReturnType<typeof vi.fn>).mock.calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      expect(entry.level).toBe("info");
    });

    it("logs warn messages", () => {
      log.warn("warn-msg");
      const [payload] = (console.warn as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      expect(entry.level).toBe("warn");
    });

    it("logs error messages with Error instance", () => {
      const err = new Error("fail");
      log.error("error-msg", err, { userId: "123" });
      const [payload] = (console.error as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      const errorField = entry.error as {
        name: string;
        message: string;
        stack?: string;
      };
      expect(entry.level).toBe("error");
      expect(entry.message).toBe("error-msg");
      expect(errorField.message).toBe("fail");
      expect(errorField.name).toBe("Error");
      expect(errorField.stack).toBeDefined();
      expect(entry.userId).toBe("123");
    });

    it("logs error messages with non-Error value", () => {
      log.error("error-msg", "string-error");
      const [payload] = (console.error as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      const errorField = entry.error as { name: string; message: string };
      expect(errorField.name).toBe("UnknownError");
      expect(errorField.message).toBe("string-error");
    });
  });

  describe("startTimer", () => {
    it("logs duration when end is called", () => {
      const timer = startTimer();
      timer.end("my-action", { userId: "u1" });

      expect(console.log).toHaveBeenCalledOnce();
      const [payload] = (console.log as ReturnType<typeof vi.fn>).mock.calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      expect(entry.level).toBe("info");
      expect(entry.action).toBe("my-action");
      expect(typeof entry.duration).toBe("number");
      expect(entry.userId).toBe("u1");
    });

    it("works without extra context", () => {
      const timer = startTimer();
      timer.end("simple-action");

      const [payload] = (console.log as ReturnType<typeof vi.fn>).mock.calls[0];
      const entry = JSON.parse(String(payload)) as Record<string, unknown>;
      expect(entry.action).toBe("simple-action");
    });
  });
});
