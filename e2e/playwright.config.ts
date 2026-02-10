import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  projects: [
    {
      name: "api",
      testDir: "./api",
      use: {
        baseURL: "https://safework2.jclee.me/api/",
      },
    },
    {
      name: "worker-app",
      testDir: "./worker-app",
      use: {
        baseURL: "https://safework2.jclee.me",
        headless: true,
      },
    },
    {
      name: "admin-app",
      testDir: "./admin-app",
      use: {
        baseURL: "https://admin.safework2.jclee.me",
        headless: true,
      },
    },
    {
      name: "cross-app",
      testDir: "./cross-app",
      use: {
        headless: true,
      },
    },
  ],
});
