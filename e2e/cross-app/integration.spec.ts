import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL ?? "https://safewallet.jclee.me/api";
const WORKER_APP = process.env.WORKER_APP_URL ?? "https://safewallet.jclee.me";
const ADMIN_APP =
  process.env.ADMIN_APP_URL ?? "https://safewallet.jclee.me/admin";
const ADMIN_ORIGIN = new URL(ADMIN_APP).origin;

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
    const hasLoadingContent = await page
      .getByText("\ub85c\ub529 \uc911...")
      .isVisible()
      .catch(() => false);
    expect(hasLoginUrl || hasLoginContent || hasLoadingContent).toBeTruthy();
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
  });

  test("CORS allows worker-app origin @smoke", async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://safewallet.jclee.me",
        "Access-Control-Request-Method": "GET",
      },
    });

    const headers = response.headers();
    const allowOrigin = headers["access-control-allow-origin"] ?? "";
    expect(
      allowOrigin === "https://safewallet.jclee.me" || allowOrigin === "*",
    ).toBeTruthy();
  });

  test("CORS allows admin-app origin @smoke", async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: ADMIN_ORIGIN,
        "Access-Control-Request-Method": "GET",
      },
    });

    const headers = response.headers();
    const allowOrigin = headers["access-control-allow-origin"] ?? "";
    expect(allowOrigin === ADMIN_ORIGIN || allowOrigin === "*").toBeTruthy();
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

    // All should respond within 30 seconds (cold start tolerance for CF Workers)
    expect(elapsed).toBeLessThan(30_000);

    // API returns 200
    expect(apiRes.status()).toBe(200);

    expect(workerRes.status()).toBeLessThan(500);
    expect(adminRes.status()).toBeLessThan(500);
  });
});
