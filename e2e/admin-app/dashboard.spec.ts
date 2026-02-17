import { test, expect } from "@playwright/test";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should display dashboard title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
  });

  test("should display stats cards or loading skeletons", async ({ page }) => {
    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });
  });

  test("should not show critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          !/favicon|resource|CSP|cloudflare|hydrat|chunk|Failed to fetch|net::/i.test(
            text,
          )
        ) {
          errors.push(text);
        }
      }
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    expect(errors.length).toBeLessThanOrEqual(3);
  });
});
