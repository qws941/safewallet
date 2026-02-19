# ADMIN ROUTES

## OVERVIEW

Admin-only API sub-routes mounted at `/admin`. 17 modules including index and shared helpers (3.8k LOC). All routes require authentication and admin role.

## STRUCTURE

```
admin/
├── index.ts             # Sub-router mounts + global auth middleware
├── helpers.ts           # Shared utilities, role guards, CSV export
├── users.ts             # User management, search, role updates
├── posts.ts             # Post management, review actions
├── export.ts            # CSV exports (users, posts, attendance)
├── stats.ts             # Dashboard statistics, counts
├── attendance.ts        # Attendance records, overrides
├── audit.ts             # Audit log queries
├── votes.ts             # Vote management, candidate CRUD
├── fas.ts               # FAS sync status, error handling
├── sync-errors.ts       # FAS sync error management
├── access-policies.ts   # Point policies, reward config
├── recommendations.ts   # Safety recommendations CRUD
├── monitoring.ts        # System monitoring endpoints
├── alerting.ts          # Alert configuration & webhooks
├── images.ts            # Image moderation, privacy review
└── trends.ts            # Trend analysis, statistics
```

## KEY DIFFERENCE FROM OTHER ROUTES

**Admin routes use `.use('*', authMiddleware)`** — global middleware attachment.
This is the ONLY place in the codebase that uses Hono `.use()` for middleware.
All other routes use manual middleware invocation inside handlers.

## HELPERS (helpers.ts)

Shared utilities: `AppContext`, `getTodayRange()` (5 AM KST cutoff), CSV helpers (`buildCsv`/`csvResponse` with UTF-8 BOM), guards (`requireAdmin`, `requireManagerOrAdmin`, `requireExportAccess`, `exportRateLimit`).

## MODULES BY SIZE

| Module             | Lines | Key Endpoints                        |
| ------------------ | ----- | ------------------------------------ |
| posts.ts           | 664   | List, detail, review, reject, delete |
| users.ts           | 463   | Search, detail, role update, suspend |
| votes.ts           | 409   | Vote CRUD, candidate management      |
| fas.ts             | 391   | FAS sync trigger, status, errors     |
| recommendations.ts | 211   | Safety recommendation CRUD           |
| trends.ts          | 207   | Trend analysis, statistics           |
| helpers.ts         | 195   | Shared pagination, CSV, guards       |
| export.ts          | 193   | CSV: users, posts, attendance        |
| alerting.ts        | 182   | Alert config, webhook management     |
| monitoring.ts      | 166   | System monitoring endpoints          |
| images.ts          | 165   | Image moderation, privacy review     |
| attendance.ts      | 144   | Attendance logs, manual override     |
| sync-errors.ts     | 143   | FAS sync error list, resolve, retry  |
| stats.ts           | 113   | Dashboard counts, category stats     |
| access-policies.ts | 111   | Point policies, reward configuration |
| audit.ts           | 49    | Audit log query with pagination      |
| index.ts           | 42    | Sub-router mounts, global auth       |

## CONVENTIONS

- **Route pattern**: Import Hono + `requireAdmin` + `AppContext` from `./helpers`, export `default app`
- **Guards**: `requireAdmin` (most), `requireManagerOrAdmin` (site-scoped), `requireExportAccess` + `exportRateLimit` (CSV). CSV: `buildCsv()` → `csvResponse()` (UTF-8 BOM)

## ANTI-PATTERNS

- **No `.use()` in sub-modules** — only `index.ts` uses global `.use()`. Import guards from `./helpers`
- **Don't bypass rate limits** — export endpoints MUST use `exportRateLimit`
