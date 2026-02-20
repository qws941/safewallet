import { defineConfig, devices } from "@playwright/test";

// Production URLs as defaults — CI and local both hit production
// Override with env vars for staging/local dev:
//   WORKER_APP_URL=http://localhost:3000 ADMIN_APP_URL=http://localhost:3001 API_URL=http://localhost:8787 npx playwright test
const WORKER_APP_URL =
  process.env.WORKER_APP_URL ?? "https://safewallet.jclee.me";
const ADMIN_APP_URL =
  process.env.ADMIN_APP_URL ?? "https://admin.safewallet.jclee.me";
const rawApiUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "https://safewallet.jclee.me/api";
const API_URL = rawApiUrl.endsWith("/") ? rawApiUrl : `${rawApiUrl}/`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "api",
      testDir: "./e2e/api",
      use: {
        baseURL: API_URL,
      },
    },
    {
      name: "admin-setup",
      testDir: "./e2e/admin-app",
      testMatch: /admin\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_APP_URL,
      },
    },
    {
      name: "worker-app",
      testDir: "./e2e/worker-app",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WORKER_APP_URL,
      },
    },
    {
      name: "admin-app",
      testDir: "./e2e/admin-app",
      testIgnore: /admin\.setup\.ts/,
      dependencies: ["admin-setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_APP_URL,
        storageState: "e2e/admin-app/.auth/admin.json",
      },
    },
    {
      name: "cross-app",
      testDir: "./e2e/cross-app",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WORKER_APP_URL,
      },
    },
  ],
});
