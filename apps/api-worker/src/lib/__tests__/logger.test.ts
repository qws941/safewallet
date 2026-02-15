import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, startTimer, log } from "../logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emits structured info logs with context fields", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("unit-test");

    logger.info("hello", { userId: "u-1", action: "test_action" });

    expect(logSpy).toHaveBeenCalledOnce();
    const [payload] = logSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;

    expect(entry).toMatchObject({
      level: "info",
      module: "unit-test",
      message: "hello",
      service: "safework2-api",
      userId: "u-1",
      action: "test_action",
    });
    expect(Number.isNaN(Date.parse(String(entry.timestamp)))).toBe(false);
  });

  it("routes warn and error logs to the matching console methods", () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = createLogger("unit-test");

    logger.warn("careful");
    logger.error("broken");

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("ships warn/error logs to safework2-logs-* index and uses waitUntil", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const logger = createLogger("unit-test", {
      elasticsearchUrl: "https://elastic.example",
      waitUntil,
    });

    logger.warn("index-me", { metadata: { traceId: "t-1" } });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(waitUntil).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("https://elastic.example/safework2-logs-");
    expect(init?.method).toBe("POST");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.level).toBe("warn");
    expect(body.module).toBe("unit-test");
    expect(body.msg).toBe("index-me");
    expect(Number.isNaN(Date.parse(String(body["@timestamp"])))).toBe(false);
  });

  it("handles Elasticsearch fetch rejection gracefully", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network failure"));
    const logger = createLogger("unit-test", {
      elasticsearchUrl: "https://elastic.example",
    });

    logger.warn("ship-fail");

    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("does not ship info logs to Elasticsearch", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logger = createLogger("unit-test", {
      elasticsearchUrl: "https://elastic.example",
    });

    logger.info("not-shipped");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("error() accepts Error as second arg and extracts fields", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = createLogger("unit-test");

    const err = new Error("fail");
    logger.error("something broke", err, { userId: "u-1" });

    const [payload] = errorSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;
    const errorField = entry.error as {
      name: string;
      message: string;
      stack?: string;
    };

    expect(entry.level).toBe("error");
    expect(entry.userId).toBe("u-1");
    expect(errorField.name).toBe("Error");
    expect(errorField.message).toBe("fail");
    expect(errorField.stack).toBeDefined();
  });

  it("error() accepts non-Error thrown value", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = createLogger("unit-test");

    logger.error("string thrown", "oops");

    const [payload] = errorSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;
    const errorField = entry.error as { name: string; message: string };

    expect(errorField.name).toBe("UnknownError");
    expect(errorField.message).toBe("oops");
  });

  it("error() accepts plain context object (no Error)", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = createLogger("unit-test");

    logger.error("bad request", { action: "validate", statusCode: 400 });

    const [payload] = errorSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;

    expect(entry.action).toBe("validate");
    expect(entry.statusCode).toBe(400);
    expect(entry.error).toBeUndefined();
  });

  it("ships error logs to Elasticsearch", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const logger = createLogger("unit-test", {
      elasticsearchUrl: "https://elastic.example",
    });

    logger.error("critical");

    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe("startTimer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs duration when end is called", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("timer-test");
    const timer = startTimer(logger);

    timer.end("my-action", { userId: "u-1" });

    expect(logSpy).toHaveBeenCalledOnce();
    const [payload] = logSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;
    expect(entry.action).toBe("my-action");
    expect(typeof entry.duration).toBe("number");
    expect(entry.userId).toBe("u-1");
  });

  it("uses default logger when none provided", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const timer = startTimer();

    timer.end("default-action");

    expect(logSpy).toHaveBeenCalledOnce();
    const [payload] = logSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;
    expect(entry.module).toBe("app");
    expect(entry.action).toBe("default-action");
  });
});

describe("log (default singleton)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes info/warn/error/debug methods", () => {
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("logs with module 'app'", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    log.info("singleton-test");

    const [payload] = logSpy.mock.calls[0];
    const entry = JSON.parse(String(payload)) as Record<string, unknown>;
    expect(entry.module).toBe("app");
  });
});
