# apps/api-worker - Cloudflare Workers API

**Status**: Target architecture for migration. Primary development focus.

## OVERVIEW

Hono.js on Cloudflare Workers with D1 (SQLite), R2 (images), KV (sessions). Uses Drizzle ORM.

## STRUCTURE

```
src/
├── index.ts          # Hono app entry, CORS, error handling
├── types.ts          # Env bindings, AuthContext interfaces
├── routes/           # Route handlers (9 modules)
│   ├── auth.ts       # Login/refresh/logout, rate limiting
│   ├── users.ts      # Profile, points, memberships
│   ├── posts.ts      # Safety reports with R2 images
│   ├── attendance.ts # FAS sync, today's check
│   ├── sites.ts      # Site management, join codes
│   ├── actions.ts    # Task management, assignees
│   ├── votes.ts      # Monthly voting
│   ├── announcements.ts # Site/global announcements
│   └── admin.ts      # User mgmt, approvals, audit logs
├── middleware/       # Auth, attendance middleware
├── lib/              # JWT, crypto utilities (Web Crypto API)
└── db/
    └── schema.ts     # Drizzle ORM schema (20+ tables)
```

## WHERE TO LOOK

| Task           | Location                      | Notes                                  |
| -------------- | ----------------------------- | -------------------------------------- |
| Add route      | Create `src/routes/{name}.ts` | Export Hono app, mount in index.ts     |
| Add middleware | `src/middleware/{name}.ts`    | Apply via `app.use()`                  |
| Add D1 query   | Use Drizzle in route handler  | `c.env.DB` for D1 binding              |
| Upload to R2   | `c.env.R2.put(key, stream)`   | 10MB limit, type validation            |
| Add binding    | `wrangler.toml`               | [[d1_databases]], [[r2_buckets]], etc. |

## KEY PATTERNS

### Route Handler Template

```typescript
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
app.use("*", authMiddleware);
app.post("/", async (c) => {
  const db = drizzle(c.env.DB);
  // ... handler logic
  return c.json({ success: true, data, timestamp: new Date().toISOString() });
});
export default app;
```

### Middleware

- **authMiddleware**: JWT validation + same-day check (5 AM KST)
- **attendanceMiddleware**: Requires today's attendance record

### Bindings

```typescript
interface Env {
  DB: D1Database; // Drizzle queries
  R2: R2Bucket; // Image upload/delete
  KV: KVNamespace; // Session cache (TBD)
  JWT_SECRET: string;
  HMAC_SECRET: string;
  ENCRYPTION_KEY: string;
}
```

## CONVENTIONS

- **Response format**: `{ success, data, timestamp }` or `{ success: false, error }`
- **Error handling**: `throw new HTTPException(status, { message })`
- **Timezone**: All dates in Asia/Seoul, 5 AM day boundary
- **R2 keys**: `{entity}/{id}/{uuid}.{ext}` (e.g., `posts/123/abc.jpg`)

## ANTI-PATTERNS

| Pattern                          | Why Forbidden              |
| -------------------------------- | -------------------------- |
| In-memory rate limiting for prod | Use Durable Objects (TODO) |
| Loose `Record<string, unknown>`  | Use Zod validation         |
| `console.error()` in prod        | Use structured logging     |
| Hardcoded secrets                | Use wrangler secrets       |

## COMMANDS

```bash
npx wrangler dev        # Local dev (miniflare)
npx wrangler deploy     # Deploy to Workers
npx wrangler d1 execute # Run D1 SQL commands
```

## GAPS (TODO)

- [ ] Durable Objects for rate limiting
- [ ] KV session caching
- [ ] Queues for notifications
- [ ] Zod input validation
- [ ] Structured logging
