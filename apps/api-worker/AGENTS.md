# API-WORKER KNOWLEDGE BASE

**Primary Backend**: Hono REST API on Cloudflare Workers (D1, R2, KV).

## STRUCTURE

```
src/
├── index.ts           # Entry: Hono app + CRON handlers
├── routes/            # 19 root + 17 admin modules (12k LOC)
├── middleware/         # 8 modules (manual invocation)
├── db/schema.ts       # Drizzle schema (32 tables, 29 relations)
├── lib/               # 27 utility modules (4.5k LOC)
├── scheduled/         # 9 CRON jobs (1.3k LOC)
└── validators/        # Zod request schemas
```

## WHERE TO LOOK

| Task       | Location           | Notes                                   |
| ---------- | ------------------ | --------------------------------------- |
| Add Route  | `src/routes/`      | Export `Hono` app, mount in `index.ts`  |
| DB Schema  | `src/db/schema.ts` | Drizzle ORM. Run `drizzle-kit generate` |
| Bindings   | `wrangler.toml`    | D1, R2, KV, DO, CRON, Hyperdrive, AI    |
| Helpers    | `src/lib/`         | response, crypto, audit, logger, sms    |
| Validation | `src/validators/`  | Zod schemas for request bodies          |
| CRON Jobs  | `src/scheduled/`   | FAS sync, overdue checks, PII cleanup   |

## SUBMODULE DOCS

- `src/routes/AGENTS.md`: Root route inventory and cross-cutting route patterns
- `src/routes/admin/AGENTS.md`: Admin-only route rules (`.use('*', authMiddleware)` exception)
- `src/middleware/AGENTS.md`: Middleware invocation and guard patterns
- `src/lib/AGENTS.md`: Utility module inventory by domain
- `src/db/AGENTS.md`: Schema and migration constraints
- `src/scheduled/AGENTS.md`: CRON schedule matrix and lock/retry rules
- `src/validators/AGENTS.md`: Zod schema conventions and enum parity checks
- `src/durable-objects/AGENTS.md`: Durable Object rate limiter rules and state model

## SCHEDULED TASKS (9 CRON jobs)

| Schedule    | Jobs                                                       |
| ----------- | ---------------------------------------------------------- |
| Every 5 min | FAS incremental sync, AceTime R2 sync, metrics alert check |
| Daily 21:00 | FAS full sync, overdue action check, PII lifecycle cleanup |
| Weekly Sun  | Data retention cleanup (3-year TTL)                        |
| Monthly 1st | Month-end points snapshot, auto-nomination of top earners  |

## CF BINDINGS

| Binding            | Type       | Purpose                          |
| ------------------ | ---------- | -------------------------------- |
| DB                 | D1         | Primary SQLite database          |
| R2 (×3)            | R2 Bucket  | Images, static, AceTime photos   |
| FAS_HYPERDRIVE     | Hyperdrive | MariaDB (FAS employee data)      |
| KV                 | KV         | Cache, sessions, sync locks      |
| NOTIFICATION_QUEUE | Queue      | Push notification delivery       |
| RATE_LIMITER       | DO         | Rate limiting                    |
| AI                 | Workers AI | Hazard classification, face blur |
| ANALYTICS          | Analytics  | API metrics                      |

## CONVENTIONS

- **Manual Middleware**: Invoke manually in handlers (e.g., `await verifyAuth(c)`). NO global `.use()`.
- **Drizzle ORM**: Use query builder (`db.select()`). NO raw SQL.
- **Context**: `c` (Hono Context) is always the first arg to helpers.
- **PII**: Hash sensitive data (phone, DOB) using `src/lib/crypto.ts` (HMAC-SHA256).
- **Auth**: JWT `loginDate` claim (daily reset 5 AM KST).
- **Audit**: All state-changing ops call `logAuditWithContext()`. Silent fail.
- **Validation**: All POST/PATCH use `zValidator("json", Schema)`.

## ANTI-PATTERNS

- **No Global Middleware**: Keep `index.ts` clean (except analytics).
- **No `as any`**: Strict type safety. Refactor existing violations.
- **No `console.log`**: Use `src/lib/logger.ts` for structured logs.
- **No In-Memory State**: Use KV or D1 (Workers are ephemeral).
- **No Raw SQL**: Always use Drizzle query builder.
