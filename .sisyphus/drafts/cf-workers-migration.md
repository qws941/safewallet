# Draft: Cloudflare Workers Migration - Complete Implementation

## Requirements (confirmed)

**Goal**: Complete migration from NestJS to Cloudflare Workers (82% → 100%)

### Current State

- **api-worker Routes (9)**: auth, attendance, votes, posts, actions, users, sites, announcements, admin
- **D1 Schema**: 20+ tables with Drizzle ORM
- **wrangler.toml**: D1, R2, KV configured

### Missing Endpoints (P0 - Critical)

1. `POST /points/award` - Admin awards points to user
2. `GET /points/balance` - Get user's point balance
3. `GET /points/history` - Get point transaction history
4. `GET /points/leaderboard/:siteId` - Site leaderboard
5. `POST /reviews` - Create post review
6. `GET /reviews/post/:postId` - Get reviews for a post
7. `PATCH /reviews/:id` - Update review
8. `DELETE /fas/workers/:id` - Remove FAS worker
9. `POST /sites/join` - Join site by code
10. `GET /sites/:id/stats` - Site statistics

### Missing Endpoints (P1 - Important)

1. `GET /users/:id/memberships` - User's site memberships
2. `GET /posts/site/:siteId/stats` - Post statistics
3. `GET /attendance/site/:siteId/report` - Attendance report
4. `POST /admin/users/:id/lock` - Lock user account
5. `POST /admin/users/:id/unlock` - Unlock user account
6. `GET /votes/results/:siteId` - Voting results

## Technical Decisions

### D1 Schema Status

- **Already has**: pointsLedger, reviews, auditLogs tables ✅
- **Missing columns in users**: externalSystem, externalWorkerId, companyName, tradeType, OTP fields
- **Missing columns in sites**: joinCode, joinEnabled, requiresApproval

### NestJS Business Logic Reference

- **PointsService**: award(), getBalance(), getHistory(), getSiteLeaderboard()
- **ReviewsService**: create(), findByPost() - updates post.reviewStatus, awards points on APPROVE
- **FasService**: syncWorkers(), upsertWorker(), deleteWorker()

### Response Format

- **Target**: `{ success: true, data: T, timestamp: string }`
- **Current**: Inconsistent across routes

## Research Findings

### Durable Objects for Rate Limiting

- Use counter pattern with time windows
- Store: { count, windowStart }
- Integrate via wrangler.toml [[durable_objects]]

### Existing Route Patterns

- All routes use `authMiddleware`
- Drizzle ORM with `drizzle(c.env.DB)`
- Response via `c.json({ ... })`

## Scope Boundaries

### INCLUDE

- All P0 endpoints (10)
- All P1 endpoints (6)
- D1 schema updates for missing columns
- Durable Objects for rate limiting
- Response format standardization
- wrangler.toml updates

### EXCLUDE

- E2E test migration (separate task)
- Frontend API client updates (separate task)
- Data migration from PostgreSQL to D1 (separate task)
- CF Queues for notifications (P2)
- KV session caching (configured but optional)

## Open Questions

NONE - All requirements clear from LEGACY_REMOVAL_PLAN.md

## Test Strategy Decision

- **Infrastructure exists**: NO (no test files in api-worker)
- **Automated tests**: NO (E2E tests are in apps/api/test, not migrated)
- **Agent-Executed QA**: ALWAYS - using Playwright/curl/interactive_bash
