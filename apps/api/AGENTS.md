# apps/api - NestJS Backend (Legacy)

**Status**: Being migrated to Cloudflare Workers (`apps/api-worker/`)

## OVERVIEW

NestJS 10 REST API with Prisma ORM, PostgreSQL, Redis. Port 4000, prefix `/api/v1`.

## STRUCTURE

```
src/
├── auth/           # Login, refresh, logout (Passport JWT)
├── users/          # Profile, points, memberships
├── sites/          # Site CRUD, join codes, members
├── posts/          # Safety reports, images, reviews
├── attendance/     # FAS sync, daily check-in
├── votes/          # Monthly worker recognition
├── admin/          # User management, approvals, stats
├── points/         # Immutable ledger, balance calc
├── common/         # Guards, decorators, interceptors, filters
├── prisma/         # Database connection service
└── test/           # E2E tests (Jest + Supertest)
```

## WHERE TO LOOK

| Task                 | Location                                        | Notes                    |
| -------------------- | ----------------------------------------------- | ------------------------ |
| Add endpoint         | Create in `src/{module}/{module}.controller.ts` | Use existing DTOs        |
| Add business logic   | `src/{module}/{module}.service.ts`              | Inject PrismaService     |
| Add auth check       | Apply `@UseGuards(JwtAuthGuard)`                | Daily session validation |
| Add role check       | Apply `@Roles('ADMIN')` + `RolesGuard`          | Combine with JWT guard   |
| Add attendance check | Apply `AttendanceGuard`                         | For posts/votes          |

## KEY PATTERNS

### Guards (4 custom)

- **JwtAuthGuard**: Validates JWT + same-day check (5 AM cutoff)
- **RolesGuard**: RBAC via `@Roles()` decorator
- **AttendanceGuard**: Requires today's attendance
- **ThrottlerGuard**: 100 req/60s global, 5/60s on login

### Decorators

- `@CurrentUser(field?)` - Extract user from request
- `@Roles(...roles)` - Set required roles

### Response Format (TransformInterceptor)

```typescript
{ success: true, data: T, timestamp: string }
```

### Error Format (HttpExceptionFilter)

```typescript
{ success: false, error: { code, message }, timestamp: string }
```

## CONVENTIONS

- **Module structure**: `{name}.module.ts`, `{name}.controller.ts`, `{name}.service.ts`
- **DTOs**: `create-{name}.dto.ts`, `update-{name}.dto.ts`, `query-{name}.dto.ts`
- **Authorization helpers**: `requireMembership()`, `requireSiteAdmin()` in services

## ANTI-PATTERNS

| Pattern                        | Why Forbidden                               |
| ------------------------------ | ------------------------------------------- |
| Cross-module service injection | Only VotesService→AttendanceService allowed |
| Skipping validation pipe       | DTOs must use class-validator decorators    |
| Direct Prisma in controllers   | Always use service layer                    |

## COMMANDS

```bash
npm run dev:api         # Start dev server (port 4000)
npm run test:e2e        # Run E2E tests
npm run build:api       # Build for production
```
