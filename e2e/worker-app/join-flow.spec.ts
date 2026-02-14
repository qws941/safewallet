import { test, expect, type Page } from "@playwright/test";

test.describe("Login → Join Site Flow", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    // Block Cloudflare analytics beacon — fails with ERR_SSL_PROTOCOL_ERROR
    // in headless Chromium, causing spurious full-page reloads via Next.js error recovery
    await page.route("**/static.cloudflareinsights.com/**", (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("test user login redirects to /join with correct UI", async () => {
    await page.goto("/login");

    await page.getByRole("textbox", { name: "전화번호" }).fill("01012345678");
    await page.getByRole("textbox", { name: "이름" }).fill("테스트유저");
    await page.getByRole("textbox", { name: "생년월일" }).fill("19950101");

    await page.getByRole("button", { name: "로그인" }).click();

    await page.waitForURL(/\/join/, { timeout: 15000 });
    expect(page.url()).toContain("/join");

    // Wait for React hydration + Zustand rehydration from localStorage
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "현장 참여" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("참여 코드를 입력해주세요")).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "현장 참여하기" }),
    ).toBeVisible();
  });

  test("invalid join code shows error", async () => {
    await page.getByRole("textbox").fill("INVALID1");
    await page.getByRole("button", { name: "현장 참여하기" }).click();

    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 10000,
    });
  });
});
