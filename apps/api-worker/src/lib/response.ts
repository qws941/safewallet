import type { Context } from "hono";

export function success<T>(c: Context, data: T, status = 200) {
  return c.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    status as any,
  );
}

export function error(c: Context, code: string, message: string, status = 400) {
  return c.json(
    {
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString(),
    },
    status as any,
  );
}
