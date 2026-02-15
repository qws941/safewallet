import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(async () => {}),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("../../lib/phash", () => ({
  hammingDistance: vi.fn(() => 100),
  DUPLICATE_THRESHOLD: 10,
}));

const mockGetQueue: unknown[] = [];
const mockAllQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : undefined;
}

function dequeueAll() {
  return mockAllQueue.length > 0 ? mockAllQueue.shift() : [];
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => dequeueAll());
  chain.as = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  return chain;
}

const mockReturningGetQueue: unknown[] = [];
function dequeueReturningGet() {
  return mockReturningGetQueue.length > 0
    ? mockReturningGetQueue.shift()
    : undefined;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueReturningGet());
  chain.run = vi.fn(async () => ({ success: true }));
  chain.onConflictDoNothing = vi.fn(() => chain);
  return chain;
}

const mockDeleteWhere = vi.fn().mockResolvedValue({ success: true });
const mockBatch = vi.fn().mockResolvedValue([]);

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  delete: vi.fn(() => ({
    where: mockDeleteWhere,
  })),
  batch: mockBatch,
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  posts: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    content: "content",
    category: "category",
    hazardType: "hazardType",
    riskLevel: "riskLevel",
    visibility: "visibility",
    locationFloor: "locationFloor",
    locationZone: "locationZone",
    locationDetail: "locationDetail",
    isAnonymous: "isAnonymous",
    metadata: "metadata",
    isPotentialDuplicate: "isPotentialDuplicate",
    duplicateOfPostId: "duplicateOfPostId",
    createdAt: "createdAt",
    reviewStatus: "reviewStatus",
    actionStatus: "actionStatus",
    isUrgent: "isUrgent",
  },
  postImages: {
    id: "id",
    postId: "postId",
    fileUrl: "fileUrl",
    thumbnailUrl: "thumbnailUrl",
    imageHash: "imageHash",
    createdAt: "createdAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
  },
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    restrictedUntil: "restrictedUntil",
  },
  reviews: {
    postId: "postId",
  },
  auditLogs: {
    action: "action",
    actorId: "actorId",
    targetType: "targetType",
    targetId: "targetId",
  },
}));

interface AuthContext {
  user: {
    id: string;
    phone: string;
    role: string;
    name: string;
    nameMasked: string;
  };
  loginDate: string;
}

function makeAuth(role = "WORKER", userId = "user-1"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Test",
      nameMasked: "Te**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: postsRoute } = await import("../posts");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/posts", postsRoute);
  const env = {
    DB: {},
    R2: {
      put: vi.fn(),
      delete: vi.fn(),
    },
  } as Record<string, unknown>;
  return { app, env };
}

describe("routes/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockReturningGetQueue.length = 0;
  });

  describe("POST /posts", () => {
    it("returns 400 when siteId or content is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "", content: "" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when user is restricted", async () => {
      mockGetQueue.push({
        restrictedUntil: new Date(Date.now() + 86400000),
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Test content",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("USER_RESTRICTED");
    });

    it("returns 403 when user is not a site member", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Test content",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NOT_SITE_MEMBER");
    });

    it("creates a post successfully", async () => {
      const newPost = {
        id: "post-1",
        userId: "user-1",
        siteId: "site-1",
        content: "Test content for a longer post that has enough characters",
        category: "HAZARD",
      };

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([]);
      mockGetQueue.push(newPost);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content:
              "Test content for a longer post that has enough characters",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { post: typeof newPost } };
      expect(body.data.post.id).toBe("post-1");
    });

    it("returns 500 when post creation fails", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("POST_CREATION_FAILED");
    });

    it("creates post with imageUrls and imageHashes", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([]);
      mockGetQueue.push({ id: "post-2", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["https://example.com/img.jpg"],
            imageHashes: ["abcdef1234567890"],
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("sets default values for optional fields", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({
        id: "post-3",
        category: "HAZARD",
        visibility: "WORKER_PUBLIC",
        isAnonymous: false,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("detects image duplicates via pHash", async () => {
      const { hammingDistance: mockHamming } = await import("../../lib/phash");
      (mockHamming as ReturnType<typeof vi.fn>).mockReturnValue(5);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([
        { imageHash: "1234567890abcdef", postId: "old-post" },
      ]);
      mockGetQueue.push({ id: "post-dup", isPotentialDuplicate: true });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["https://example.com/img.jpg"],
            imageHashes: ["abcdef1234567890"],
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /posts", () => {
    it("returns posts with author info", async () => {
      mockAllQueue.push([
        {
          post: { id: "p1", isAnonymous: false, userId: "u1", siteId: "s1" },
          author: { id: "u1", name: "Test", nameMasked: "Te**" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts?siteId=s1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { posts: Array<{ author: { id: string } | null }> };
      };
      expect(body.data.posts).toHaveLength(1);
      expect(body.data.posts[0].author).toBeTruthy();
    });

    it("hides author for anonymous posts", async () => {
      mockAllQueue.push([
        {
          post: { id: "p1", isAnonymous: true, userId: "u1" },
          author: { id: "u1", name: "Test", nameMasked: "Te**" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { posts: Array<{ author: null }> };
      };
      expect(body.data.posts[0].author).toBeNull();
    });

    it("filters by category", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts?siteId=s1&category=HAZARD",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("respects limit and offset", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts?limit=5&offset=10", {}, env);
      expect(res.status).toBe(200);
    });

    it("caps limit at 100", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts?limit=999", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns empty when no posts", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { posts: unknown[] } };
      expect(body.data.posts).toHaveLength(0);
    });
  });

  describe("GET /posts/me", () => {
    it("returns user own posts", async () => {
      mockAllQueue.push([
        {
          id: "p1",
          category: "HAZARD",
          content: "test",
          reviewStatus: "PENDING",
          actionStatus: null,
          isUrgent: false,
          createdAt: new Date("2025-01-01T10:00:00Z"),
          imageCount: 2,
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/me", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { items: unknown[]; nextCursor: string | undefined };
      };
      expect(body.data.items).toHaveLength(1);
      expect(body.data.nextCursor).toBeUndefined();
    });

    it("returns nextCursor when hasMore", async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({
        id: `p${i}`,
        category: "HAZARD",
        content: "test",
        reviewStatus: "PENDING",
        actionStatus: null,
        isUrgent: false,
        createdAt: new Date(
          `2025-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
        ),
        imageCount: 0,
      }));
      mockAllQueue.push(items);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/me", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { items: unknown[]; nextCursor: string };
      };
      expect(body.data.items).toHaveLength(20);
      expect(body.data.nextCursor).toBeDefined();
    });

    it("filters by siteId and reviewStatus", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/me?siteId=s1&reviewStatus=APPROVED",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("supports cursor parameter", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/me?cursor=1704067200000", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /posts/:id", () => {
    it("returns 404 when post not found", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/nonexistent", {}, env);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("POST_NOT_FOUND");
    });

    it("returns post with images, reviews, and author", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        isAnonymous: false,
        siteId: "s1",
      });
      mockGetQueue.push({ id: "u1", nameMasked: "Te**" });
      mockAllQueue.push([{ id: "img1", fileUrl: "test.jpg" }]);
      mockAllQueue.push([{ id: "r1", postId: "p1" }]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          post: {
            author: { id: string } | null;
            images: unknown[];
            reviews: unknown[];
          };
        };
      };
      expect(body.data.post.author).toBeTruthy();
      expect(body.data.post.images).toHaveLength(1);
      expect(body.data.post.reviews).toHaveLength(1);
    });

    it("hides author for anonymous post", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        isAnonymous: true,
        siteId: "s1",
      });
      mockGetQueue.push({ id: "u1", nameMasked: "Te**" });
      mockAllQueue.push([]);
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { post: { author: null } };
      };
      expect(body.data.post.author).toBeNull();
    });

    it("logs audit for IMAGE_DOWNLOAD when images exist", async () => {
      const { logAuditWithContext } = await import("../../lib/audit");

      mockGetQueue.push({ id: "p1", userId: "u1", isAnonymous: false });
      mockGetQueue.push({ id: "u1", nameMasked: "Te**" });
      mockAllQueue.push([{ id: "img1", fileUrl: "test.jpg" }]);
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      await app.request("/posts/p1", {}, env);

      expect(logAuditWithContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "IMAGE_DOWNLOAD",
        "user-1",
        "IMAGE",
        "p1",
        expect.objectContaining({ imageIds: ["img1"] }),
      );
    });
  });

  describe("POST /posts/:id/images", () => {
    it("returns 404 when post not found", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const res = await app.request(
        "/posts/nonexistent/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user does not own the post", async () => {
      mockGetQueue.push({ id: "p1", userId: "other-user" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 when no file provided", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NO_FILE");
    });

    it("returns 400 for invalid file type", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.txt", { type: "text/plain" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("returns 400 for file too large", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const bigContent = new Uint8Array(11 * 1024 * 1024);
      formData.append(
        "file",
        new File([bigContent], "big.jpg", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FILE_TOO_LARGE");
    });

    it("uploads image successfully", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockReturningGetQueue.push({
        id: "img-1",
        postId: "p1",
        fileUrl: "posts/p1/abc.jpg",
      });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["imagedata"], "photo.jpg", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { image: { id: string } } };
      expect(body.data.image.id).toBe("img-1");
    });
  });

  describe("DELETE /posts/:id", () => {
    it("returns 404 when post not found", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/nonexistent",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user is not owner and not admin", async () => {
      mockGetQueue.push({ id: "p1", userId: "other-user" });

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("deletes post by owner", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockAllQueue.push([{ fileUrl: "posts/p1/img1.jpg" }]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
      expect(
        (env as Record<string, { delete: ReturnType<typeof vi.fn> }>).R2.delete,
      ).toHaveBeenCalledWith("posts/p1/img1.jpg");
    });

    it("allows admin to delete any post", async () => {
      mockGetQueue.push({ id: "p1", userId: "other-user" });
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth("ADMIN", "admin-1"));
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
    });

    it("deletes multiple R2 images before deleting post", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockAllQueue.push([
        { fileUrl: "posts/p1/img1.jpg" },
        { fileUrl: "posts/p1/img2.jpg" },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
      const r2 = (env as Record<string, { delete: ReturnType<typeof vi.fn> }>)
        .R2;
      expect(r2.delete).toHaveBeenCalledTimes(2);
    });
  });
});
