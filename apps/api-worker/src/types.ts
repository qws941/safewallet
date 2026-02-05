export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  JWT_SECRET: string;
  HMAC_SECRET: string;
  ENCRYPTION_KEY: string;
  REQUIRE_ATTENDANCE_FOR_LOGIN: string;
  ENVIRONMENT: string;
  RATE_LIMITER?: DurableObjectNamespace;
}

export interface User {
  id: string;
  phone: string;
  role: string;
  name: string;
  nameMasked: string;
}

export interface AuthContext {
  user: User;
  loginDate: string;
}
