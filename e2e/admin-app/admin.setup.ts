import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth", "admin.json");

setup("authenticate as admin", async ({ page }) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto("/login", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.getByPlaceholder("admin").fill("admin");
      await page.getByPlaceholder("••••••••").fill("admin123");

      await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/auth/admin/login") && resp.status() === 200,
          { timeout: 30000 },
        ),
        page.getByRole("button", { name: "로그인" }).click(),
      ]);

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
      await page.context().storageState({ path: authFile });
      return;
    } catch {
      if (attempt < 2) {
        await page.waitForTimeout(15000);
      }
    }
  }
  throw new Error("Failed to authenticate as admin after 3 attempts");
});
