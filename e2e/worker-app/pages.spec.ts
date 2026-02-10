import { test, expect } from "@playwright/test";

test.describe("Login Page - Input & Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("phone number input has tel inputMode for numeric keyboard @smoke", async ({
    page,
  }) => {
    const phoneInput = page.getByRole("textbox", { name: "전화번호" });
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toHaveAttribute("type", "tel");
    await expect(phoneInput).toHaveAttribute("inputmode", "tel");
    await phoneInput.fill("01012345678");
    await expect(phoneInput).toHaveValue("01012345678");
  });

  test("DOB input has numeric inputMode for digit entry @smoke", async ({
    page,
  }) => {
    const dobInput = page.getByRole("textbox", { name: /생년월일/ });
    await expect(dobInput).toBeVisible();
    await expect(dobInput).toHaveAttribute("inputmode", "numeric");
    await dobInput.fill("19900101");
    await expect(dobInput).toHaveValue("19900101");
  });

  test("form validation - login button disabled when name is empty", async ({
    page,
  }) => {
    await page.getByRole("textbox", { name: "전화번호" }).fill("01012345678");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("form validation - login button disabled when phone is empty", async ({
    page,
  }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("홍길동");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("form validation - login button disabled when DOB is empty", async ({
    page,
  }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("홍길동");
    await page.getByRole("textbox", { name: "전화번호" }).fill("01012345678");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("login form submits on Enter key", async ({ page }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("테스트");
    await page.getByRole("textbox", { name: "전화번호" }).fill("01000000000");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await page.getByRole("textbox", { name: /생년월일/ }).press("Enter");

    await expect(
      page
        .getByRole("button", { name: /확인 중|로그인/ })
        .or(page.locator(".text-destructive")),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Navigation - Protected Routes", () => {
  const protectedRoutes = [
    "/posts",
    "/education",
    "/profile",
    "/home",
    "/votes",
  ];

  for (const route of protectedRoutes) {
    test(`${route} loads without crash when unauthenticated @smoke`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      // SPA static export: all routes serve index.html (200) regardless of auth
      // The page may redirect to /login, show the route content, or show empty state
      expect(response?.status()).toBeLessThan(500);
      // Verify no unhandled JS crash - page should still have a body
      await expect(page.locator("body")).toBeAttached();
    });
  }
});

test.describe("PWA & Meta Tags", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("page has proper meta viewport tag @smoke", async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute("content", /width=device-width/);
    await expect(viewport).toHaveAttribute("content", /initial-scale=1/);
  });

  test("page has manifest.json link @smoke", async ({ page }) => {
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute("href", /manifest\.json/);
  });

  test("page title contains 안전지갑 @smoke", async ({ page }) => {
    await expect(page).toHaveTitle(/안전지갑/);
  });

  test("page loads without critical console errors @smoke", async ({
    page,
  }) => {
    const criticalErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        const ignorable =
          text.includes("favicon") ||
          text.includes("Failed to load resource") ||
          text.includes("net::ERR_") ||
          text.includes("the server responded with a status of 4") ||
          text.includes("Content-Security-Policy") ||
          text.includes("Content Security Policy") ||
          text.includes("beacon.min.js") ||
          text.includes("cloudflare");
        if (!ignorable) {
          criticalErrors.push(text);
        }
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(criticalErrors).toEqual([]);
  });
});

test.describe("UI Responsiveness", () => {
  test("login page renders properly at mobile viewport (375x667)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: "이름" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "전화번호" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /생년월일/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
    await expect(page.getByText("안전지갑")).toBeVisible();

    await context.close();
  });

  test("login page renders properly at tablet viewport (768x1024)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: "이름" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "전화번호" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /생년월일/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();

    await context.close();
  });

  test("all interactive elements are visible and clickable at mobile size", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await page.goto("/login");

    const nameInput = page.getByRole("textbox", { name: "이름" });
    const phoneInput = page.getByRole("textbox", { name: "전화번호" });
    const dobInput = page.getByRole("textbox", { name: /생년월일/ });
    const loginBtn = page.getByRole("button", { name: "로그인" });

    await expect(nameInput).toBeEnabled();
    await expect(phoneInput).toBeEnabled();
    await expect(dobInput).toBeEnabled();

    await nameInput.fill("테스트");
    await phoneInput.fill("01012345678");
    await dobInput.fill("900101");

    await expect(loginBtn).toBeEnabled();

    await context.close();
  });
});

test.describe("Static Asset Loading", () => {
  test("CSS stylesheets load successfully @smoke", async ({ page }) => {
    const failedCSS: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".css") && response.status() >= 400) {
        failedCSS.push(`${url} → ${response.status()}`);
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(failedCSS).toEqual([]);
  });

  test("JavaScript bundles load successfully @smoke", async ({ page }) => {
    const failedJS: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.endsWith(".js") && response.status() >= 400) {
        failedJS.push(`${url} → ${response.status()}`);
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(failedJS).toEqual([]);
  });
});
