import { test, expect } from "@playwright/test";

test.describe("API - Smoke Tests", () => {
  test("health endpoint returns healthy", async ({ request }) => {
    const response = await request.get("./health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.timestamp).toBeTruthy();
  });

  test("auth login rejects invalid credentials", async ({ request }) => {
    const response = await request.post("./auth/login", {
      data: {
        phone: "000-0000-0000",
        name: "테스트",
        dob: "1990-01-01",
      },
    });
    expect(response.ok()).toBeFalsy();

    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("protected endpoint rejects unauthenticated request", async ({
    request,
  }) => {
    const response = await request.get("./users/me");
    expect(response.status()).toBe(401);
  });

  test("CORS headers present on preflight", async ({ request }) => {
    const response = await request.fetch("./health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://safewallet.jclee.me",
        "Access-Control-Request-Method": "GET",
      },
    });
    const headers = response.headers();
    expect(
      headers["access-control-allow-origin"] ||
        headers["access-control-allow-methods"],
    ).toBeTruthy();
  });

  test("unknown route returns 404", async ({ request }) => {
    const response = await request.get("./this-route-does-not-exist");
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
