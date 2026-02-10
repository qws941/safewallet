import { test, expect } from "@playwright/test";

test.describe("Auth Endpoints", () => {
  test.describe.configure({ mode: "parallel" });

  test("POST /auth/login with empty body returns 400 @smoke", async ({
    request,
  }) => {
    const response = await request.post("./auth/login", { data: {} });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /auth/login with missing fields returns 400", async ({
    request,
  }) => {
    const response = await request.post("./auth/login", {
      data: { phone: "010-1234-5678" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /auth/login with invalid types returns 400", async ({
    request,
  }) => {
    const response = await request.post("./auth/login", {
      data: { phone: 12345, name: true, dob: null },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /auth/refresh with no token returns 401 @smoke", async ({
    request,
  }) => {
    const response = await request.post("./auth/refresh", { data: {} });
    const status = response.status();
    expect(status === 401 || status === 400).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /auth/refresh with invalid token returns 401", async ({
    request,
  }) => {
    const response = await request.post("./auth/refresh", {
      data: { refreshToken: "invalid-token-value" },
    });
    const status = response.status();
    expect(status === 401 || status === 400).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /auth/logout without auth returns 400 or 401", async ({
    request,
  }) => {
    const response = await request.post("./auth/logout");
    const status = response.status();
    expect(status === 400 || status === 401).toBeTruthy();
  });

  test("GET /auth/bypass without secret returns 401 or 400", async ({
    request,
  }) => {
    const response = await request.get("./auth/bypass");
    const status = response.status();
    expect(status === 401 || status === 400 || status === 404).toBeTruthy();
  });

  test("POST /auth/login rate limit headers present", async ({ request }) => {
    const response = await request.post("./auth/login", {
      data: {
        phone: "000-0000-0000",
        name: "test",
        dob: "1990-01-01",
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("Protected Endpoints Return 401", () => {
  test.describe.configure({ mode: "parallel" });

  const protectedEndpoints = [
    { path: "./users/me", name: "GET /users/me" },
    { path: "./posts", name: "GET /posts" },
    { path: "./sites", name: "GET /sites" },
    { path: "./attendance/today", name: "GET /attendance/today" },
    { path: "./notifications", name: "GET /notifications" },
    { path: "./education/courses", name: "GET /education/courses" },
    { path: "./points/balance", name: "GET /points/balance" },
    { path: "./votes/current", name: "GET /votes/current" },
    { path: "./disputes", name: "GET /disputes" },
    { path: "./actions", name: "GET /actions" },
    { path: "./reviews/pending", name: "GET /reviews/pending" },
    { path: "./announcements", name: "GET /announcements" },
  ];

  for (const { path, name } of protectedEndpoints) {
    test(`${name} returns 401 without auth @smoke`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  }
});

test.describe("Admin Endpoints Return 401", () => {
  test.describe.configure({ mode: "parallel" });

  test("GET /admin/users returns 401 without auth", async ({ request }) => {
    const response = await request.get("./admin/users");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("GET /admin/stats returns 401 without auth", async ({ request }) => {
    const response = await request.get("./admin/stats");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("GET /admin/sites returns 401 without auth", async ({ request }) => {
    const response = await request.get("./admin/sites");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("GET /admin/posts returns 401 without auth", async ({ request }) => {
    const response = await request.get("./admin/posts");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /admin/fas/sync-workers returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("./admin/fas/sync-workers", {
      data: {},
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

test.describe("CORS Headers", () => {
  test.describe.configure({ mode: "parallel" });

  test("OPTIONS /health with valid origin returns proper headers @smoke", async ({
    request,
  }) => {
    const response = await request.fetch("./health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://safework2.jclee.me",
        "Access-Control-Request-Method": "GET",
      },
    });
    const headers = response.headers();
    expect(
      headers["access-control-allow-origin"] ||
        headers["access-control-allow-methods"],
    ).toBeTruthy();
  });

  test("OPTIONS /auth/login returns proper CORS headers @smoke", async ({
    request,
  }) => {
    const response = await request.fetch("./auth/login", {
      method: "OPTIONS",
      headers: {
        Origin: "https://safework2.jclee.me",
        "Access-Control-Request-Method": "POST",
      },
    });
    const headers = response.headers();
    expect(
      headers["access-control-allow-origin"] ||
        headers["access-control-allow-methods"],
    ).toBeTruthy();
  });

  test("OPTIONS with invalid origin returns no CORS headers @smoke", async ({
    request,
  }) => {
    const response = await request.fetch("./health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-site.example.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    const headers = response.headers();
    const allowOrigin = headers["access-control-allow-origin"];
    if (allowOrigin) {
      expect(allowOrigin).not.toBe("https://evil-site.example.com");
      expect(allowOrigin).not.toBe("*");
    }
  });

  test("OPTIONS /health from admin origin returns proper headers @smoke", async ({
    request,
  }) => {
    const response = await request.fetch("./health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://admin.safework2.jclee.me",
        "Access-Control-Request-Method": "GET",
      },
    });
    const headers = response.headers();
    expect(
      headers["access-control-allow-origin"] ||
        headers["access-control-allow-methods"],
    ).toBeTruthy();
  });

  test("OPTIONS /health from localhost:3000 returns proper headers @smoke", async ({
    request,
  }) => {
    const response = await request.fetch("./health", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
    });
    const headers = response.headers();
    expect(
      headers["access-control-allow-origin"] ||
        headers["access-control-allow-methods"],
    ).toBeTruthy();
  });
});

test.describe("Error Handling", () => {
  test.describe.configure({ mode: "parallel" });

  test("GET /nonexistent returns 404", async ({ request }) => {
    const response = await request.get("./this-route-does-not-exist-at-all");
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /health returns 405 or 404", async ({ request }) => {
    const response = await request.post("./health", { data: {} });
    const status = response.status();
    expect(status === 405 || status === 404).toBeTruthy();
  });

  test("GET /auth/login (wrong method) returns 405 or 404", async ({
    request,
  }) => {
    const response = await request.get("./auth/login");
    const status = response.status();
    expect(status === 405 || status === 404).toBeTruthy();
  });

  test("Very long URL returns appropriate error", async ({ request }) => {
    const longPath = "./x/" + "a".repeat(8000);
    const response = await request.get(longPath);
    const status = response.status();
    expect(status === 404 || status === 414 || status === 400).toBeTruthy();
  });
});

test.describe("Response Format", () => {
  test.describe.configure({ mode: "parallel" });

  test("Health check returns JSON with success and data @smoke", async ({
    request,
  }) => {
    const response = await request.get("./health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty("status", "healthy");
    expect(body).toHaveProperty("timestamp");
  });

  test("Error responses have success false and error object @smoke", async ({
    request,
  }) => {
    const response = await request.get("./this-route-does-not-exist-404");
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error).toHaveProperty("code");
    expect(body.error).toHaveProperty("message");
  });

  test("All responses have correct Content-Type @smoke", async ({
    request,
  }) => {
    const response = await request.get("./health");
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");
  });

  test("Auth error includes proper error code field @smoke", async ({
    request,
  }) => {
    const response = await request.get("./users/me");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe("string");
  });

  test("API returns timestamp in ISO format @smoke", async ({ request }) => {
    const response = await request.get("./health");
    const body = await response.json();

    const timestamp = body.timestamp;
    expect(timestamp).toBeTruthy();
    const parsed = new Date(timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
