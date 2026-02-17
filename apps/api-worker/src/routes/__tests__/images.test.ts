import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

// Mock auth middleware
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: unknown, next: () => Promise<void>) => next()),
}));
// Mock image-privacy
vi.mock("../../lib/image-privacy", () => ({
  processImageForPrivacy: vi.fn(async (buf: ArrayBuffer, name: string) => ({
    buffer: buf,
    metadata: {
      "privacy-processed": "true",
      "original-filename": name,
    },
  })),
}));
// Mock phash
vi.mock("../../lib/phash", () => ({
  computeImageHash: vi.fn(async () => "abc123hash"),
}));
// Mock analytics
vi.mock("../../middleware/analytics", () => ({
  trackEvent: vi.fn(),
}));
// Mock observability
vi.mock("../../lib/observability", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  startTimer: vi.fn(() => ({ end: vi.fn(() => 50), elapsed: () => 50 })),
}));
// Mock workers-ai
vi.mock("../../lib/workers-ai", () => ({
  classifyHazard: vi.fn(async () => ({
    hazardType: "fall_hazard",
    confidence: 0.85,
    rawLabel: "ladder",
  })),
}));

import type { Env, AuthContext } from "../../types";
import imageRoutes from "../images";

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

function makeAuth(role = "WORKER"): AuthContext {
  return {
    user: {
      id: "user-1",
      name: "Test",
      nameMasked: "Te**",
      phone: "010-0000-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

function createApp(
  auth: AuthContext | null,
  r2Overrides?: Record<string, unknown>,
) {
  const r2: Record<string, unknown> = {
    put: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(null),
    get: vi.fn().mockResolvedValue(null),
    ...r2Overrides,
  };

  const env = {
    DB: {},
    R2: r2,
    JWT_SECRET: "test-secret",
    HMAC_SECRET: "test-hmac",
    ANALYTICS: { writeDataPoint: vi.fn() },
  } as unknown as Env;

  const app = new Hono<AppEnv>();
  if (auth) {
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      await next();
    });
  }
  app.route("/images", imageRoutes);
  return { app, env, r2 };
}

describe("routes/images", () => {
  // ---------- POST /upload ----------

  describe("POST /upload", () => {
    it("returns 400 when no file provided", async () => {
      const { app, env } = createApp(makeAuth());
      const form = new FormData();

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when file is too large", async () => {
      const { app, env } = createApp(makeAuth());
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);
      const form = new FormData();
      form.append(
        "file",
        new Blob([largeBuffer], { type: "image/jpeg" }),
        "big.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid file type", async () => {
      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob(["hello"], { type: "text/plain" }),
        "test.txt",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("uploads JPEG file successfully", async () => {
      const { app, env, r2 } = createApp(makeAuth());
      const form = new FormData();
      const jpegBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
        type: "image/jpeg",
      });
      form.append("file", jpegBlob, "photo.jpg");
      form.append("context", "post-upload");

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(r2.put).toHaveBeenCalled();
    });
  });

  // ---------- GET /info/:filename ----------

  describe("GET /info/:filename", () => {
    it("returns 404 when file not found in R2", async () => {
      const { app, env } = createApp(makeAuth());

      const res = await app.request(
        "http://localhost/images/info/missing.jpg",
        {},
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns metadata when file exists", async () => {
      const { app, env } = createApp(makeAuth(), {
        head: vi.fn().mockResolvedValue({
          key: "photo.jpg",
          size: 12345,
          httpMetadata: { contentType: "image/jpeg" },
          customMetadata: { "privacy-processed": "true" },
          uploaded: new Date("2025-01-01"),
        }),
      });

      const res = await app.request(
        "http://localhost/images/info/photo.jpg",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { filename: string } };
      expect(body.data.filename).toBe("photo.jpg");
    });
  });

  describe("AI hazard classification", () => {
    it("triggers AI classification when AI binding is present", async () => {
      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const headResult = {
        customMetadata: { "privacy-processed": "true" },
      };
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(headResult);

      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });

      (env as Record<string, unknown>).AI = {
        run: vi.fn().mockResolvedValue([{ label: "ladder", score: 0.85 }]),
      };

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "test.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(waitUntilFn).toHaveBeenCalledOnce();
    });

    it("skips AI when AI binding is not present", async () => {
      const putFn = vi.fn().mockResolvedValue(undefined);
      const { app, env } = createApp(makeAuth(), { put: putFn });

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "test.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(putFn).toHaveBeenCalledTimes(1);
    });
  });
});
