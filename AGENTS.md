# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-12  
**Branch:** master

## OVERVIEW

SafetyWallet - Construction site safety reporting PWA. Turborepo monorepo with Cloudflare Workers backend (Hono + Drizzle ORM) and two Next.js 14 frontends deployed to CF Pages.

## STRUCTURE

```
safework2/
├── apps/
│   ├── api-worker/       # Cloudflare Workers API (Hono + Drizzle)
│   ├── worker-app/       # Next.js 14 Worker PWA (CF Pages, port 3000)
│   └── admin-app/        # Next.js 14 Admin Dashboard (CF Pages, port 3001)
├── packages/
│   ├── types/            # Shared TypeScript types, 15 enums, 10 DTOs
│   └── ui/               # shadcn/ui component library (13 components)
├── e2e/                  # Playwright e2e tests (4 projects, 1064 lines)
├── scripts/              # Build/deploy helper scripts (7 files)
├── docker/               # Development Docker Compose
├── docs/                 # PRD, implementation plans, status docs
└── .sisyphus/            # AI agent planning artifacts
```

## WHERE TO LOOK

| Task                  | Location                           | Notes                           |
| --------------------- | ---------------------------------- | ------------------------------- |
| Add API endpoint      | `apps/api-worker/src/routes/`      | Hono routes, 19 modules         |
| Add/modify DB table   | `apps/api-worker/src/db/schema.ts` | Drizzle ORM, 32 tables          |
| Add shared type/DTO   | `packages/types/src/`              | Export via barrel in `index.ts` |
| Add UI component      | `packages/ui/src/components/`      | shadcn conventions              |
| Add worker page       | `apps/worker-app/src/app/`         | Next.js 14 App Router           |
| Add admin page        | `apps/admin-app/src/app/`          | Next.js 14 App Router           |
| Configure CF bindings | `apps/api-worker/wrangler.toml`    | D1, R2×3, KV, DO, CRON          |
| Add middleware        | `apps/api-worker/src/middleware/`  | 7 files, manual invocation      |
| Add validation schema | `apps/api-worker/src/validators/`  | Zod schemas                     |
| Add CRON job          | `apps/api-worker/src/scheduled/`   | Separate module, KST timezone   |
| Add/run e2e tests     | `e2e/`                             | Playwright, 4 projects          |

## CODE MAP

### Entry Points

| App        | Entry                | Framework  | Port        |
| ---------- | -------------------- | ---------- | ----------- |
| api-worker | `src/index.ts`       | Hono 4     | - (Workers) |
| worker-app | `src/app/layout.tsx` | Next.js 14 | 3000        |
| admin-app  | `src/app/layout.tsx` | Next.js 14 | 3001        |

## CONVENTIONS

### Code Style

- **TypeScript strict mode** everywhere
- **Barrel exports** in packages (index.ts re-exports)
- **Path aliases**: `@/` → `src/` in apps
- **All pages `'use client'`** — zero React Server Components
- **No ESLint/Prettier** — typecheck only quality gate

### Naming

- **Files**: kebab-case (`auth.guard.ts`, `create-post.dto.ts`)
- **DB fields**: snake_case via Drizzle column definitions
- **API routes**: `/` prefix (Hono Workers)

### API Response Format

```typescript
// Response helpers — context c is FIRST param
success(c, data); // { success: true, data, timestamp }
error(c, code, msg); // { success: false, error: { code, message }, timestamp }
```

### Authentication

- **JWT**: Uses `loginDate` field (NOT standard `exp`), daily reset at 5 AM KST
- **PII**: HMAC-SHA256 hashed (phoneHash, dobHash)
- **Refresh**: UUID token, rotated on each refresh

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                            | Why Forbidden                          |
| ---------------------------------- | -------------------------------------- |
| `as unknown as Type`               | Defeats TypeScript safety              |
| `as any`                           | Defeats TypeScript safety              |
| `confirm()` / `alert()`            | Use modal components instead           |
| `console.*` in production          | Use structured logging                 |
| `Record<string, unknown>` for DTOs | Use strict Zod schemas                 |
| Padding crypto keys with "0"       | Use proper key derivation              |
| `Promise.resolve()` mocks          | Never ship placeholder implementations |

### Known Violations (TODO)

- `apps/api-worker/src/db/helpers.ts:12` — `(db as any).batch(operations)`
- `apps/admin-app/src/app/actions/page.tsx:120` — `(statusColors[item.status] as any)`
- `apps/admin-app/src/app/votes/page.tsx:63` — `window.confirm()` anti-pattern

## COMMANDS

```bash
npm run dev              # Start all apps (Turborepo)
npm run dev:worker       # Start worker-app only
npm run dev:admin        # Start admin-app only
npx drizzle-kit generate # Generate migration SQL
npx drizzle-kit push     # Push schema to D1
npm run build            # Build all apps
tsc --noEmit             # Typecheck (only quality gate)
```

## NOTES

- **5 AM KST cutoff**: All "today" logic uses Korea timezone with 5 AM as day boundary
- **Package manager**: npm (`pnpm-workspace.yaml` is vestigial)
- **E2E tests only**: 4 Playwright projects, no unit tests
- **Static export**: worker-app uses `output: 'export'`; admin-app uses `@cloudflare/next-on-pages`
- **Enum sync**: 15 enums in `packages/types` MUST match Drizzle schema enums (5 additional schema-only)
- **FAS integration**: Foreign Attendance System via Hyperdrive (MariaDB proxy), 5-min CRON sync
- **Korean localization**: Worker-app UI fully Korean
- **State machine**: Post review workflow `RECEIVED→IN_REVIEW→APPROVED/REJECTED/NEED_INFO`
