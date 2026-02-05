# API-WORKER (Cloudflare Workers)

**Target architecture** - All new API development here.

## OVERVIEW

Hono.js REST API on Cloudflare Workers. D1 (SQLite) + R2 (images) + KV (sessions). Migrating from NestJS.

## STRUCTURE

```
src/
├── index.ts           # Hono app entry, route mounting
├── routes/            # 9 route modules (auth, posts, sites, etc.)
├── middleware/        # auth.ts (JWT validation)
├── lib/               # jwt.ts, response.ts, crypto.ts utilities
└── types.ts           # Env bindings, context types
```

## WHERE TO LOOK

| Task             | Location                 | Notes                           |
| ---------------- | ------------------------ | ------------------------------- |
| Add endpoint     | `src/routes/{module}.ts` | Export Hono app, mount in index |
| Add middleware   | `src/middleware/`        | c.set() for context injection   |
| Change bindings  | `wrangler.toml`          | D1, R2, KV, Durable Objects     |
| Response helpers | `src/lib/response.ts`    | success(), error() functions    |

## CONVENTIONS

### Route Pattern

```typescript
// src/routes/example.ts
import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const db = c.env.DB;
  // ... D1 query
  return c.json(success(data));
});

export default app;
```

### Response Format

```typescript
success(data); // { success: true, data, timestamp }
error(code, msg); // { success: false, error: { code, message }, timestamp }
```

### D1 Queries

Use `db.prepare().bind().run/all/first()`. No ORM - raw SQL only.

## BINDINGS (wrangler.toml)

| Binding  | Type | Name               | Usage                  |
| -------- | ---- | ------------------ | ---------------------- |
| DB       | D1   | safework2-db       | All database queries   |
| IMAGES   | R2   | safework2-images   | Post images upload     |
| SESSIONS | KV   | safework2-sessions | Token storage (unused) |

## ROUTE MODULES

| Route       | File          | Auth | Endpoints                |
| ----------- | ------------- | ---- | ------------------------ |
| /auth       | auth.ts       | No   | login, refresh, logout   |
| /users      | users.ts      | Yes  | me, update-password      |
| /posts      | posts.ts      | Yes  | CRUD + images            |
| /sites      | sites.ts      | Yes  | CRUD + memberships       |
| /attendance | attendance.ts | Yes  | check-in, today, history |
| /votes      | votes.ts      | Yes  | monthly worker voting    |
| /points     | points.ts     | Yes  | ledger, balance          |
| /fas        | fas.ts        | Yes  | FAS sync endpoints       |
| /admin      | admin.ts      | Yes  | User/post management     |

## TODO (Not Implemented)

- [ ] **Durable Objects rate limiting** - wrangler.toml declares but not implemented
- [ ] **KV session storage** - binding exists, code uses in-memory
- [ ] **Zod validation** - Some routes lack request validation

## ANTI-PATTERNS

- **Known violations**: `jwt.ts:36` has `as unknown as`, `response.ts:10,21` has `as any`
- **No raw SQL string concatenation** - Always use `.bind()` for parameters
- **No console.log in production** - Use structured logging if needed
