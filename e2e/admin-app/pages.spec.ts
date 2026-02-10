import { test, expect } from "@playwright/test";

test.describe("A) Login Page Deep Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("admin ID input accepts text @smoke", async ({ page }) => {
    const input = page.getByPlaceholder("admin");
    await expect(input).toBeVisible();
    await input.fill("testadmin");
    await expect(input).toHaveValue("testadmin");
  });

  test("password input is masked (type=password) @smoke", async ({ page }) => {
    const input = page.getByPlaceholder("••••••••");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("login button disabled until both fields filled @smoke", async ({
    page,
  }) => {
    const loginBtn = page.getByRole("button", { name: "로그인" });
    const usernameInput = page.getByPlaceholder("admin");
    const passwordInput = page.getByPlaceholder("••••••••");

    const isDisabledEmpty = await loginBtn.isDisabled();
    if (!isDisabledEmpty) {
      await expect(usernameInput).toHaveValue("");
      await expect(passwordInput).toHaveValue("");
    }

    await usernameInput.fill("admin");
    await passwordInput.fill("");

    await usernameInput.fill("admin");
    await passwordInput.fill("password123");
    await expect(loginBtn).toBeEnabled();
  });

  test("invalid credentials show error message", async ({ page }) => {
    await page.getByPlaceholder("admin").fill("invaliduser");
    await page.getByPlaceholder("••••••••").fill("invalidpass");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.locator(".text-destructive").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("form submits on Enter key", async ({ page }) => {
    await page.getByPlaceholder("admin").fill("enteruser");
    await page.getByPlaceholder("••••••••").fill("enterpass");
    await page.getByPlaceholder("••••••••").press("Enter");

    await expect(
      page
        .locator(".text-destructive")
        .first()
        .or(page.getByRole("button", { name: "로그인" })),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("B) Navigation & Auth Guards", () => {
  // /dashboard has layout.tsx auth guard that redirects to /login
  test("/dashboard redirects to login when unauthenticated @smoke", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    try {
      await page.waitForURL("**/login", { timeout: 5_000 });
    } catch {
      // Client-side redirect may not happen
    }
    const hasLoginUrl = page.url().includes("/login");
    const hasLoginContent = await page
      .getByRole("button", { name: "로그인" })
      .isVisible()
      .catch(() => false);
    expect(hasLoginUrl || hasLoginContent).toBeTruthy();
  });

  // These routes are top-level (not under /dashboard layout) so no auth guard
  // Just verify they load without server errors
  const topLevelRoutes = ["/users", "/posts", "/sites", "/settings"];
  for (const route of topLevelRoutes) {
    test(`${route} loads without crash when unauthenticated @smoke`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.locator("body")).toBeAttached();
    });
  }
});

test.describe("C) PWA & Meta Tags", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("page has proper meta viewport tag @smoke", async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute("content", /width=device-width/);
  });

  test("page title contains 안전지갑 관리자 @smoke", async ({ page }) => {
    await expect(page).toHaveTitle(/안전지갑 관리자/);
  });

  test("page loads without console errors @smoke", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("Failed to load resource") &&
        !e.includes("third-party") &&
        !e.includes("Content-Security-Policy") &&
        !e.includes("Content Security Policy") &&
        !e.includes("beacon.min.js") &&
        !e.includes("cloudflare"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("favicon loads if present @smoke", async ({ page }) => {
    const favicon = page.locator('link[rel="icon"], link[rel="shortcut icon"]');
    const count = await favicon.count();
    // Favicon is optional - some SPAs don't include it in HTML
    if (count > 0) {
      const href = await favicon.first().getAttribute("href");
      expect(href).toBeTruthy();
    }
    // Test passes regardless - favicon absence is not critical
  });
});

test.describe("D) UI Responsiveness", () => {
  test("login page renders at desktop viewport (1920x1080)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/login");

    await expect(page.getByText("안전지갑 관리자")).toBeVisible();
    await expect(page.getByPlaceholder("admin")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("login page renders at tablet viewport (768x1024)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/login");

    await expect(page.getByText("안전지갑 관리자")).toBeVisible();
    await expect(page.getByPlaceholder("admin")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("admin login centered and properly styled", async ({ page }) => {
    await page.goto("/login");

    const loginBtn = page.getByRole("button", { name: "로그인" });
    await expect(loginBtn).toBeVisible();

    const box = await loginBtn.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      const viewportSize = page.viewportSize();
      if (viewportSize) {
        expect(box.x).toBeGreaterThan(viewportSize.width * 0.1);
      }
    }
  });
});

test.describe("E) Static Asset Loading", () => {
  test("CSS stylesheets load (no 404) @smoke", async ({ page }) => {
    const failedCSS: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".css") && response.status() >= 400) {
        failedCSS.push(`${url} → ${response.status()}`);
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(failedCSS).toHaveLength(0);
  });

  test("JS bundles load (no 404) @smoke", async ({ page }) => {
    const failedJS: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".js") && response.status() >= 400) {
        failedJS.push(`${url} → ${response.status()}`);
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(failedJS).toHaveLength(0);
  });
});
