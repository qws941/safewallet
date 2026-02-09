import { test, expect } from "@playwright/test";

test.describe("Admin App - Smoke Tests", () => {
  test("root page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("안전지갑 관리자")).toBeVisible();

    const usernameInput = page.getByPlaceholder("admin");
    const passwordInput = page.getByPlaceholder("••••••••");
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("admin").fill("wronguser");
    await page.getByPlaceholder("••••••••").fill("wrongpass");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.locator(".text-destructive").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});
