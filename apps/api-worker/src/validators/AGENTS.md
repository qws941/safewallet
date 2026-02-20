# API VALIDATORS

## OVERVIEW

Zod schema layer for request/response validation. This directory is the contract boundary before route handlers run.

## STRUCTURE

```
validators/
├── schemas.ts      # Core API schemas and shared primitives
├── fas-sync.ts     # FAS sync payload and query validation
├── export.ts       # Validator barrel exports
└── __tests__/      # Schema contract tests
```

## WHERE TO LOOK

| Task                         | File          | Notes                                                   |
| ---------------------------- | ------------- | ------------------------------------------------------- |
| Add route payload validation | `schemas.ts`  | Keep naming aligned with route intent (`CreateXSchema`) |
| Update FAS sync validation   | `fas-sync.ts` | Preserve external-system compatibility                  |
| Export new schema            | `export.ts`   | Ensure route imports use barrel path                    |

## CONVENTIONS

- Keep enum values aligned with `src/db/schema.ts` and `@safetywallet/types`.
- Prefer reusable primitives for IDs, dates, and paginated query params.
- Route handlers should call `zValidator("json", schema)` (or query equivalent) before business logic.
- Validation errors should flow through existing `error(c, code, msg)` response helpers.

## ANTI-PATTERNS

- No permissive `z.any()` for core request bodies.
- No silent enum drift from DB/types packages.
- No route-local schema duplication when shared schema already exists here.
