import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { verifyJwt, checkSameDay } from "../lib/jwt";
import { users } from "../db/schema";
import type { Env, AuthContext } from "../types";
import { createLogger } from "../lib/logger";

const logger = createLogger("auth");

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next,
) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "인증이 필요합니다." });
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);

  if (!payload) {
    throw new HTTPException(401, { message: "유효하지 않은 토큰입니다." });
  }

  if (!checkSameDay(payload.loginDate)) {
    throw new HTTPException(401, {
      message: "자정이 지났습니다. 다시 로그인해주세요.",
    });
  }

  const db = drizzle(c.env.DB);
  const [user] = await db
    .select({ name: users.name, nameMasked: users.nameMasked })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  // MAJOR-3 FIX: Check if user exists; log if not found
  if (!user) {
    logger.warn("User record not found after successful JWT verification", {
      userId: payload.sub,
      phone: payload.phone,
    });
    throw new HTTPException(401, {
      message: "사용자 정보를 찾을 수 없습니다.",
    });
  }

  c.set("auth", {
    user: {
      id: payload.sub,
      phone: payload.phone,
      role: payload.role,
      name: user.name ?? "",
      nameMasked: user.nameMasked ?? "",
    },
    loginDate: payload.loginDate,
  });

  await next();
}
