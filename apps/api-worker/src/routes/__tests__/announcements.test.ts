import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockSelectFromWhereGet = vi.fn();
const mockInsertReturningGet = vi.fn();
const mockUpdateReturningGet = vi.fn();
const mockDeleteWhere = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => ({
                all: mockAll,
              })),
            })),
          })),
          get: mockGet,
        })),
      })),
      where: vi.fn(() => ({
        get: mockSelectFromWhereGet,
        all: mockAll,
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => ({
        get: mockInsertReturningGet,
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockUpdateReturningGet,
        })),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: mockDeleteWhere.mockResolvedValue(undefined),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  announcements: {
    id: "id",
    siteId: "siteId",
    authorId: "authorId",
    title: "title",
    content: "content",
    isPinned: "isPinned",
    isPublished: "isPublished",
    scheduledAt: "scheduledAt",
    createdAt: "createdAt",
  },
  users: { id: "id", nameMasked: "nameMasked" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
    role: "role",
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

function makeAuth(role = "ADMIN", userId = "user-1"): AuthContext {
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
  const { default: announcementsRoute } = await import("../announcements");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/announcements", announcementsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("routes/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /announcements", () => {
    it("returns announcements list for admin", async () => {
      const mockData = [
        {
          announcement: { id: "a1", title: "Test", siteId: "s1" },
          author: { id: "u1", name: "Author" },
        },
      ];
      mockAll.mockResolvedValue(mockData);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/announcements", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.data).toHaveLength(1);
    });

    it("returns 403 for worker without site membership", async () => {
      mockSelectFromWhereGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/announcements?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("allows worker with active membership", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAll.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/announcements?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });

    it("respects limit and offset params", async () => {
      mockAll.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements?limit=5&offset=10",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.pagination.limit).toBe(5);
      expect(body.data.pagination.offset).toBe(10);
    });

    it("caps limit at 100", async () => {
      mockAll.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/announcements?limit=500", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.pagination.limit).toBe(100);
    });
  });

  describe("GET /announcements/:id", () => {
    it("returns single announcement", async () => {
      mockGet.mockResolvedValue({
        announcement: { id: "a1", title: "Hello" },
        author: { id: "u1", name: "Author" },
      });
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/announcements/a1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.announcement.id).toBe("a1");
    });

    it("returns 404 when not found", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request("/announcements/missing", {}, env);
      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.error.code).toBe("ANNOUNCEMENT_NOT_FOUND");
    });
  });

  describe("POST /announcements", () => {
    it("creates announcement as admin", async () => {
      const newAnnouncement = {
        id: "a-new",
        title: "New",
        content: "Body",
        siteId: "00000000-0000-0000-0000-000000000001",
        authorId: "user-1",
      };
      mockInsertReturningGet.mockResolvedValue(newAnnouncement);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "00000000-0000-0000-0000-000000000001",
            title: "New",
            content: "Body",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: Record<string, Record<string, unknown>>;
        error: { code: string };
      };
      expect(body.data.announcement.id).toBe("a-new");
    });

    it("returns 400 when title is missing", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "00000000-0000-0000-0000-000000000001",
            content: "No title",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when siteId is missing (zod rejects)", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "X", content: "Y" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when title is missing", async () => {
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "No title" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when worker has WORKER role membership", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        userId: "user-1",
        siteId: "00000000-0000-0000-0000-000000000001",
        status: "ACTIVE",
        role: "WORKER",
      });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/announcements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "00000000-0000-0000-0000-000000000001",
            title: "X",
            content: "Y",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when worker has no permission on site", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
        role: "WORKER",
      });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/announcements",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "X",
            content: "Y",
            siteId: "site-1",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /announcements/:id", () => {
    it("updates announcement as author", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        id: "a1",
        authorId: "user-1",
        siteId: "site-1",
      });
      mockUpdateReturningGet.mockResolvedValue({
        id: "a1",
        title: "Updated",
      });
      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        "/announcements/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when announcement not found", async () => {
      mockSelectFromWhereGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements/missing",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "X" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when non-author non-admin tries to update", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        id: "a1",
        authorId: "other-user",
        siteId: "site-1",
      });
      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        "/announcements/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "X" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /announcements/:id", () => {
    it("deletes announcement as admin", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        id: "a1",
        authorId: "other-user",
      });
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements/a1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when announcement not found", async () => {
      mockSelectFromWhereGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("ADMIN"));
      const res = await app.request(
        "/announcements/missing",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when non-author non-admin tries to delete", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        id: "a1",
        authorId: "other-user",
      });
      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        "/announcements/a1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("allows author to delete own announcement", async () => {
      mockSelectFromWhereGet.mockResolvedValue({
        id: "a1",
        authorId: "user-1",
      });
      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        "/announcements/a1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(200);
    });
  });
});
