import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

export const securityHeaders = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    await next();

    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; connect-src 'self' https:; frame-ancestors 'none'",
    );
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  },
);
