# Draft: NestJS → Cloudflare Native Migration

## Requirements (confirmed from user request)

- Migrate NestJS backend to Cloudflare Workers + Hono.js
- Migrate PostgreSQL (Prisma) to Cloudflare D1 (SQLite)
- Migrate Redis → Cloudflare KV
- Migrate S3/MinIO → Cloudflare R2
- Migrate BullMQ → Cloudflare Queues
- Implement Rate Limiting via Durable Objects

## Research Findings

### From PRD v1.2 (Section 13):

- **Target Architecture**: Workers + D1 + KV + R2 + Queues + Durable Objects
- **D1 Limits**: 10GB per DB, SQLite syntax, single-threaded
- **KV**: Eventually consistent (~60s), not for counters
- **Durable Objects**: Required for strict rate limiting, OTP tracking

### From Prisma Schema Analysis (bg_444b28a2):

- **18 models**, **10 enums**, **25+ relationships**
- **NO PostgreSQL-specific features** (no JSON, arrays, custom types)
- **Migration complexity**: LOW-MEDIUM
- **ENUM conversion needed**: TEXT + application validation

### From NestJS Analysis (bg_a8bee9ce):

- **13 feature modules** with clear separation
- **Key patterns**: DI container, decorators, interceptors
- **Auth**: JWT + Passport, daily session expiry at 5 AM Korea time
- **No background jobs** currently (BullMQ not used)
- **Guards**: JwtAuthGuard, RolesGuard, AttendanceGuard

### Current api-worker Status (apps/api-worker/):

- Already has Hono.js setup
- Has Drizzle ORM configured
- Routes exist: auth, users, posts, actions, attendance, votes, announcements, sites, admin
- **NEEDS**: wrangler.toml, complete D1 schema, R2 integration, Durable Objects

## Technical Decisions

### ORM Choice: Drizzle (already in api-worker)

- Rationale: Native D1 support, smaller bundle, already configured

### Migration Strategy: TBD

- Options: Big-bang, Incremental, Parallel-run

### Test Strategy: TBD

- Options: TDD, Tests-after, None

## Open Questions

1. Migration strategy: Big-bang cutover or incremental with parallel running?
2. Data migration: How much historical data to migrate?
3. Downtime tolerance: Can we have maintenance window?
4. Test strategy preference?
5. Existing api-worker: Extend or rebuild?

## Scope Boundaries

- INCLUDE: All NestJS API features currently working (82%)
- INCLUDE: P0 security features (rate limiting, PII encryption)
- EXCLUDE: Phase 2/3 features (AI, multi-site expansion)
- EXCLUDE: Frontend changes (already complete)

### From api-worker Analysis (bg_1466a497):

**Overall: 75% Complete** - Much more done than expected!

**What's WORKING (Production-Ready):**

- ✅ Authentication: Phone+DOB+name, JWT, rate limiting, attendance check
- ✅ Database Schema: All 18 tables with Drizzle ORM
- ✅ Core CRUD: Posts, Actions, Users, Sites, Announcements, Attendance
- ✅ Middleware: Auth + Attendance with Korea timezone
- ✅ wrangler.toml: D1/R2/KV bindings configured

**Critical Gaps (Must Fix):**

1. **R2 Image Upload** (0%) - BLOCKING for posts/actions
2. **Permission System** (30%) - Missing granular permissions
3. **Input Validation** (40%) - No Zod schemas
4. **Point System** (0%) - Table exists, no logic
5. **Audit Logging** (50%) - Minimal logging
6. **Pagination** (40%) - Missing on list endpoints

**Route Completion:**
| Route | Status | Lines |
|-------|--------|-------|
| auth | ✅ 100% | 218 |
| users | ⚠️ 80% | 174 |
| posts | ⚠️ 75% | 307 |
| actions | ⚠️ 75% | 375 |
| admin | ⚠️ 70% | 533 |
| attendance | ⚠️ 80% | 135 |
| announcements | ⚠️ 85% | 250 |
| votes | ⚠️ 60% | 158 |
| sites | ⚠️ 75% | 240 |

## Pending Research

- [ ] bg_384cfcae: Cloudflare D1 + Drizzle best practices
- [ ] bg_1986a085: Durable Objects for rate limiting
- [ ] bg_6cb65c38: R2 + KV + Queues integration
