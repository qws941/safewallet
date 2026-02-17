import { describe, expect, it } from "vitest";
import { app } from "../../index";

describe("CORS configuration", () => {
  it("allows configured production origins", async () => {
    const origin = "https://safework2.jclee.me";
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      {},
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
      {},
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
      {},
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("exposes configured allow-methods and allow-headers", async () => {
    const origin = "https://admin.safework2.jclee.me";
    const res = await app.request(
      "http://localhost/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PATCH",
        },
      },
      {},
    );

    const methods = res.headers.get("Access-Control-Allow-Methods") ?? "";
    const headers = res.headers.get("Access-Control-Allow-Headers") ?? "";

    expect(methods).toContain("PATCH");
    expect(headers).toContain("Authorization");
    expect(headers).toContain("Device-Id");
  });
});
