# Cloudflare Workers Migration - Complete Implementation Plan

## TL;DR

> **Quick Summary**: Complete the NestJS to Cloudflare Workers migration by implementing 16 missing endpoints (10 P0 + 6 P1), aligning D1 schema with Prisma, and adding Durable Objects stub for rate limiting.
>
> **Deliverables**:
>
> - D1 schema aligned with Prisma (missing columns + enums)
> - 10 P0 critical endpoints functional
> - 6 P1 important endpoints functional
> - Response format standardized
> - Durable Objects rate limiting stub
>
> **Estimated Effort**: Large (12-14 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Wave 0 (Schema) → Wave 1 (Routes) → Wave 2 (Updates) → Wave 3 (Infrastructure)

---

## Context

### Original Request

Complete NestJS to Cloudflare Workers migration from 82% to 100%. Implement all missing P0 and P1 endpoints, update D1 schema, add rate limiting infrastructure.

### Interview Summary

**Key Discussions**:

- Project at 82% migration completion
- 10 P0 critical endpoints blocking legacy removal
- 6 P1 important endpoints needed for feature parity
- D1 schema has most tables but missing critical columns
- Durable Objects needed for production rate limiting

**Research Findings**:

- api-worker has 34 endpoints across 9 modules
- D1 schema significantly differs from Prisma (missing columns, enum mismatches)
- NestJS business logic patterns well-documented (points, reviews, FAS, sites)
- Existing route patterns in api-worker are consistent and followable

### Metis Review

**Identified Gaps** (addressed):

- D1 schema mismatches are more severe than initially assessed → Added Wave 0 for schema alignment
- Missing columns on sites/users/posts tables → Explicit schema migration task
- Enum differences between Prisma and Drizzle → Enum reconciliation task
- Response format inconsistency → Standardization task added
- Edge cases for timezone, data integrity → Documented in acceptance criteria

---

## Work Objectives

### Core Objective

Complete the Cloudflare Workers API migration to 100% feature parity with NestJS, enabling full legacy removal.

### Concrete Deliverables

1. `apps/api-worker/src/db/schema.ts` - Updated with missing columns and aligned enums
2. `apps/api-worker/src/routes/points.ts` - New route file with 4 endpoints
3. `apps/api-worker/src/routes/reviews.ts` - New route file with 3 endpoints
4. `apps/api-worker/src/routes/fas.ts` - New route file with 2 endpoints
5. `apps/api-worker/src/routes/sites.ts` - Updated with 2 new endpoints (join, stats)
6. `apps/api-worker/src/routes/users.ts` - Updated with 1 new endpoint (memberships)
7. `apps/api-worker/src/routes/posts.ts` - Updated with 1 new endpoint (stats)
8. `apps/api-worker/src/routes/admin.ts` - Updated with 2 new endpoints (lock/unlock)
9. `apps/api-worker/src/routes/votes.ts` - Updated with 1 new endpoint (results)
10. `apps/api-worker/src/routes/attendance.ts` - Updated with 1 new endpoint (report)
11. `apps/api-worker/src/durable-objects/rate-limiter.ts` - Stub implementation
12. `apps/api-worker/wrangler.toml` - Updated with Durable Objects binding

### Definition of Done

- [ ] `wrangler d1 execute --command "PRAGMA table_info(sites)" | grep join_code` → Returns join_code column
- [ ] `curl -X POST /points/award` → Returns 201 with ledger entry
- [ ] `curl -X POST /sites/join` → Returns 200 with membership
- [ ] All 16 new endpoints respond (no 500 errors)
- [ ] Response format matches `{ success: true, data, timestamp }` pattern

### Must Have

- All P0 endpoints (10) working with NestJS behavior parity
- All P1 endpoints (6) working with NestJS behavior parity
- D1 schema aligned with Prisma columns
- Rate limiting stub in place

### Must NOT Have (Guardrails)

- KV session caching implementation (configured but not used)
- Full Durable Objects rate limiting (stub only)
- CF Queues for notifications (P2)
- Image processing pipelines (P2)
- Frontend API client updates (separate task)
- "Improved" business logic (copy NestJS exactly first)
- New response format (match existing Workers patterns)
- Zod validation beyond NestJS DTO equivalents

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion is executable by the agent using curl, wrangler, or Playwright.

### Test Decision

- **Infrastructure exists**: NO (no test files in api-worker)
- **Automated tests**: NO (E2E tests in apps/api/test, not migrated yet)
- **Framework**: None

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Every task includes:

1. **Bash (curl)** - API endpoint verification
2. **Bash (wrangler)** - D1 schema verification
3. Evidence captured in `.sisyphus/evidence/`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Start Immediately - BLOCKS ALL):
└── Task 1: D1 Schema Alignment

Wave 1 (After Wave 0 - Parallel):
├── Task 2: Points Route (4 endpoints)
├── Task 3: Reviews Route (3 endpoints)
└── Task 4: FAS Route (2 endpoints)

Wave 2 (After Wave 1 - Parallel):
├── Task 5: Sites Updates (join, stats)
├── Task 6: Users/Posts/Attendance Updates (3 endpoints)
└── Task 7: Admin/Votes Updates (3 endpoints)

Wave 3 (After Wave 2):
├── Task 8: Response Format Standardization
└── Task 9: Durable Objects Stub

Critical Path: Task 1 → Task 2 → Task 5 → Task 8
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 2, 3, 4 | None (Wave 0)        |
| 2    | 1          | 5, 8    | 3, 4                 |
| 3    | 1          | 8       | 2, 4                 |
| 4    | 1          | 8       | 2, 3                 |
| 5    | 2          | 8       | 6, 7                 |
| 6    | 1          | 8       | 5, 7                 |
| 7    | 1          | 8       | 5, 6                 |
| 8    | 2-7        | 9       | None                 |
| 9    | 8          | None    | None                 |

### Agent Dispatch Summary

| Wave | Tasks   | Recommended Dispatch                                                                |
| ---- | ------- | ----------------------------------------------------------------------------------- |
| 0    | 1       | delegate_task(category="unspecified-high", load_skills=[], run_in_background=false) |
| 1    | 2, 3, 4 | dispatch parallel after Wave 0 completes                                            |
| 2    | 5, 6, 7 | dispatch parallel after Wave 1 completes                                            |
| 3    | 8, 9    | sequential after Wave 2                                                             |

---

## TODOs

### Wave 0: Foundation (BLOCKS ALL)

- [ ] 1. D1 Schema Alignment with Prisma

  **What to do**:
  - Add missing columns to `apps/api-worker/src/db/schema.ts`:
    - Sites: `joinCode` (TEXT, UNIQUE), `joinEnabled` (BOOLEAN), `requiresApproval` (BOOLEAN), `closedAt` (INTEGER/timestamp)
    - Users: `externalSystem` (TEXT), `externalWorkerId` (TEXT), `companyName` (TEXT), `tradeType` (TEXT), `piiViewFull` (BOOLEAN), `canAwardPoints` (BOOLEAN), `canManageUsers` (BOOLEAN), `otpCode` (TEXT), `otpExpiresAt` (INTEGER), `otpAttemptCount` (INTEGER)
    - Posts: `reviewStatus` (TEXT enum), `actionStatus` (TEXT enum), `hazardType` (TEXT), `locationFloor` (TEXT), `locationZone` (TEXT), `locationDetail` (TEXT), `isUrgent` (BOOLEAN)
    - Reviews: `reasonCode` (TEXT)
    - PointsLedger: `postId` (TEXT), `refLedgerId` (TEXT), `adminId` (TEXT), `settleMonth` (TEXT), `occurredAt` (INTEGER)
  - Align enum values with Prisma schema:
    - UserRole: Add `SITE_ADMIN`, `SYSTEM`
    - Category: Align with HAZARD, UNSAFE_BEHAVIOR, INCONVENIENCE, SUGGESTION, BEST_PRACTICE
    - ReviewStatus: Add RECEIVED, IN_REVIEW, NEED_INFO
    - ActionStatus: Add NONE, REQUIRED, ASSIGNED, REOPENED
    - MembershipStatus: Change to PENDING, ACTIVE, LEFT, REMOVED
  - Generate D1 migration SQL for column additions
  - Apply migration to dev D1 database

  **Must NOT do**:
  - Remove any existing columns
  - Change existing enum values that are in use
  - Create new tables not in Prisma schema

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Database schema work requiring careful analysis and precise SQL generation
  - **Skills**: []
    - No special skills needed, standard TypeScript/SQL work
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not relevant to schema work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo)
  - **Blocks**: Tasks 2, 3, 4, 5, 6, 7
  - **Blocked By**: None (start immediately)

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/db/schema.ts:67-93` - Existing users table structure with enum usage
  - `apps/api-worker/src/db/schema.ts:95-109` - Sites table structure pattern
  - `apps/api-worker/src/db/schema.ts:147-184` - Posts table with multiple enum fields

  **API/Type References**:
  - `packages/database/prisma/schema.prisma:95-137` - Full User model with all fields needed
  - `packages/database/prisma/schema.prisma:139-160` - Full Site model with joinCode and flags
  - `packages/database/prisma/schema.prisma:180-210` - Full Post model with 2-axis status

  **Documentation References**:
  - `docs/LEGACY_REMOVAL_PLAN.md:113-135` - D1 schema gaps section

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Sites table has joinCode column
    Tool: Bash (wrangler)
    Preconditions: wrangler CLI installed, D1 database configured
    Steps:
      1. wrangler d1 execute safework2-db --local --command "PRAGMA table_info(sites)"
      2. Assert: Output contains "join_code|TEXT"
      3. Assert: Output contains "join_enabled"
      4. Assert: Output contains "requires_approval"
    Expected Result: All new columns present
    Evidence: Command output saved to .sisyphus/evidence/task-1-sites-schema.txt

  Scenario: Users table has FAS fields
    Tool: Bash (wrangler)
    Preconditions: wrangler CLI installed
    Steps:
      1. wrangler d1 execute safework2-db --local --command "PRAGMA table_info(users)"
      2. Assert: Output contains "external_worker_id|TEXT"
      3. Assert: Output contains "external_system|TEXT"
      4. Assert: Output contains "can_award_points"
    Expected Result: FAS integration fields present
    Evidence: Command output saved to .sisyphus/evidence/task-1-users-schema.txt

  Scenario: Posts table has 2-axis status model
    Tool: Bash (wrangler)
    Preconditions: wrangler CLI installed
    Steps:
      1. wrangler d1 execute safework2-db --local --command "PRAGMA table_info(posts)"
      2. Assert: Output contains "review_status|TEXT"
      3. Assert: Output contains "action_status|TEXT"
      4. Assert: Output contains "is_urgent"
    Expected Result: 2-axis state model columns present
    Evidence: Command output saved to .sisyphus/evidence/task-1-posts-schema.txt
  ```

  **Commit**: YES
  - Message: `feat(api-worker): align D1 schema with Prisma model`
  - Files: `apps/api-worker/src/db/schema.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

### Wave 1: New Route Files (Parallel)

- [ ] 2. Points Route Implementation

  **What to do**:
  - Create `apps/api-worker/src/routes/points.ts` with 4 endpoints:
    - `POST /award` - Admin awards points to user (copy logic from `apps/api/src/points/points.service.ts:14-33`)
    - `GET /balance` - Get user's point balance (sum of ledger entries)
    - `GET /history` - Paginated point transaction history
    - `GET /leaderboard/:siteId` - Site leaderboard ranked by points
  - Import and mount in `apps/api-worker/src/index.ts`
  - Use `authMiddleware` for all endpoints
  - Add role check for /award (require SITE_ADMIN or canAwardPoints flag)
  - Generate settleMonth as `YYYY-MM` format
  - Return standardized response format

  **Must NOT do**:
  - Implement point deduction/adjustment (not in P0 scope)
  - Add complex caching logic
  - Create new business rules not in NestJS

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core business logic with financial implications (points ledger)
  - **Skills**: []
    - Standard TypeScript/Hono work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4)
  - **Blocks**: Tasks 5, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/routes/posts.ts:61-113` - POST handler pattern with validation
  - `apps/api-worker/src/routes/admin.ts:32-60` - Role-based access control pattern
  - `apps/api-worker/src/routes/users.ts:24-52` - GET with pagination pattern

  **API/Type References**:
  - `apps/api/src/points/points.service.ts:14-33` - Award logic with settleMonth calculation
  - `apps/api/src/points/points.service.ts:36-49` - Balance aggregation query
  - `apps/api/src/points/points.service.ts:51-85` - History query with pagination
  - `apps/api/src/points/points.service.ts:87-118` - Leaderboard groupBy query

  **Documentation References**:
  - `docs/LEGACY_REMOVAL_PLAN.md:80-91` - P0 points endpoints list

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: POST /points/award creates ledger entry
    Tool: Bash (curl)
    Preconditions: Dev server running, admin user exists with token
    Steps:
      1. curl -s -X POST http://localhost:8787/points/award \
           -H "Authorization: Bearer $ADMIN_TOKEN" \
           -H "Content-Type: application/json" \
           -d '{"userId":"test-user-1","siteId":"test-site-1","amount":100,"reason":"Safety excellence"}'
      2. Assert: HTTP status is 201
      3. Assert: response.data.amount equals 100
      4. Assert: response.data.settleMonth matches "2026-02" format
    Expected Result: Ledger entry created with correct data
    Evidence: Response saved to .sisyphus/evidence/task-2-points-award.json

  Scenario: GET /points/balance returns sum
    Tool: Bash (curl)
    Preconditions: User has points entries
    Steps:
      1. curl -s "http://localhost:8787/points/balance?siteId=test-site-1" \
           -H "Authorization: Bearer $USER_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data.balance is number >= 0
    Expected Result: Balance calculated correctly
    Evidence: Response saved to .sisyphus/evidence/task-2-points-balance.json

  Scenario: GET /points/leaderboard/:siteId returns ranked list
    Tool: Bash (curl)
    Preconditions: Multiple users have points
    Steps:
      1. curl -s "http://localhost:8787/points/leaderboard/test-site-1?limit=10" \
           -H "Authorization: Bearer $USER_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data is array
      4. Assert: First item has rank=1
      5. Assert: Items sorted by balance descending
    Expected Result: Leaderboard with ranks
    Evidence: Response saved to .sisyphus/evidence/task-2-points-leaderboard.json

  Scenario: POST /points/award fails without admin role
    Tool: Bash (curl)
    Preconditions: Worker user token (not admin)
    Steps:
      1. curl -s -X POST http://localhost:8787/points/award \
           -H "Authorization: Bearer $WORKER_TOKEN" \
           -H "Content-Type: application/json" \
           -d '{"userId":"x","siteId":"y","amount":10,"reason":"test"}'
      2. Assert: HTTP status is 403
      3. Assert: response.success is false
    Expected Result: Forbidden error
    Evidence: Response saved to .sisyphus/evidence/task-2-points-forbidden.json
  ```

  **Commit**: YES
  - Message: `feat(api-worker): add points route with award, balance, history, leaderboard`
  - Files: `apps/api-worker/src/routes/points.ts`, `apps/api-worker/src/index.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

- [ ] 3. Reviews Route Implementation

  **What to do**:
  - Create `apps/api-worker/src/routes/reviews.ts` with 3 endpoints:
    - `POST /` - Create post review with state machine (copy from `apps/api/src/reviews/reviews.service.ts:15-67`)
    - `GET /post/:postId` - Get all reviews for a post
    - `PATCH /:id` - Update review comment
  - Implement 6-action state machine: APPROVE, REJECT, REQUEST_MORE, MARK_URGENT, ASSIGN, CLOSE
  - Auto-award 100 points on APPROVE action
  - Update post.reviewStatus and post.actionStatus based on action
  - Require SITE_ADMIN role for creating reviews
  - Import and mount in `apps/api-worker/src/index.ts`

  **Must NOT do**:
  - Create new review action types
  - Change point award amount from 100
  - Allow non-admins to create reviews

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex state machine logic requiring careful implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 4)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/routes/admin.ts:95-140` - Existing review pattern (admin-only)
  - `apps/api-worker/src/routes/posts.ts:61-113` - POST handler with DB transaction

  **API/Type References**:
  - `apps/api/src/reviews/reviews.service.ts:15-67` - Create logic with state machine
  - `apps/api/src/reviews/reviews.service.ts:69-83` - findByPost query
  - `apps/api/src/reviews/reviews.service.ts:85-114` - determineNewStatuses state machine

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: POST /reviews creates review and updates post status
    Tool: Bash (curl)
    Preconditions: Post exists with reviewStatus=RECEIVED
    Steps:
      1. curl -s -X POST http://localhost:8787/reviews \
           -H "Authorization: Bearer $ADMIN_TOKEN" \
           -H "Content-Type: application/json" \
           -d '{"postId":"test-post-1","action":"APPROVE","comment":"Well documented"}'
      2. Assert: HTTP status is 201
      3. Assert: response.data.review.action equals "APPROVE"
      4. Assert: response.data.postStatus equals "APPROVED"
      5. Assert: response.data.pointsAwarded equals 100
    Expected Result: Review created, post approved, points awarded
    Evidence: Response saved to .sisyphus/evidence/task-3-review-approve.json

  Scenario: GET /reviews/post/:postId returns review history
    Tool: Bash (curl)
    Preconditions: Post has reviews
    Steps:
      1. curl -s "http://localhost:8787/reviews/post/test-post-1" \
           -H "Authorization: Bearer $USER_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data is array
      4. Assert: Reviews ordered by createdAt desc
    Expected Result: Review list returned
    Evidence: Response saved to .sisyphus/evidence/task-3-review-list.json

  Scenario: State machine: REJECT sets status to REJECTED
    Tool: Bash (curl)
    Steps:
      1. Create review with action="REJECT"
      2. Assert: response.data.postStatus equals "REJECTED"
      3. Assert: response.data.pointsAwarded equals 0
    Expected Result: Correct state transition
    Evidence: Response saved to .sisyphus/evidence/task-3-review-reject.json
  ```

  **Commit**: YES
  - Message: `feat(api-worker): add reviews route with state machine and auto-points`
  - Files: `apps/api-worker/src/routes/reviews.ts`, `apps/api-worker/src/index.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

- [ ] 4. FAS Route Implementation

  **What to do**:
  - Create `apps/api-worker/src/routes/fas.ts` with 2 endpoints:
    - `POST /workers/sync` - Bulk upsert workers (copy from `apps/api/src/fas/fas.service.ts:15-45`)
    - `DELETE /workers/:externalWorkerId` - Remove FAS worker
  - Implement HMAC-SHA256 hashing for phone/dob using Web Crypto API
  - Implement name masking: "John Doe" → "J\*\*\*e"
  - Normalize phone (strip non-digits) before hashing
  - No authentication required (system-to-system API)
  - Add rate limiting placeholder (in-memory for now)
  - Import and mount in `apps/api-worker/src/index.ts`

  **Must NOT do**:
  - Require JWT authentication (FAS is system-to-system)
  - Implement full rate limiting (stub only)
  - Store plaintext phone/dob

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Security-critical PII handling with cryptography
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/lib/crypto.ts` - Existing HMAC implementation pattern
  - `apps/api-worker/src/routes/admin.ts:145-180` - Existing FAS sync handler

  **API/Type References**:
  - `apps/api/src/fas/fas.service.ts:15-45` - syncWorkers bulk logic
  - `apps/api/src/fas/fas.service.ts:47-89` - upsertWorker with hashing
  - `apps/api/src/fas/fas.service.ts:91-95` - maskName utility
  - `apps/api/src/fas/fas.service.ts:97-108` - deleteWorker

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: POST /fas/workers/sync creates new workers
    Tool: Bash (curl)
    Preconditions: Empty database
    Steps:
      1. curl -s -X POST http://localhost:8787/fas/workers/sync \
           -H "Content-Type: application/json" \
           -d '{"workers":[{"externalWorkerId":"FAS001","phone":"01012345678","dob":"1990-01-15","name":"Kim Cheolsu","companyName":"SafeCo","tradeType":"Welding"}]}'
      2. Assert: HTTP status is 200
      3. Assert: response.data.created equals 1
      4. Assert: response.data.failed equals 0
    Expected Result: Worker created with hashed PII
    Evidence: Response saved to .sisyphus/evidence/task-4-fas-sync-create.json

  Scenario: Phone is normalized and hashed
    Tool: Bash (curl + wrangler)
    Steps:
      1. Sync worker with phone "010-1234-5678"
      2. wrangler d1 execute --command "SELECT phone_hash FROM users WHERE external_worker_id='FAS001'"
      3. Assert: phone_hash is not null
      4. Assert: phone_hash is HMAC hash (64 hex chars)
      5. Assert: phone column is normalized "01012345678"
    Expected Result: PII properly hashed
    Evidence: Query output saved to .sisyphus/evidence/task-4-fas-hash.txt

  Scenario: DELETE /fas/workers/:id removes worker
    Tool: Bash (curl)
    Steps:
      1. curl -s -X DELETE http://localhost:8787/fas/workers/FAS001
      2. Assert: HTTP status is 200
      3. Assert: response.data.deleted equals true
    Expected Result: Worker removed
    Evidence: Response saved to .sisyphus/evidence/task-4-fas-delete.json

  Scenario: Name masking works correctly
    Tool: Bash (wrangler)
    Steps:
      1. After sync, query: SELECT name_masked FROM users WHERE external_worker_id='FAS001'
      2. Assert: name_masked equals "김*수" (Korean) or "K*****u" pattern
    Expected Result: Only first and last character visible
    Evidence: Query output saved to .sisyphus/evidence/task-4-fas-mask.txt
  ```

  **Commit**: YES
  - Message: `feat(api-worker): add FAS route with worker sync and delete`
  - Files: `apps/api-worker/src/routes/fas.ts`, `apps/api-worker/src/index.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

### Wave 2: Existing Route Updates (Parallel)

- [ ] 5. Sites Route Updates (join, stats)

  **What to do**:
  - Add to `apps/api-worker/src/routes/sites.ts`:
    - `POST /join` - Join site by code (copy from `apps/api/src/sites/sites.service.ts`)
      - Accept `{ joinCode: string }` body
      - Case-insensitive code lookup
      - Check joinEnabled flag
      - Create membership with status=PENDING if requiresApproval, else ACTIVE
    - `GET /:id/stats` - Site dashboard statistics
      - pendingReviews: COUNT posts WHERE reviewStatus IN (RECEIVED, IN_REVIEW)
      - postsThisWeek: COUNT posts WHERE createdAt >= NOW - 7 days
      - activeMembers: COUNT memberships WHERE status=ACTIVE
      - totalPoints: SUM pointsLedger.amount WHERE amount > 0
  - Implement `generateJoinCode()` helper for 6-char alphanumeric codes

  **Must NOT do**:
  - Change existing site endpoints
  - Remove join code on failed attempts

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding 2 endpoints to existing file, clear patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1, 2 (needs pointsLedger for stats)

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/routes/sites.ts:28-57` - Existing GET list pattern
  - `apps/api-worker/src/routes/sites.ts:109-151` - Existing members endpoint

  **API/Type References**:
  - `apps/api/src/sites/sites.service.ts:45-78` - join() logic
  - `apps/api/src/sites/sites.service.ts:120-145` - getDashboardStats()

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: POST /sites/join with valid code creates membership
    Tool: Bash (curl)
    Preconditions: Site exists with joinCode="ABC123", joinEnabled=true
    Steps:
      1. curl -s -X POST http://localhost:8787/sites/join \
           -H "Authorization: Bearer $USER_TOKEN" \
           -H "Content-Type: application/json" \
           -d '{"joinCode":"abc123"}'
      2. Assert: HTTP status is 200
      3. Assert: response.data.status equals "ACTIVE" or "PENDING"
    Expected Result: User joined site
    Evidence: .sisyphus/evidence/task-5-sites-join.json

  Scenario: POST /sites/join with invalid code fails
    Tool: Bash (curl)
    Steps:
      1. curl -s -X POST http://localhost:8787/sites/join \
           -d '{"joinCode":"INVALID"}'
      2. Assert: HTTP status is 404
      3. Assert: response.error contains "not found"
    Expected Result: Code not found error
    Evidence: .sisyphus/evidence/task-5-sites-join-invalid.json

  Scenario: GET /sites/:id/stats returns dashboard data
    Tool: Bash (curl)
    Preconditions: Site has posts and members
    Steps:
      1. curl -s "http://localhost:8787/sites/test-site-1/stats" \
           -H "Authorization: Bearer $ADMIN_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data.pendingReviews is number
      4. Assert: response.data.activeMembers is number
      5. Assert: response.data.totalPoints is number
    Expected Result: Stats object returned
    Evidence: .sisyphus/evidence/task-5-sites-stats.json
  ```

  **Commit**: YES
  - Message: `feat(api-worker): add sites join and stats endpoints`
  - Files: `apps/api-worker/src/routes/sites.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

- [ ] 6. Users/Posts/Attendance Updates (3 endpoints)

  **What to do**:
  - Add to `apps/api-worker/src/routes/users.ts`:
    - `GET /:id/memberships` - List user's site memberships with site info
  - Add to `apps/api-worker/src/routes/posts.ts`:
    - `GET /site/:siteId/stats` - Post statistics (total, by category, by status)
  - Add to `apps/api-worker/src/routes/attendance.ts`:
    - `GET /site/:siteId/report` - Attendance report with date range

  **Must NOT do**:
  - Expose PII in membership responses
  - Allow cross-site data access

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 simple GET endpoints, clear patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/routes/users.ts:24-52` - User profile pattern
  - `apps/api-worker/src/routes/attendance.ts:45-78` - Attendance query pattern

  **API/Type References**:
  - `apps/api/src/users/users.controller.ts` - memberships endpoint
  - `apps/api/src/posts/posts.controller.ts` - stats endpoint
  - `apps/api/src/attendance/attendance.controller.ts` - report endpoint

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: GET /users/:id/memberships returns sites list
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:8787/users/me/memberships" \
           -H "Authorization: Bearer $USER_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data is array of memberships with site info
    Expected Result: User's site memberships
    Evidence: .sisyphus/evidence/task-6-user-memberships.json

  Scenario: GET /posts/site/:siteId/stats returns post stats
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:8787/posts/site/test-site-1/stats" \
           -H "Authorization: Bearer $ADMIN_TOKEN"
      2. Assert: response.data.total is number
      3. Assert: response.data.byCategory is object
    Expected Result: Post statistics
    Evidence: .sisyphus/evidence/task-6-posts-stats.json

  Scenario: GET /attendance/site/:siteId/report returns report
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:8787/attendance/site/test-site-1/report?startDate=2026-02-01&endDate=2026-02-05" \
           -H "Authorization: Bearer $ADMIN_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data has attendance records
    Expected Result: Attendance report
    Evidence: .sisyphus/evidence/task-6-attendance-report.json
  ```

  **Commit**: YES
  - Message: `feat(api-worker): add memberships, post stats, attendance report endpoints`
  - Files: `apps/api-worker/src/routes/users.ts`, `apps/api-worker/src/routes/posts.ts`, `apps/api-worker/src/routes/attendance.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

- [ ] 7. Admin/Votes Updates (3 endpoints)

  **What to do**:
  - Add to `apps/api-worker/src/routes/admin.ts`:
    - `POST /users/:id/lock` - Lock user account (set flag/status)
    - `POST /users/:id/unlock` - Unlock user account
  - Add to `apps/api-worker/src/routes/votes.ts`:
    - `GET /results/:siteId` - Voting results for a site/month

  **Must NOT do**:
  - Allow locking super admins
  - Expose voter identities in results

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 simple endpoints with clear patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/routes/admin.ts:32-60` - User management pattern
  - `apps/api-worker/src/routes/votes.ts:15-45` - Votes query pattern

  **API/Type References**:
  - `apps/api/src/admin/admin.controller.ts` - lock/unlock endpoints
  - `apps/api/src/votes/votes.controller.ts` - results endpoint

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: POST /admin/users/:id/lock locks user
    Tool: Bash (curl)
    Steps:
      1. curl -s -X POST "http://localhost:8787/admin/users/test-user-1/lock" \
           -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
           -d '{"reason":"Policy violation"}'
      2. Assert: HTTP status is 200
      3. Assert: User cannot login after lock
    Expected Result: User locked
    Evidence: .sisyphus/evidence/task-7-admin-lock.json

  Scenario: POST /admin/users/:id/unlock unlocks user
    Tool: Bash (curl)
    Steps:
      1. curl -s -X POST "http://localhost:8787/admin/users/test-user-1/unlock" \
           -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: User can login after unlock
    Expected Result: User unlocked
    Evidence: .sisyphus/evidence/task-7-admin-unlock.json

  Scenario: GET /votes/results/:siteId returns vote counts
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:8787/votes/results/test-site-1?month=2026-02" \
           -H "Authorization: Bearer $USER_TOKEN"
      2. Assert: HTTP status is 200
      3. Assert: response.data has candidate list with vote counts
      4. Assert: Voter identities NOT exposed
    Expected Result: Vote results with counts only
    Evidence: .sisyphus/evidence/task-7-votes-results.json
  ```

  **Commit**: YES
  - Message: `feat(api-worker): add admin lock/unlock and vote results endpoints`
  - Files: `apps/api-worker/src/routes/admin.ts`, `apps/api-worker/src/routes/votes.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

### Wave 3: Infrastructure

- [ ] 8. Response Format Standardization

  **What to do**:
  - Audit all routes for consistent response format
  - Create response helper in `apps/api-worker/src/lib/response.ts`:
    ```typescript
    export const success = <T>(c: Context, data: T, status = 200) =>
      c.json(
        { success: true, data, timestamp: new Date().toISOString() },
        status,
      );
    export const error = (
      c: Context,
      message: string,
      code: string,
      status = 400,
    ) =>
      c.json(
        {
          success: false,
          error: { code, message },
          timestamp: new Date().toISOString(),
        },
        status,
      );
    ```
  - Update existing routes to use helpers
  - Verify all new routes use helpers

  **Must NOT do**:
  - Change response shape (keep existing pattern)
  - Break existing frontend integrations

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Refactoring with clear pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 2-7

  **References**:

  **Pattern References**:
  - `apps/api-worker/src/routes/auth.ts:45-52` - Existing response pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All routes return consistent format
    Tool: Bash (grep + curl)
    Steps:
      1. Test 5 random endpoints
      2. Assert: All responses have "success" field
      3. Assert: All responses have "timestamp" field
      4. Assert: Success responses have "data" field
      5. Assert: Error responses have "error" object with "code" and "message"
    Expected Result: Consistent format across all endpoints
    Evidence: .sisyphus/evidence/task-8-response-format.json
  ```

  **Commit**: YES
  - Message: `refactor(api-worker): standardize response format across all routes`
  - Files: `apps/api-worker/src/lib/response.ts`, `apps/api-worker/src/routes/*.ts`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

- [ ] 9. Durable Objects Rate Limiting Stub

  **What to do**:
  - Create `apps/api-worker/src/durable-objects/rate-limiter.ts` with stub class:
    ```typescript
    export class RateLimiter implements DurableObject {
      // TODO: Implement production rate limiting
      async fetch(request: Request): Promise<Response> {
        return new Response("Rate limiter stub - not implemented", {
          status: 501,
        });
      }
    }
    ```
  - Update `wrangler.toml` with Durable Objects binding (commented out for dev)
  - Document rate limiting requirements in code comments
  - Mark as TODO for production implementation

  **Must NOT do**:
  - Implement full rate limiting logic
  - Deploy to production with stub

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Stub implementation only
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 8)
  - **Blocks**: None
  - **Blocked By**: Task 8

  **References**:

  **Documentation References**:
  - Cloudflare Durable Objects documentation
  - `docs/LEGACY_REMOVAL_PLAN.md:147-153` - Rate limiting requirements

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Durable Objects stub exists
    Tool: Bash (file check)
    Steps:
      1. ls apps/api-worker/src/durable-objects/rate-limiter.ts
      2. Assert: File exists
      3. grep "RateLimiter" apps/api-worker/src/durable-objects/rate-limiter.ts
      4. Assert: Class is exported
    Expected Result: Stub file present
    Evidence: .sisyphus/evidence/task-9-do-stub.txt

  Scenario: wrangler.toml has DO binding (commented)
    Tool: Bash (grep)
    Steps:
      1. grep -A3 "durable_objects" apps/api-worker/wrangler.toml
      2. Assert: Output shows RateLimiter binding (may be commented)
    Expected Result: Binding configured for future use
    Evidence: .sisyphus/evidence/task-9-wrangler-do.txt
  ```

  **Commit**: YES
  - Message: `chore(api-worker): add Durable Objects rate limiter stub`
  - Files: `apps/api-worker/src/durable-objects/rate-limiter.ts`, `apps/api-worker/wrangler.toml`
  - Pre-commit: `cd apps/api-worker && npx tsc --noEmit`

---

## Commit Strategy

| After Task | Message                                                 | Files                                | Verification       |
| ---------- | ------------------------------------------------------- | ------------------------------------ | ------------------ |
| 1          | `feat(api-worker): align D1 schema with Prisma model`   | schema.ts                            | wrangler d1 PRAGMA |
| 2          | `feat(api-worker): add points route`                    | points.ts, index.ts                  | curl /points/\*    |
| 3          | `feat(api-worker): add reviews route`                   | reviews.ts, index.ts                 | curl /reviews/\*   |
| 4          | `feat(api-worker): add FAS route`                       | fas.ts, index.ts                     | curl /fas/\*       |
| 5          | `feat(api-worker): add sites join and stats`            | sites.ts                             | curl /sites/join   |
| 6          | `feat(api-worker): add memberships, stats endpoints`    | users.ts, posts.ts, attendance.ts    | curl endpoints     |
| 7          | `feat(api-worker): add admin lock/unlock, vote results` | admin.ts, votes.ts                   | curl endpoints     |
| 8          | `refactor(api-worker): standardize response format`     | lib/response.ts, routes/\*.ts        | grep responses     |
| 9          | `chore(api-worker): add DO rate limiter stub`           | durable-objects/\*.ts, wrangler.toml | file exists        |

---

## Success Criteria

### Verification Commands

```bash
# All P0 endpoints respond
curl -s http://localhost:8787/points/balance && echo "✓ Points"
curl -s http://localhost:8787/reviews -X POST && echo "✓ Reviews"
curl -s http://localhost:8787/fas/workers/sync -X POST && echo "✓ FAS"
curl -s http://localhost:8787/sites/join -X POST && echo "✓ Join"
curl -s http://localhost:8787/sites/test/stats && echo "✓ Stats"

# Schema alignment verified
wrangler d1 execute safework2-db --local --command "PRAGMA table_info(sites)" | grep join_code

# TypeScript compiles
cd apps/api-worker && npx tsc --noEmit && echo "✓ Types"
```

### Final Checklist

- [ ] All 10 P0 endpoints implemented and responding
- [ ] All 6 P1 endpoints implemented and responding
- [ ] D1 schema aligned with Prisma (no missing columns)
- [ ] Response format consistent across all routes
- [ ] TypeScript compiles without errors
- [ ] Durable Objects stub in place
- [ ] All commits made with conventional commit messages
