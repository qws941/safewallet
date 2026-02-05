import * as jose from "jose";

export interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  loginDate: string;
}

export async function signJwt(
  payload: Omit<JwtPayload, "loginDate">,
  secret: string,
  expiresIn: string = "24h",
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const now = new Date();
  const koreaDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const loginDate = koreaDate.toISOString().split("T")[0];

  return await new jose.SignJWT({ ...payload, loginDate })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function checkSameDay(loginDate: string): boolean {
  const now = new Date();
  const koreaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const currentDate = koreaTime.toISOString().split("T")[0];
  return loginDate === currentDate;
}
