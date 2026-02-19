# API MIDDLEWARE

## OVERVIEW

8 middleware functions for auth, authorization, attendance verification, rate limiting, security headers, analytics, and request logging. All middleware uses **manual invocation pattern** (NOT Hono `.use()`) except `security-headers.ts`, `analytics.ts`, and `request-logger.ts` which use global `.use()`.

## FILES

| File                  | Lines | Purpose                                               |
| --------------------- | ----- | ----------------------------------------------------- |
| `permission.ts`       | 206   | RBAC: role-based and field-based access control       |
| `analytics.ts`        | 161   | Analytics Engine metrics tracking (HTTP + events)     |
| `rate-limit.ts`       | 131   | Durable Objects rate limiter (100 req/60s default)    |
| `attendance.ts`       | 122   | Site membership + daily attendance check              |
| `auth.ts`             | 89    | JWT Bearer token verification, sets `c.auth`          |
| `request-logger.ts`   | 46    | Structured request/response logging (global `.use()`) |
| `fas-auth.ts`         | 25    | FAS API key authentication (`X-FAS-API-Key` header)   |
| `security-headers.ts` | 21    | CSP, HSTS, X-Frame-Options, Referrer-Policy           |

## KEY PATTERNS

### Auth Middleware (`auth.ts`)

```typescript
// Verifies JWT, checks same-day via loginDate (NOT standard exp)
// Sets c.auth = { user: { id, phone, role, name, nameMasked }, loginDate }
// Korean error messages: "인증 토큰이 필요합니다", "만료된 세션입니다"
```

### Permission Middleware (`permission.ts`)

```typescript
// Role-based: SUPER_ADMIN bypasses all role checks
requireRole("ADMIN", "MANAGER");
requireAdmin; // shortcut for requireRole('ADMIN', 'SUPER_ADMIN')
requireManagerOrAdmin; // shortcut for requireRole('ADMIN', 'MANAGER', 'SUPER_ADMIN')
requireExportAccess; // checks canExportData permission field

// Field-based: checks siteMemberships permission columns
requirePermission("piiViewFull");
requirePermission("canAwardPoints");
requirePermission("canManageUsers");
requirePermission("canReview");
requirePermission("canExportData");
```

### Attendance Middleware (`attendance.ts`)

Checks site membership → daily attendance → manual approval override. Optional `siteId` param. In-memory idempotency cache (1-hour TTL).

### Rate Limiter (`rate-limit.ts`)

Uses `RATE_LIMITER` DO binding. Falls back to pass-through if DO unconfigured. Options: `maxRequests` (100), `windowMs` (60000), `keyGenerator`.

### Analytics Middleware (`analytics.ts`)

Global `app.use("*", analyticsMiddleware)` — tracks HTTP requests + custom business events via CF Analytics Engine. `writeDataPoint()` is **non-blocking** (never await). Use `trackEvent(c, eventName, data)` for custom events.

## ANTI-PATTERNS

- **Never use `.use()` for per-route middleware** — only manual invocation
- **Never skip auth middleware** — all authenticated routes must verify JWT
- **Never hardcode roles** — use `requireRole()` / `requirePermission()`
- **Never assume DO binding exists** — rate limiter must handle missing binding gracefully
- **Never await Analytics Engine writeDataPoint()** — it's non-blocking by design
