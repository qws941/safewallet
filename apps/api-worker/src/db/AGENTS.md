# API DB LAYER

## OVERVIEW

Drizzle ORM schema and batch helpers for D1. This directory defines database contracts consumed by routes, middleware, and scheduled jobs.

## STRUCTURE

```
db/
├── schema.ts      # 32 tables, enum definitions, relations
├── helpers.ts     # D1-safe batching helpers (100-op chunks)
└── __tests__/     # schema/helper tests
```

## WHERE TO LOOK

| Task             | File         | Notes                                         |
| ---------------- | ------------ | --------------------------------------------- |
| Add/modify table | `schema.ts`  | Keep enums and columns aligned with API types |
| Add index/unique | `schema.ts`  | Prefer explicit index names                   |
| Bulk writes      | `helpers.ts` | Use `dbBatchChunked()` for D1 bind limits     |

## CONVENTIONS

- Keep enum constants exported from `schema.ts`; route/service logic imports from DB schema.
- Use `integer(..., { mode: "timestamp" | "boolean" })` consistently for timestamp/flag columns.
- Add relations and indexes in the same change as table columns.
- For large inserts/updates, use `dbBatchChunked()` to avoid D1 batch-size failures.

## ANTI-PATTERNS

- No raw SQL migrations embedded in app logic; schema lives in Drizzle definitions.
- No table/enum changes without corresponding type parity updates in `packages/types`.
- No unbounded batch operations against D1; chunk writes.
