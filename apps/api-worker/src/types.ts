export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  STATIC: R2Bucket;
  KV: KVNamespace;
  JWT_SECRET: string;
  HMAC_SECRET: string;
  ENCRYPTION_KEY: string;
  REQUIRE_ATTENDANCE_FOR_LOGIN: string;
  REQUIRE_ATTENDANCE_FOR_POST: string;
  ENVIRONMENT: string;
  RATE_LIMITER?: DurableObjectNamespace;
  SMS_API_KEY?: string;
  SMS_API_SECRET?: string;
  SMS_SENDER?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
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
