import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyJwt, checkSameDay } from "../lib/jwt";
import type { Env, AuthContext } from "../types";

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

  c.set("auth", {
    user: {
      id: payload.sub,
      phone: payload.phone,
      role: payload.role,
      name: "",
      nameMasked: "",
    },
    loginDate: payload.loginDate,
  });

  await next();
}
