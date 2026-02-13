# ADMIN ROUTES

## OVERVIEW

Admin-only API sub-routes mounted at `/admin`. 12 domain modules + shared helpers. All routes require authentication and admin role.

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
└── monitoring.ts        # System monitoring endpoints
```

## KEY DIFFERENCE FROM OTHER ROUTES

**Admin routes use `.use('*', authMiddleware)`** — global middleware attachment.
This is the ONLY place in the codebase that uses Hono `.use()` for middleware.
All other routes use manual middleware invocation inside handlers.

## HELPERS (helpers.ts)

Shared utilities imported by all admin sub-modules:

| Export                  | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `AppContext`            | Typed Hono context with `auth` variable   |
| `DAY_CUTOFF_HOUR`       | 5 (AM KST day boundary)                   |
| `getTodayRange()`       | Today's start/end using 5 AM KST cutoff   |
| `getClientIp()`         | Extract client IP from CF headers         |
| `parseDateParam()`      | Parse date string query params            |
| `toExclusiveEndDate()`  | Adjust end date for exclusive range       |
| `formatKst()`           | Format date to KST timezone string        |
| `csvEscape()`           | Escape CSV cell values                    |
| `buildCsv()`            | Build CSV with UTF-8 BOM                  |
| `csvResponse()`         | Return CSV as downloadable response       |
| `requireAdmin`          | Guard: ADMIN or SUPER_ADMIN role          |
| `requireExportAccess`   | Guard: canManageUsers flag or SUPER_ADMIN |
| `exportRateLimit`       | Rate limit: 5 requests per 60 seconds     |
| `requireManagerOrAdmin` | Guard: site membership check              |

## MODULES BY SIZE

| Module             | Lines | Key Endpoints                        |
| ------------------ | ----- | ------------------------------------ |
| posts.ts           | 456   | List, detail, review, reject, delete |
| export.ts          | 374   | CSV: users, posts, attendance        |
| votes.ts           | 342   | Vote CRUD, candidate management      |
| users.ts           | 311   | Search, detail, role update, suspend |
| fas.ts             | 285   | FAS sync trigger, status, errors     |
| recommendations.ts | 211   | Safety recommendation CRUD           |
| monitoring.ts      | 166   | System monitoring endpoints          |
| sync-errors.ts     | 149   | FAS sync error list, resolve, retry  |
| attendance.ts      | 144   | Attendance logs, manual override     |
| stats.ts           | 113   | Dashboard counts, category stats     |
| access-policies.ts | 111   | Point policies, reward configuration |
| audit.ts           | 49    | Audit log query with pagination      |

## CONVENTIONS

- **Route pattern**: Import Hono + `requireAdmin` + `AppContext` from `./helpers`, export `default app`
- **Guards**: `requireAdmin` (most), `requireManagerOrAdmin` (site-scoped), `requireExportAccess` + `exportRateLimit` (CSV). CSV: `buildCsv()` → `csvResponse()` (UTF-8 BOM)

## ANTI-PATTERNS

- **No `.use()` in sub-modules** — only `index.ts` uses global `.use()`. Import guards from `./helpers`
- **Don't bypass rate limits** — export endpoints MUST use `exportRateLimit`
