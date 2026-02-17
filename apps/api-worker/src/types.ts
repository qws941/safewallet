// Hyperdrive binding type for external database connections
export interface HyperdriveBinding {
  connectionString: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// Analytics Engine binding for observability metrics
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }): void;
}

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
  FAS_API_KEY?: string;
  // AceTime FAS MariaDB via Hyperdrive
  FAS_HYPERDRIVE?: HyperdriveBinding;
  FAS_COMPANY_ID?: string;
  FAS_SYNC_SECRET?: string;
  // AceTime R2 bucket for photos + DB
  ACETIME_BUCKET?: R2Bucket;
  // Admin credentials
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  // Analytics Engine for observability
  ANALYTICS?: AnalyticsEngineDataset;
  ELASTICSEARCH_URL?: string;
  ALERT_WEBHOOK_URL?: string;
  NOTIFICATION_QUEUE?: Queue;
  AI?: Ai;
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
