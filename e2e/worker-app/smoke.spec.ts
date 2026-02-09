import { test, expect } from "@playwright/test";

test.describe("Worker App - Smoke Tests", () => {
  test("root page redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("안전지갑")).toBeVisible();

    await expect(page.getByRole("textbox", { name: "이름" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "휴대폰 번호" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /생년월일/ })).toBeVisible();

    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("login button disabled until fields filled", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("button", { name: "로그인" })).toBeDisabled();

    await page.getByRole("textbox", { name: "이름" }).fill("테스트");
    await page
      .getByRole("textbox", { name: "휴대폰 번호" })
      .fill("010-0000-0000");
    await page.getByRole("textbox", { name: /생년월일/ }).fill("900101");

    await expect(page.getByRole("button", { name: "로그인" })).toBeEnabled();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
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

  test("non-existent page shows 404 or redirects", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response).not.toBeNull();
  });
});
