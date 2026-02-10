# API-WORKER (Cloudflare Workers)

**Target architecture** — All new API development here.

## OVERVIEW

Hono.js REST API on Cloudflare Workers. D1 (SQLite) via Drizzle ORM + R2 (images) + KV (sessions).

## STRUCTURE

```
src/
├── index.ts           # Hono app entry, route mounting, CRON scheduled handler
├── routes/            # 19 route modules (18 files + admin/ subdir)
├── middleware/         # 6 middleware modules
├── lib/               # 15 utility modules
├── validators/        # Zod validation schemas
├── utils/             # Common utilities
├── db/
│   └── schema.ts      # Drizzle ORM schema (32 tables, 20 enums, 1472 lines)
├── scheduled/
│   └── index.ts       # CRON job handlers (365 lines)
├── durable-objects/
│   └── RateLimiter.ts # DO rate limiter (declared, not active)
└── types.ts           # Env bindings, context types
```

## WHERE TO LOOK

| Task             | Location                 | Notes                                     |
| ---------------- | ------------------------ | ----------------------------------------- |
| Add endpoint     | `src/routes/{module}.ts` | Export Hono app, mount in index           |
| Add middleware   | `src/middleware/`        | Manual invocation, NOT `.use()`           |
| Add/modify table | `src/db/schema.ts`       | Drizzle ORM definitions                   |
| Change bindings  | `wrangler.toml`          | D1, R2, KV, DO, CRON triggers             |
| Response helpers | `src/lib/response.ts`    | `success(c, data)`, `error(c, code, msg)` |
| Add CRON job     | `src/index.ts`           | `scheduled` export handler                |

## CONVENTIONS

### Route Pattern

```typescript
// src/routes/example.ts
import { Hono } from "hono";
import type { Env } from "../types";
import { success, error } from "../lib/response";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const db = drizzle(c.env.DB); // Drizzle, NOT raw SQL
  // ... query with Drizzle
  return success(c, data); // context c is FIRST param
});

export default app;
```

### Middleware Pattern (Manual Invocation)

```typescript
// NOT: app.use(authMiddleware)
// YES: called inside handler
app.get("/", async (c) => {
  await attendanceMiddleware(
    c,
    async () => {
      // handler logic
    },
    siteId,
  );
});
```

### Database (Drizzle ORM)

```typescript
import { drizzle } from "drizzle-orm/d1";
import { users, posts } from "../db/schema";

const db = drizzle(c.env.DB);
const result = await db.select().from(users).where(eq(users.id, id));
```

**NOT raw SQL** — Use Drizzle query builder.

## ROUTE MODULES (18)

| Route          | File                 | Auth | Purpose                                                   |
| -------------- | -------------------- | ---- | --------------------------------------------------------- |
| /auth          | auth.ts (1116L)      | No   | Login, refresh, logout, lockout                           |
| /admin         | admin/ (11 modules)  | Yes  | User/post/site mgmt, stats, CSV → **See admin/AGENTS.md** |
| /education     | education.ts (1508L) | Yes  | Courses, materials, quizzes                               |
| /posts         | posts.ts             | Yes  | Safety reports, R2 images                                 |
| /sites         | sites.ts             | Yes  | Site CRUD, memberships                                    |
| /attendance    | attendance.ts        | Yes  | Check-in, today, history                                  |
| /votes         | votes.ts             | Yes  | Monthly worker voting                                     |
| /points        | points.ts            | Yes  | Ledger, balance                                           |
| /users         | users.ts             | Yes  | Profile, password update                                  |
| /actions       | actions.ts           | Yes  | Corrective actions                                        |
| /approvals     | approvals.ts         | Yes  | Review workflow                                           |
| /disputes      | disputes.ts          | Yes  | Attendance disputes                                       |
| /fas           | fas.ts               | Yes  | FAS sync endpoints                                        |
| /notifications | notifications.ts     | Yes  | Push notifications                                        |
| /policies      | policies.ts          | Yes  | Safety policies                                           |
| /reviews       | reviews.ts           | Yes  | Post reviews                                              |
| /announcements | announcements.ts     | Yes  | Site announcements                                        |
| /recommend     | recommendations.ts   | Yes  | Safety recommendations                                    |
| /acetime       | acetime.ts           | Yes  | AceTime integration, photo sync                           |

## MIDDLEWARE (6)

| File                | Purpose                                |
| ------------------- | -------------------------------------- |
| auth.ts             | JWT validation, user context injection |
| attendance.ts       | Attendance state check                 |
| fas-auth.ts         | FAS (external system) auth             |
| permission.ts       | Role-based access control              |
| rate-limit.ts       | Rate limiting logic                    |
| security-headers.ts | HTTP security header injection         |

## LIB UTILITIES (15)

| File                     | Purpose                                 |
| ------------------------ | --------------------------------------- |
| response.ts              | `success()`, `error()` response helpers |
| jwt.ts                   | JWT sign/verify, token management       |
| crypto.ts (95L)          | HMAC-SHA256, PII hashing (phone, DOB)   |
| audit.ts (182L)          | Audit trail logging, 47 action types    |
| notification.ts          | Push notification dispatch              |
| notification-triggers.ts | Event-driven notification triggers      |
| push.ts                  | Web Push protocol implementation        |
| web-push.ts              | Web Push subscription management        |
| fas-mariadb.ts           | External FAS MariaDB connector          |
| device-registrations.ts  | Device token management                 |
| rate-limit.ts            | Rate limiter utilities                  |
| points-engine.ts         | Point calculation engine                |
| state-machine.ts         | Workflow state transitions              |
| aceviewer-parser.ts      | AceViewer data parsing                  |
| sql-js.d.ts              | sql.js type declarations                |

## VALIDATORS

| File       | Purpose                                  |
| ---------- | ---------------------------------------- |
| schemas.ts | Zod validation schemas for API endpoints |

## UTILS

| File      | Purpose                  |
| --------- | ------------------------ |
| common.ts | Shared utility functions |

## BINDINGS (wrangler.toml)

| Binding        | Type | Name               | Usage                            |
| -------------- | ---- | ------------------ | -------------------------------- |
| DB             | D1   | safework2-db       | All database queries (Drizzle)   |
| IMAGES         | R2   | safework2-images   | Post image upload/serve          |
| STATIC         | R2   | safework2-static   | SPA static file hosting          |
| ACETIME_BUCKET | R2   | safework2-acetime  | AceTime photo sync storage       |
| SESSIONS       | KV   | safework2-sessions | Token storage (unused)           |
| RATE_LIMITER   | DO   | RateLimiter        | Rate limiting (declared, unused) |
| FAS_HYPERDRIVE | HD   | (env var)          | MariaDB proxy for FAS attendance |

## CRON SCHEDULED JOBS

| Schedule      | Purpose                    |
| ------------- | -------------------------- |
| `*/5 * * * *` | FAS attendance data sync   |
| `0 0 1 * *`   | Monthly points calculation |
| `0 3 * * 0`   | Sunday cleanup tasks       |

## ANTI-PATTERNS

- **Known**: `approvals.ts:34` `as any`
- **No raw SQL** — Always use Drizzle ORM query builder
- **No console.log** — Use structured logging if needed
- **No `.use()` middleware** — Manual invocation pattern only

## TODO

- [ ] Durable Objects rate limiting — declared in wrangler.toml, not implemented
- [ ] KV session storage — binding exists, code uses in-memory
- [ ] Consistent Zod validation across all routes
