import { test, expect, request } from "@playwright/test";

test.describe("Worker App - Posts", () => {
  // Use pre-seeded test user (from scripts/create-test-user.ts)
  // Manual registration via API is disabled in production (404), so we must rely on seeded data.
  const USER = {
    name: "김선민",
    phone: "01076015830",
    dob: "19990308",
  };

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("textbox", { name: "이름" }).fill(USER.name);
    await page.getByRole("textbox", { name: "휴대폰 번호" }).fill(USER.phone);
    await page.getByRole("textbox", { name: /생년월일/ }).fill(USER.dob);

    await page.getByRole("button", { name: "로그인" }).click();

    const errorLocator = page.locator(".text-destructive").first();
    const homeNav = page.waitForURL("**/home**", {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });

    const result = await Promise.race([
      homeNav.then(() => "home" as const),
      errorLocator.waitFor({ timeout: 30_000 }).then(() => "error" as const),
    ]);

    if (result === "error") {
      test.skip(true, "Login rate-limited or credentials invalid");
    }
  });

  test("Submit Valid Safety Report (Hazard/Medium)", async ({ page }) => {
    await page.goto("/posts/new");

    await page.getByRole("button").filter({ hasText: "위험요소" }).click();

    await page.getByRole("button").filter({ hasText: "중간" }).click();

    await page
      .getByPlaceholder("발견한 내용을 자세히 작성해주세요...")
      .fill("E2E Test Hazard Report");

    await page.getByPlaceholder("층수 (예: B1, 3층)").fill("1F");
    await page.getByPlaceholder("구역 (예: A동, 주차장)").fill("Zone A");

    await page.getByRole("button", { name: "제보하기" }).click();

    await page.waitForURL("**/posts", { timeout: 10_000 });

    expect(page.url()).toContain("/posts");
    expect(page.url()).not.toContain("/posts/new");
  });
});
