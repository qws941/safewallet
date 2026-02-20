import { test, expect } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Admin Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("should render login form with correct elements", async ({ page }) => {
    await expect(page.getByText("안전지갑 관리자")).toBeVisible();
    await expect(page.getByPlaceholder("admin")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("should accept input in username and password fields", async ({
    page,
  }) => {
    const username = page.getByPlaceholder("admin");
    const password = page.getByPlaceholder("••••••••");
    await username.fill("testuser");
    await password.fill("testpass");
    await expect(username).toHaveValue("testuser");
    await expect(password).toHaveValue("testpass");
  });

  test("should mask password input", async ({ page }) => {
    const password = page.getByPlaceholder("••••••••");
    await expect(password).toHaveAttribute("type", "password");
  });

  test("login button becomes enabled after filling inputs", async ({
    page,
  }) => {
    await page.getByPlaceholder("admin").fill("testuser");
    await page.getByPlaceholder("••••••••").fill("testpass");
    const loginBtn = page.getByRole("button", { name: "로그인" });
    await expect(loginBtn).toBeEnabled();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.getByPlaceholder("admin").fill("wronguser");
    await page.getByPlaceholder("••••••••").fill("wrongpass");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should stay on login page for empty submission", async ({ page }) => {
    await page.getByRole("button", { name: "로그인" }).click({ force: true });
    await expect(page).toHaveURL(/\/login/);
  });

  test("should submit via Enter key", async ({ page }) => {
    await page.getByPlaceholder("admin").fill("wronguser");
    await page.getByPlaceholder("••••••••").fill("wrongpass");
    await page.getByPlaceholder("••••••••").press("Enter");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect to dashboard on successful login @smoke", async ({
    page,
  }) => {
    await page.getByPlaceholder("admin").fill(ADMIN_USERNAME);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
