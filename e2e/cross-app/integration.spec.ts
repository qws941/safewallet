import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL ?? "https://safework2.jclee.me/api";
const WORKER_APP = process.env.WORKER_APP_URL ?? "https://safework2.jclee.me";
const ADMIN_APP =
  process.env.ADMIN_APP_URL ?? "https://admin.safework2.jclee.me";

test.describe("Cross-App Integration @smoke", () => {
  test("API health matches worker-app availability @smoke", async ({
    request,
    page,
  }) => {
    // API should be healthy
    const apiResponse = await request.get(`${API_BASE}/health`);
    expect(apiResponse.status()).toBe(200);
    const body = await apiResponse.json();
    expect(body.status).toBe("healthy");

    // Worker-app should load
    const appResponse = await page.goto(WORKER_APP);
    expect(appResponse).not.toBeNull();
    expect(appResponse!.status()).toBeLessThan(400);
    // SPA may redirect to /login or show login content
    try {
      await page.waitForURL("**/login", { timeout: 5_000 });
    } catch {
      // Client-side redirect may not happen
    }
    const hasLoginUrl = page.url().includes("/login");
    const hasLoginContent = await page
      .getByRole("button", { name: "\ub85c\uadf8\uc778" })
      .isVisible()
      .catch(() => false);
    expect(hasLoginUrl || hasLoginContent).toBeTruthy();
  });

  test("API health matches admin-app availability @smoke", async ({
    request,
    page,
  }) => {
    // API should be healthy
    const apiResponse = await request.get(`${API_BASE}/health`);
    expect(apiResponse.status()).toBe(200);
    const body = await apiResponse.json();
    expect(body.status).toBe("healthy");

    // Admin-app should load
    const appResponse = await page.goto(ADMIN_APP);
    expect(appResponse).not.toBeNull();
    expect(appResponse!.status()).toBeLessThan(400);
    try {
      await page.waitForURL("**/login", { timeout: 5_000 });
    } catch {
      // Client-side redirect may not happen
    }
    const hasLoginUrl = page.url().includes("/login");
    const hasLoginContent = await page
      .getByRole("button", { name: "\ub85c\uadf8\uc778" })
      .isVisible()
      .catch(() => false);
    expect(hasLoginUrl || hasLoginContent).toBeTruthy();
  });

  test("CORS allows worker-app origin @smoke", async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://safework2.jclee.me",
        "Access-Control-Request-Method": "GET",
      },
    });

    const headers = response.headers();
    const allowOrigin = headers["access-control-allow-origin"] ?? "";
    expect(
      allowOrigin === "https://safework2.jclee.me" || allowOrigin === "*",
    ).toBeTruthy();
  });

  test("CORS allows admin-app origin @smoke", async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://admin.safework2.jclee.me",
        "Access-Control-Request-Method": "GET",
      },
    });

    const headers = response.headers();
    const allowOrigin = headers["access-control-allow-origin"] ?? "";
    expect(
      allowOrigin === "https://admin.safework2.jclee.me" || allowOrigin === "*",
    ).toBeTruthy();
  });

  test("all three services respond within acceptable time @smoke", async ({
    request,
  }) => {
    const start = Date.now();

    const [apiRes, workerRes, adminRes] = await Promise.all([
      request.get(`${API_BASE}/health`),
      request.get(WORKER_APP, { maxRedirects: 5 }),
      request.get(ADMIN_APP, { maxRedirects: 5 }),
    ]);

    const elapsed = Date.now() - start;

    // All should respond within 10 seconds
    expect(elapsed).toBeLessThan(10_000);

    // API returns 200
    expect(apiRes.status()).toBe(200);

    // Apps return 200 (after redirects) or 302
    expect(workerRes.status()).toBeLessThan(400);
    expect(adminRes.status()).toBeLessThan(400);
  });
});
