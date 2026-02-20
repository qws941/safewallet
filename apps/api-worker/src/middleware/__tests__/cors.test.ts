import { describe, expect, it } from "vitest";
import { app } from "../../index";

const productionEnv = {
  ALLOWED_ORIGINS:
    "https://safewallet.jclee.me,https://admin.safewallet.jclee.me",
};

describe("CORS configuration", () => {
  it("allows configured production origins", async () => {
    const origin = "https://safewallet.jclee.me";
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      productionEnv,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("allows admin subdomain origin", async () => {
    const origin = "https://admin.safewallet.jclee.me";
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      productionEnv,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("allows localhost origins for development", async () => {
    const origin = "http://localhost:3000";
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
        },
      },
      productionEnv,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("rejects untrusted origins", async () => {
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "GET",
        },
      },
      productionEnv,
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("supports comma-separated ALLOWED_ORIGINS", async () => {
    const multiOriginEnv = {
      ALLOWED_ORIGINS:
        "https://safewallet.jclee.me,https://staging.safewallet.jclee.me",
    };
    const origin = "https://staging.safewallet.jclee.me";
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PATCH",
        },
      },
      multiOriginEnv,
    );

    const methods = res.headers.get("Access-Control-Allow-Methods") ?? "";
    const headers = res.headers.get("Access-Control-Allow-Headers") ?? "";

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(methods).toContain("PATCH");
    expect(headers).toContain("Authorization");
    expect(headers).toContain("Device-Id");
  });
});
