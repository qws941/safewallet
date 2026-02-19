# Audit Remediation Plan

**Generated:** 2026-02-19
**Branch:** master (a987d4b)
**Status:** TypeScript CLEAN, Build PASSING

---

## Verified Current State

### PASS (No Action Needed)

- Zero `as any` type casts
- Zero TODO/FIXME/HACK comments
- Zero browser dialogs (alert/confirm/prompt)
- Zero RSC violations — all worker-app .tsx files have `'use client'`
- Zero Promise.resolve() placeholder mocks
- Zero SQL injection risks — all Drizzle ORM parameterized queries
- TypeScript compiles clean across all 5 packages
- Response format compliance ~95% (success/error helpers)
- Security headers properly configured (CSP, HSTS, X-Frame-Options)
- CORS whitelist configured correctly
- .env files NOT in git (properly gitignored)

### FALSE ALARMS (Verified Safe)

- **localStorage usage** — `createJSONStorage(() => localStorage)` is the correct Zustand pattern; i18n locale, draft persistence, submission queue are legitimate PWA needs
- **`/fas-sync` secret auth** — internal CRON-triggered endpoint; secret-based auth is acceptable for machine-to-machine calls
- **Test hardcoded credentials** — test fixtures only, not production secrets

---

## Phase 1: Critical (Must Fix)

### 1.1 Plaintext Admin Password Fallback

- **File:** `apps/api-worker/src/routes/auth.ts:872-876`
- **Issue:** Dual path — uses `ADMIN_PASSWORD_HASH` (proper) OR falls back to `ADMIN_PASSWORD` (plaintext comparison)
- **Fix:** Remove plaintext fallback; require `ADMIN_PASSWORD_HASH` only
- **Risk:** LOW — only affects admin login, env var controlled

### 1.2 Empty Catch Blocks in CRON Jobs

- **File:** `apps/api-worker/src/scheduled/index.ts`
- **Lines:** 1189, 1206, 1231, 1289
- **Issue:** `.catch(() => {})` on webhook/alert sends — failures are silently swallowed
- **Fix:** Add structured logging via `logger.ts` for each catch
- **Risk:** LOW — these are non-critical alert webhook sends

### 1.3 Missing Input Validation on API Routes

| File                       | Endpoint                     | Issue                                             |
| -------------------------- | ---------------------------- | ------------------------------------------------- |
| `routes/approvals.ts:160`  | `POST /:id/reject`           | Reads `{ reason }` via `c.req.json()` without Zod |
| `routes/admin/users.ts:57` | `POST /unlock-user-by-phone` | Reads `{ phone }` with manual validation only     |
| `routes/education.ts:276`  | `DELETE /contents/:id`       | No ID format validation                           |

- **Fix:** Add `zValidator("json", Schema)` for each
- **Risk:** MEDIUM — unvalidated input on state-changing endpoints

---

## Phase 2: Warning (Should Fix)

### 2.1 Missing try-catch on DB Operations

| File                | Handler     | Lines                      |
| ------------------- | ----------- | -------------------------- |
| `routes/posts.ts`   | `POST /`    | 51-240                     |
| `routes/users.ts`   | `PATCH /me` | 106-150                    |
| `routes/actions.ts` | `POST /`    | 62-115                     |
| `routes/sites.ts`   | `GET /`     | parseInt without NaN check |

- **Fix:** Wrap DB operations in try-catch, return `error(c, "SERVER_ERROR", ...)` on failure

### 2.2 console.log/warn/error in Frontend Code

| File                              | Lines  | Usage                           |
| --------------------------------- | ------ | ------------------------------- |
| `worker-app/src/i18n/context.tsx` | 60     | `console.error`                 |
| `worker-app/src/i18n/loader.ts`   | 15, 25 | `console.warn`, `console.error` |

- **Fix:** Either remove or wrap in `if (process.env.NODE_ENV === 'development')` guard
- **Note:** `api-worker/src/lib/logger.ts:102` using console.log is CORRECT (it IS the structured logger)

### 2.3 Hardcoded URLs

| File                                             | URL              |
| ------------------------------------------------ | ---------------- |
| `admin-app/src/lib/api.ts:5`                     | Fallback API URL |
| `admin-app/src/stores/auth.ts:7`                 | API_BASE         |
| `admin-app/src/hooks/use-votes.ts:117`           | API URL          |
| `admin-app/src/hooks/use-recommendations.ts:104` | API URL          |
| `worker-app/src/lib/api.ts:5`                    | Fallback API URL |
| `worker-app/src/stores/auth.ts:52`               | Fallback API URL |
| `api-worker/src/routes/admin/users.ts:88`        | Dummy reset URL  |

- **Fix:** Ensure all use `process.env.NEXT_PUBLIC_API_URL` with fallback pattern (most already do)
- **Note:** CORS origins in `index.ts` are intentionally hardcoded (security policy)

### 2.4 Rate Limiting Gaps

- **Currently applied:** Auth routes only (5 req/60s)
- **Missing:** `/images/upload`, `/posts` POST, `/admin/*` routes
- **Fix:** Apply `authRateLimitMiddleware()` to sensitive mutation endpoints

### 2.5 eslint-disable Suppressions

| File                                        | Suppression                          |
| ------------------------------------------- | ------------------------------------ |
| `api-worker/src/lib/fas-mariadb.ts:11`      | `@typescript-eslint/no-explicit-any` |
| `worker-app/src/app/posts/new/page.tsx:125` | `react-hooks/exhaustive-deps`        |

- **Fix:** Resolve underlying type/dependency issues

---

## Phase 3: Minor (Optional Polish)

### 3.1 Response Format Consistency

- `index.ts:75` — `/health` uses raw `c.json()` instead of `success(c, ...)`
- `index.ts:289` — 404 handler uses raw `c.json()` instead of `error(c, ...)`

### 3.2 Logout catch(() => {}) in Auth Stores

- `worker-app/src/stores/auth.ts:57` — fire-and-forget logout POST
- `admin-app/src/stores/auth.ts:56` — same pattern
- **Verdict:** ACCEPTABLE — logout is best-effort; swallowing network errors here is standard

### 3.3 Minimal Catch Blocks in Utilities

- `api-worker/src/lib/fas-mariadb.ts:144` — `.catch(() => {})` on connection cleanup
- `api-worker/src/lib/web-push.ts:360` — `.catch(() => "")` on response parsing
- **Verdict:** LOW priority — these are cleanup/fallback operations

---

## Execution Order

```
1. [5 min]  auth.ts — Remove plaintext password fallback
2. [10 min] scheduled/index.ts — Add logging to 4 empty catch blocks
3. [15 min] approvals.ts, admin/users.ts, education.ts — Add Zod validators
4. [15 min] posts.ts, users.ts, actions.ts, sites.ts — Add try-catch blocks
5. [5 min]  i18n/context.tsx, i18n/loader.ts — Guard console statements
6. [5 min]  index.ts — Standardize /health and 404 response format
7. [10 min] Rate limiting — Apply to /images/upload and /posts
8. [5 min]  Verify — Run tsc --noEmit + build across all apps
```

**Estimated Total:** ~70 minutes
