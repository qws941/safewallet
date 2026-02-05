# Legacy Removal & Migration Requirements

**Generated:** 2026-02-05  
**Migration:** NestJS (apps/api) → Cloudflare Workers (apps/api-worker)  
**Status:** 82% complete

---

## 1. LEGACY COMPONENTS FOR REMOVAL

### 1.1 Primary Target: `apps/api/` (NestJS Backend)

**After full migration, remove:**

| Component         | Path                           | Size      | Removal Blocker                     |
| ----------------- | ------------------------------ | --------- | ----------------------------------- |
| NestJS App        | `apps/api/`                    | ~50 files | Migration must be 100%              |
| Prisma Client     | `packages/database/` (partial) | -         | Keep schema, remove PostgreSQL deps |
| Docker PostgreSQL | `docker/docker-compose.yml`    | -         | Replace with D1                     |
| Docker Redis      | `docker/docker-compose.yml`    | -         | Replace with KV                     |
| Docker MinIO      | `docker/docker-compose.yml`    | -         | Replace with R2                     |

### 1.2 Root-Level Dependencies to Remove

```json
// From root package.json - NestJS-specific
{
  "remove": [
    "@nestjs/*", // All NestJS packages (10+)
    "@prisma/client", // PostgreSQL ORM (replace with Drizzle)
    "bcrypt", // CPU-intensive (use bcryptjs or Web Crypto)
    "ioredis", // Redis client
    "passport", // Auth framework
    "passport-jwt", // JWT strategy
    "class-validator", // DTO validation (use Zod)
    "class-transformer", // DTO transform (not needed)
    "pg", // PostgreSQL driver
    "bull", // Queue (replace with CF Queues)
    "minio" // S3 client (replace with R2)
  ]
}
```

### 1.3 Files to Remove After Migration

```
apps/api/                      # Entire directory
docker/docker-compose.yml      # Rewrite for local D1/KV simulation
.env.example                   # Remove PostgreSQL/Redis vars
turbo.json                     # Remove api build tasks
package.json                   # Remove api-related scripts
```

---

## 2. MIGRATION GAP ANALYSIS

### 2.1 Endpoint Migration Status

| Module        | NestJS Endpoints | Workers Endpoints | Gap     | Priority |
| ------------- | ---------------- | ----------------- | ------- | -------- |
| Auth          | 4                | 4                 | ✅ 0%   | -        |
| Users         | 6                | 5                 | ⚠️ 17%  | P1       |
| Posts         | 8                | 7                 | ⚠️ 12%  | P1       |
| Sites         | 7                | 5                 | ⚠️ 29%  | P0       |
| Attendance    | 5                | 4                 | ⚠️ 20%  | P1       |
| Admin         | 12               | 10                | ⚠️ 17%  | P1       |
| Votes         | 6                | 5                 | ⚠️ 17%  | P2       |
| Actions       | 5                | 5                 | ✅ 0%   | -        |
| Announcements | 4                | 4                 | ✅ 0%   | -        |
| **Points**    | 4                | 0                 | ❌ 100% | **P0**   |
| **Reviews**   | 3                | 0                 | ❌ 100% | **P0**   |
| **FAS**       | 3                | 1                 | ⚠️ 67%  | **P0**   |
| **Health**    | 2                | 0                 | ❌ 100% | P2       |

### 2.2 Missing Endpoints (Must Implement)

#### P0 - Critical (Blocks Legacy Removal)

| Endpoint                          | Module  | NestJS Location            | Notes                 |
| --------------------------------- | ------- | -------------------------- | --------------------- |
| `POST /points/award`              | Points  | `points.controller.ts:17`  | Admin awards points   |
| `GET /points/balance`             | Points  | `points.controller.ts:25`  | User point balance    |
| `GET /points/history`             | Points  | `points.controller.ts:33`  | Point transaction log |
| `GET /points/leaderboard/:siteId` | Points  | `points.controller.ts:41`  | Site leaderboard      |
| `POST /reviews`                   | Reviews | `reviews.controller.ts:15` | Create post review    |
| `GET /reviews/post/:postId`       | Reviews | `reviews.controller.ts:28` | Get reviews for post  |
| `PATCH /reviews/:id`              | Reviews | `reviews.controller.ts:36` | Update review         |
| `DELETE /fas/workers/:id`         | FAS     | `fas.controller.ts:42`     | Remove FAS worker     |
| `POST /sites/join`                | Sites   | `sites.controller.ts:56`   | Join site by code     |
| `GET /sites/:id/stats`            | Sites   | `sites.controller.ts:78`   | Site statistics       |

#### P1 - Important

| Endpoint                              | Module     | Notes                        |
| ------------------------------------- | ---------- | ---------------------------- |
| `GET /users/:id/memberships`          | Users      | List user's site memberships |
| `GET /posts/site/:siteId/stats`       | Posts      | Post statistics for site     |
| `GET /attendance/site/:siteId/report` | Attendance | Attendance report            |
| `POST /admin/users/:id/lock`          | Admin      | Lock user account            |
| `POST /admin/users/:id/unlock`        | Admin      | Unlock user account          |
| `GET /votes/results/:siteId`          | Votes      | Voting results               |

#### P2 - Nice to Have

| Endpoint            | Module | Notes              |
| ------------------- | ------ | ------------------ |
| `GET /health`       | Health | Basic health check |
| `GET /health/ready` | Health | Readiness probe    |

---

## 3. INFRASTRUCTURE MIGRATION

### 3.1 Database Migration (PostgreSQL → D1)

| Aspect      | PostgreSQL (Current) | D1 (Target)    | Action         |
| ----------- | -------------------- | -------------- | -------------- |
| ORM         | Prisma               | Drizzle        | ✅ Done        |
| Schema      | 18 entities          | 20 tables      | ⚠️ Sync needed |
| DateTime    | Native               | TEXT (ISO8601) | ⚠️ Convert     |
| CUID        | `@default(cuid())`   | `uuid()`       | ⚠️ Convert     |
| JSON fields | Native               | TEXT           | ⚠️ Serialize   |
| Enums       | PostgreSQL enum      | TEXT + CHECK   | ⚠️ Convert     |

**Schema Sync Required:**

```sql
-- Missing in D1 schema (apps/api-worker/src/db/schema.ts)
-- 1. PointsLedger table
-- 2. PostReview table
-- 3. FasWorker table
-- 4. AuditLog table
```

### 3.2 Storage Migration

| Service      | Current    | Target    | Status             |
| ------------ | ---------- | --------- | ------------------ |
| Files/Images | MinIO (S3) | R2        | ✅ Configured      |
| Sessions     | Redis      | KV        | ⚠️ Not implemented |
| Cache        | Redis      | KV        | ⚠️ Not implemented |
| Queue        | BullMQ     | CF Queues | ❌ Not implemented |

### 3.3 Security Migration

| Feature          | NestJS          | Workers    | Status                   |
| ---------------- | --------------- | ---------- | ------------------------ |
| JWT Auth         | passport-jwt    | jose       | ✅ Done                  |
| Rate Limiting    | ThrottlerGuard  | In-memory  | ⚠️ Needs Durable Objects |
| PII Hashing      | crypto (bcrypt) | Web Crypto | ✅ Done                  |
| Input Validation | class-validator | Zod        | ⚠️ Partial               |
| CORS             | @nestjs/cors    | Hono CORS  | ✅ Done                  |

---

## 4. FRONTEND API CLIENT UPDATES

### 4.1 Current Configuration

| App        | Env Variable          | Current Value           | Target         |
| ---------- | --------------------- | ----------------------- | -------------- |
| worker-app | `NEXT_PUBLIC_API_URL` | `http://localhost:3333` | CF Workers URL |
| admin-app  | `NEXT_PUBLIC_API_URL` | `http://localhost:3002` | CF Workers URL |

### 4.2 API Response Format Alignment

**NestJS Format (Current):**

```typescript
{ success: true, data: T, timestamp: string }
{ success: false, error: { code, message }, timestamp: string }
```

**Workers Format (Inconsistent):**

```typescript
// Some routes:
{ success: true, data: T, timestamp: string }
// Other routes:
{ data: T }  // Missing success flag
{ error: string }  // Wrong error format
```

**Action:** Standardize ALL Workers routes to match NestJS format.

---

## 5. REMOVAL PREREQUISITES

### 5.1 Checklist Before Removing NestJS

- [ ] **P0 Endpoints**: All 10 critical endpoints implemented
- [ ] **P1 Endpoints**: All 6 important endpoints implemented
- [ ] **D1 Schema**: All 4 missing tables added
- [ ] **Response Format**: All routes return `{ success, data, timestamp }`
- [ ] **Rate Limiting**: Durable Objects implemented
- [ ] **KV Sessions**: Session caching implemented
- [ ] **E2E Tests**: Pass against Workers API
- [ ] **Frontend Updated**: Both apps pointing to Workers
- [ ] **Staging Deploy**: Workers deployed to staging
- [ ] **Smoke Test**: Manual verification complete

### 5.2 Removal Order

```
Phase 1: Parallel Operation
├── Workers API deployed alongside NestJS
├── Frontend uses feature flag for API selection
└── Monitor error rates

Phase 2: Cutover
├── Frontend default to Workers API
├── NestJS as fallback only
└── 1 week observation

Phase 3: Removal
├── Remove apps/api/ directory
├── Remove Docker PostgreSQL/Redis/MinIO
├── Remove NestJS dependencies from root
├── Update turbo.json and package.json
└── Clean up .env files
```

---

## 6. ESTIMATED EFFORT

| Task                         | Effort         | Dependencies     |
| ---------------------------- | -------------- | ---------------- |
| P0 Endpoints (10)            | 3-4 days       | D1 schema sync   |
| P1 Endpoints (6)             | 2 days         | P0 complete      |
| D1 Schema Sync               | 1 day          | None             |
| Response Format Fix          | 0.5 days       | None             |
| Durable Objects (Rate Limit) | 2 days         | None             |
| KV Sessions                  | 1 day          | None             |
| E2E Test Migration           | 2 days         | All endpoints    |
| Frontend Updates             | 0.5 days       | Workers deployed |
| **Total**                    | **12-14 days** |                  |

---

## 7. RISKS

| Risk                       | Impact | Mitigation                           |
| -------------------------- | ------ | ------------------------------------ |
| D1 query performance       | High   | Optimize indexes, add KV cache       |
| Durable Objects complexity | Medium | Start with simple counter pattern    |
| Data migration             | High   | Run PostgreSQL→D1 migration script   |
| Feature parity gaps        | Medium | Thorough E2E testing                 |
| Rollback needed            | Low    | Keep NestJS for 2 weeks post-cutover |
