# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-05  
**Commit:** local  
**Branch:** feature/cloudflare-migration

## OVERVIEW

SafetyWallet - Construction site safety reporting PWA. Turborepo monorepo with dual backend architecture (NestJS→Cloudflare Workers migration in progress). 82% complete.

## STRUCTURE

```
safework2/
├── apps/
│   ├── api/              # NestJS backend (legacy, being migrated)
│   ├── api-worker/       # Cloudflare Workers API (target)
│   ├── worker-app/       # Next.js 14 Worker PWA (port 3000)
│   └── admin-app/        # Next.js 14 Admin Dashboard (port 3001)
├── packages/
│   ├── database/         # Prisma schema + client (18 entities)
│   ├── types/            # Shared TypeScript types, enums, DTOs
│   └── ui/               # shadcn/ui component library
├── docker/               # Development Docker Compose
├── docs/                 # PRD, implementation plans, status docs
└── .sisyphus/            # AI agent planning artifacts
```

## WHERE TO LOOK

| Task                  | Location                                 | Notes                                 |
| --------------------- | ---------------------------------------- | ------------------------------------- |
| Add API endpoint      | `apps/api-worker/src/routes/`            | Hono.js routes, use existing patterns |
| Add database entity   | `packages/database/prisma/schema.prisma` | Run `npm run db:generate` after       |
| Add shared type/DTO   | `packages/types/src/`                    | Export via barrel in `index.ts`       |
| Add UI component      | `packages/ui/src/components/`            | Follow shadcn conventions             |
| Add worker page       | `apps/worker-app/src/app/`               | Next.js 14 App Router                 |
| Add admin page        | `apps/admin-app/src/app/`                | Next.js 14 App Router                 |
| Configure CF bindings | `apps/api-worker/wrangler.toml`          | D1, R2, KV namespaces                 |

## CODE MAP

### Entry Points

| App        | Entry                | Framework  | Port        |
| ---------- | -------------------- | ---------- | ----------- |
| api        | `src/main.ts`        | NestJS 10  | 4000        |
| api-worker | `src/index.ts`       | Hono 4     | - (Workers) |
| worker-app | `src/app/layout.tsx` | Next.js 14 | 3000        |
| admin-app  | `src/app/layout.tsx` | Next.js 14 | 3001        |

### Key Modules

| Module     | Location                              | Purpose                       |
| ---------- | ------------------------------------- | ----------------------------- |
| Auth       | `api-worker/src/routes/auth.ts`       | JWT login, refresh, logout    |
| Posts      | `api-worker/src/routes/posts.ts`      | Safety reports with R2 images |
| Attendance | `api-worker/src/routes/attendance.ts` | FAS sync, daily check-in      |
| Sites      | `api-worker/src/routes/sites.ts`      | Site management, memberships  |
| Admin      | `api-worker/src/routes/admin.ts`      | User/post management, stats   |

## CONVENTIONS

### Code Style

- **TypeScript strict mode** everywhere
- **Barrel exports** in packages (index.ts re-exports)
- **Path aliases**: `@/` → `src/` in apps

### Naming

- **Files**: kebab-case (`auth.guard.ts`, `create-post.dto.ts`)
- **DB fields**: snake_case via `@map()` in Prisma
- **API routes**: `/api/v1/` prefix (NestJS), `/` (Workers)

### API Response Format

```typescript
{ success: true, data: T, timestamp: string }
{ success: false, error: { code: string, message: string }, timestamp: string }
```

### Authentication

- **JWT**: 24h expiry, daily reset at 5 AM KST
- **PII**: HMAC-SHA256 hashed (phoneHash, dobHash)
- **Refresh**: UUID token, rotated on each refresh

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                            | Why Forbidden                          |
| ---------------------------------- | -------------------------------------- |
| `as unknown as Type`               | Defeats TypeScript safety              |
| `confirm()` / `alert()`            | Use modal components instead           |
| `console.*` in production          | Use structured logging                 |
| `Record<string, unknown>` for DTOs | Use strict Zod schemas                 |
| Padding crypto keys with "0"       | Use proper key derivation              |
| `Promise.resolve()` mocks          | Never ship placeholder implementations |

## COMMANDS

```bash
# Development
npm run dev              # Start all apps (Turborepo)
npm run dev:api          # Start NestJS API only
npm run dev:worker       # Start worker-app only

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio

# Build & Deploy
npm run build            # Build all apps
npm run lint             # Lint all apps
npm run test:e2e         # Run E2E tests (apps/api/test/)

# Docker
docker compose -f docker/docker-compose.yml up -d
```

## CLOUDFLARE BINDINGS

| Binding | Type | Name             | Purpose                      |
| ------- | ---- | ---------------- | ---------------------------- |
| DB      | D1   | safework2-db     | SQLite database              |
| R2      | R2   | safework2-images | Image storage                |
| KV      | KV   | (configured)     | Session cache (not yet used) |

## MIGRATION STATUS

**NestJS → Cloudflare Workers**: 60% complete

| Area            | NestJS (legacy)   | Workers (target)   |
| --------------- | ----------------- | ------------------ |
| Auth            | ✅ Complete       | ✅ Complete        |
| Users           | ✅ Complete       | ✅ Complete        |
| Posts           | ✅ Complete       | ✅ Complete        |
| Sites           | ✅ Complete       | ✅ Complete        |
| Attendance      | ✅ Complete       | ✅ Complete        |
| Admin           | ✅ Complete       | ✅ Complete        |
| Rate Limiting   | ✅ ThrottlerGuard | ⚠️ In-memory only  |
| Durable Objects | N/A               | ❌ Not implemented |

## NOTES

- **5 AM KST cutoff**: All "today" logic uses Korea timezone with 5 AM as day boundary
- **Dual API**: Both `apps/api` and `apps/api-worker` exist during migration
- **Package manager mismatch**: `package.json` declares npm but `pnpm-workspace.yaml` exists
- **.sisyphus/**: AI agent planning directory - contains drafts, plans, evidence
- **Testing**: E2E tests only in `apps/api/test/`, no unit tests or frontend tests
