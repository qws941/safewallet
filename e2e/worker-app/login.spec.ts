import { test, expect } from "@playwright/test";

test.describe("Login - Page Rendering @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays card title and description", async ({ page }) => {
    await expect(page.getByText("안전지갑")).toBeVisible();
    await expect(
      page.getByText("휴대폰, 이름, 생년월일로 로그인"),
    ).toBeVisible();
  });

  test("renders all three input fields", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: "이름" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "휴대폰 번호" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /생년월일/ })).toBeVisible();
  });

  test("renders login button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("renders register link pointing to /register", async ({ page }) => {
    const registerLink = page.getByRole("link", { name: "회원가입" });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", /\/register/);
  });
});

test.describe("Login - Input Attributes @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("phone number input has tel type and inputMode for numeric keyboard", async ({
    page,
  }) => {
    const phoneInput = page.getByRole("textbox", { name: "휴대폰 번호" });
    await expect(phoneInput).toHaveAttribute("type", "tel");
    await expect(phoneInput).toHaveAttribute("inputmode", "tel");
    await phoneInput.fill("01012345678");
    await expect(phoneInput).toHaveValue("01012345678");
  });

  test("DOB input has numeric inputMode for digit entry", async ({ page }) => {
    const dobInput = page.getByRole("textbox", { name: /생년월일/ });
    await expect(dobInput).toHaveAttribute("inputmode", "numeric");
    await dobInput.fill("19900101");
    await expect(dobInput).toHaveValue("19900101");
  });
});

test.describe("Login - Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login button disabled when all fields empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("login button disabled when name is empty", async ({ page }) => {
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("01012345678");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("login button disabled when phone is empty", async ({ page }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("홍길동");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("login button disabled when DOB is empty", async ({ page }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("홍길동");
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("01012345678");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();
  });

  test("login button enabled when all fields filled", async ({ page }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("테스트");
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("01012345678");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await expect(page.getByRole("button", { name: "로그인" })).toBeEnabled();
  });
});

test.describe("Login - Form Submission", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("Enter key submits the form", async ({ page }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("테스트");
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("01000000000");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await page.getByRole("textbox", { name: /생년월일/ }).press("Enter");

    const submitted = await Promise.race([
      page
        .locator(".text-destructive")
        .first()
        .waitFor({ timeout: 10_000 })
        .then(() => true),
      page
        .getByRole("button", { name: /확인 중/ })
        .waitFor({ timeout: 10_000 })
        .then(() => true),
    ]);
    expect(submitted).toBe(true);
  });

  test("button click submits the form", async ({ page }) => {
    await page.getByRole("textbox", { name: "이름" }).fill("테스트");
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("01000000000");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await page.getByRole("button", { name: "로그인" }).click();

    const submitted = await Promise.race([
      page
        .locator(".text-destructive")
        .first()
        .waitFor({ timeout: 10_000 })
        .then(() => true),
      page
        .getByRole("button", { name: /확인 중/ })
        .waitFor({ timeout: 10_000 })
        .then(() => true),
    ]);
    expect(submitted).toBe(true);
  });
});

test.describe("Login - Error Handling", () => {
  test("invalid credentials show error message", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("textbox", { name: "이름" }).fill("테스트");
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("010-0000-0000");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.locator(".text-destructive").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Login - Auth Redirect", () => {
  test("root / redirects to /login when unauthenticated @smoke", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/login**", {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Login - Protected Routes", () => {
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

test.describe("Login - Responsive Design", () => {
  test("renders properly at mobile viewport (375x667)", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: "이름" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "휴대폰 번호" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /생년월일/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
    await expect(page.getByText("안전지갑")).toBeVisible();

    await context.close();
  });

  test("renders properly at tablet viewport (768x1024)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: "이름" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "휴대폰 번호" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /생년월일/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();

    await context.close();
  });

  test("all interactive elements are functional at mobile size", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await page.goto("/login");

    const nameInput = page.getByRole("textbox", { name: "이름" });
    const phoneInput = page.getByRole("textbox", { name: "휴대폰 번호" });
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

test.describe("Login - PWA & Meta Tags @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("page has proper meta viewport tag", async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute("content", /width=device-width/);
    await expect(viewport).toHaveAttribute("content", /initial-scale=1/);
  });

  test("page has manifest.json link", async ({ page }) => {
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute("href", /manifest\.json/);
  });

  test("page title contains 안전지갑", async ({ page }) => {
    await expect(page).toHaveTitle(/안전지갑/);
  });
});

test.describe("Login - Console & Asset Integrity @smoke", () => {
  test("page loads without critical console errors", async ({ page }) => {
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

  test("CSS stylesheets load successfully", async ({ page }) => {
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

  test("JavaScript bundles load successfully", async ({ page }) => {
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
