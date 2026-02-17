import { test, expect } from "@playwright/test";

test.describe("Worker App - Register Page @smoke", () => {
  test("register page renders with correct form fields", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
    await expect(page.getByText("회원가입").last()).toBeVisible();

    await expect(page.getByLabel("이름")).toBeVisible();
    await expect(page.getByLabel("휴대폰 번호")).toBeVisible();
    await expect(page.getByLabel("생년월일")).toBeVisible();

    await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();

    await expect(page.getByRole("link", { name: "로그인" })).toHaveAttribute(
      "href",
      "/login/",
    );
  });

  test("submit button is disabled until all fields are filled", async ({
    page,
  }) => {
    await page.goto("/register");

    const submitButton = page.getByRole("button", { name: "회원가입" });
    await expect(submitButton).toBeDisabled();

    await page.getByLabel("이름").fill("테스트");
    await expect(submitButton).toBeDisabled();

    await page.getByLabel("휴대폰 번호").fill("01012345678");
    await expect(submitButton).toBeDisabled();

    await page.getByLabel("생년월일").fill("19900101");
    await expect(submitButton).toBeEnabled();
  });

  test("login page has register link", async ({ page }) => {
    await page.goto("/login");

    const registerLink = page.getByRole("link", { name: "회원가입" }).first();
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute("href", /\/register/);
  });
});
