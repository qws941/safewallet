interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter implements DurableObject {
  private requestLog: number[] = [];

  constructor(
    private state: DurableObjectState,
    _env: unknown,
  ) {}

  async checkLimit(config: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    this.requestLog = this.requestLog.filter((t: number) => t > windowStart);

    if (this.requestLog.length >= config.maxRequests) {
      const oldestRequest = this.requestLog[0] || now;
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestRequest + config.windowMs,
      };
    }

    this.requestLog.push(now);

    return {
      allowed: true,
      remaining: config.maxRequests - this.requestLog.length,
      resetAt: now + config.windowMs,
    };
  }

  reset(): void {
    this.requestLog = [];
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/check") {
      const config: RateLimitConfig = await request.json();
      const result = await this.checkLimit(config);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/reset") {
      this.reset();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
