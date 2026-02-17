# SafetyWallet Sprint 1: Foundation Setup

## TL;DR

> **Quick Summary**: Set up the complete monorepo foundation for SafetyWallet PWA including Turborepo config, Docker infrastructure, NestJS API scaffold, Prisma schema with 11 entities, two Next.js app scaffolds (worker + admin), shared UI library, and CI/CD pipeline.
>
> **Deliverables**:
>
> - pnpm + Turborepo monorepo with 3 apps and 3 packages
> - Docker Compose with PostgreSQL 15, Redis 7, MinIO
> - NestJS API with core modules (auth, users, sites, posts)
> - Prisma schema for all 12 entities
> - Next.js worker app with PWA manifest
> - Next.js admin app scaffold
> - Shared UI library with 8 shadcn/ui components
> - GitHub Actions CI pipeline (lint, typecheck, build)
>
> **Estimated Effort**: Large (8 tasks, ~3-4 days for full team)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3/4/5/6/7 → Task 8

---

## Context

### Original Request

Create a detailed parallel execution plan for Sprint 1 (Foundation) of SafetyWallet - a construction site safety reporting PWA. The foundation includes repository setup, Docker infrastructure, backend/frontend scaffolds, and CI/CD.

### Interview Summary

**Key Discussions**:

- Tech stack confirmed: Next.js 14, NestJS, Prisma, PostgreSQL, Redis, MinIO
- Monorepo structure: pnpm + Turborepo with apps/ and packages/ directories
- Test strategy: Include setup (Jest for NestJS, Vitest for Next.js)
- Auth approach: Mock auth for Sprint 1, defer real implementation

**Decisions Made**:

1. Prisma schema: Design from 12 listed entities
2. Tests: Set up infrastructure, not in CI yet
3. CI/CD: Lint + Type-check + Build only
4. UI: Core shadcn components (Button, Input, Card, Form, Dialog, Toast, Avatar, Badge)
5. Auth: Mock implementation for Sprint 1

### Self-Applied Gap Analysis

**Identified Gaps** (addressed):

- Missing Node.js version specification → Using Node 20 LTS
- Missing pnpm version → Using pnpm 9.x
- Missing port allocations → API: 3001, Worker: 3000, Admin: 3002, PG: 5432, Redis: 6379, MinIO: 9000/9001
- Missing env var strategy → .env.example files with docker defaults

---

## Work Objectives

### Core Objective

Establish the complete development foundation so Sprint 2 can immediately begin feature implementation without infrastructure concerns.

### Concrete Deliverables

- `/package.json` - Turborepo root with workspace config
- `/turbo.json` - Build pipeline configuration
- `/docker/docker-compose.yml` - Local dev infrastructure
- `/apps/api/` - NestJS application with core modules
- `/apps/worker/` - Next.js PWA for construction workers
- `/apps/admin/` - Next.js admin dashboard
- `/packages/database/` - Prisma schema and client
- `/packages/types/` - Shared TypeScript types
- `/packages/ui/` - Shared shadcn/ui components
- `/.github/workflows/ci.yml` - GitHub Actions pipeline

### Definition of Done

- [ ] `pnpm install` succeeds from root
- [ ] `pnpm turbo build` builds all packages and apps
- [ ] `docker compose up -d` starts all services
- [ ] `pnpm turbo lint` passes
- [ ] `pnpm turbo typecheck` passes
- [ ] Worker app loads at localhost:3000
- [ ] Admin app loads at localhost:3002
- [ ] API responds at localhost:3001/health

### Must Have

- All 12 database entities in Prisma schema
- PWA manifest and service worker setup for worker app
- Shared types package consumed by all apps
- Test infrastructure configured (not necessarily tests written)

### Must NOT Have (Guardrails)

- ❌ Real authentication implementation (use mock)
- ❌ Real SMS/OTP integration
- ❌ Production deployment configuration
- ❌ Actual test cases (just infrastructure)
- ❌ Database migrations applied to production
- ❌ MinIO bucket policies (defer to Sprint 2)
- ❌ API rate limiting (defer)
- ❌ Logging infrastructure beyond console

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> The executing agent verifies using tools (Bash, Playwright, curl).

### Test Decision

- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: Set up infrastructure only
- **Framework**: Jest (NestJS), Vitest + testing-library (Next.js)

### Test Setup (deferred to individual tasks)

Each app will include test config but no test cases in Sprint 1.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Monorepo + Docker setup [no dependencies]

Wave 2 (After Wave 1):
├── Task 2: Prisma schema + packages/database [depends: 1]
├── Task 3: Shared types package [depends: 1]
├── Task 4: Shared UI package [depends: 1]
├── Task 5: NestJS API scaffold [depends: 1]
├── Task 6: Next.js Worker app [depends: 1]
└── Task 7: Next.js Admin app [depends: 1]

Wave 3 (After Wave 2):
└── Task 8: CI/CD Pipeline [depends: 1-7]

Critical Path: Task 1 → Task 2 → Task 8
Parallel Speedup: ~60% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks      | Can Parallelize With     |
| ---- | ---------- | ----------- | ------------------------ |
| 1    | None       | 2,3,4,5,6,7 | None (first)             |
| 2    | 1          | 5,8         | 3,4,6,7                  |
| 3    | 1          | 5,6,7,8     | 2,4,5,6,7                |
| 4    | 1          | 6,7,8       | 2,3,5,6,7                |
| 5    | 1,2,3      | 8           | 6,7 (after 2,3 complete) |
| 6    | 1,3,4      | 8           | 5,7 (after 3,4 complete) |
| 7    | 1,3,4      | 8           | 5,6 (after 3,4 complete) |
| 8    | 1-7        | None        | None (final)             |

### Agent Dispatch Summary

| Wave | Tasks       | Recommended Approach                                    |
| ---- | ----------- | ------------------------------------------------------- |
| 1    | 1           | Single agent, sequential                                |
| 2    | 2,3,4,5,6,7 | 6 parallel agents, run_in_background=true, wait for all |
| 3    | 8           | Single agent after all complete                         |

---

## TODOs

---

### Task 1: Monorepo + Docker Infrastructure Setup

**What to do**:

- Initialize pnpm workspace with Turborepo
- Create root package.json with workspace configuration
- Create turbo.json with build pipeline
- Set up Docker Compose with PostgreSQL 15, Redis 7, MinIO
- Create .env.example with all required environment variables
- Create .gitignore, .nvmrc, .npmrc files
- Initialize git repository

**Must NOT do**:

- Install app-specific dependencies (defer to app tasks)
- Create Prisma schema (separate task)
- Set up CI/CD (separate task)

**Recommended Agent Profile**:

- **Category**: `quick`
  - Reason: Boilerplate setup with known patterns, no complex logic
- **Skills**: [`git-master`]
  - `git-master`: Initial git setup with proper .gitignore

**Parallelization**:

- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 1 (solo)
- **Blocks**: Tasks 2,3,4,5,6,7
- **Blocked By**: None

**References**:

- Turborepo docs: https://turbo.build/repo/docs
- pnpm workspace: https://pnpm.io/workspaces

**Files to Create** (12 files):

---

#### File 1: `/package.json`

```json
{
  "name": "safetywallet",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:generate": "pnpm --filter @safetywallet/database generate",
    "db:push": "pnpm --filter @safetywallet/database db:push",
    "db:studio": "pnpm --filter @safetywallet/database studio",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "docker:logs": "docker compose -f docker/docker-compose.yml logs -f"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "turbo": "^2.3.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

#### File 2: `/pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

#### File 3: `/turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV", "DATABASE_URL", "REDIS_URL"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_ENV"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

#### File 4: `/.nvmrc`

```
20
```

---

#### File 5: `/.npmrc`

```ini
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=true
```

---

#### File 6: `/.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
.turbo/
out/

# Environment
.env
.env.local
.env.*.local
!.env.example

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# Prisma
packages/database/node_modules/.prisma/

# Docker volumes (if mounted locally)
docker/data/

# Misc
*.tsbuildinfo
```

---

#### File 7: `/.env.example`

```bash
# Node
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL="postgresql://safetywallet:safetywallet_dev@localhost:5432/safetywallet?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO (S3-compatible storage)
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="safetywallet_minio"
MINIO_SECRET_KEY="safetywallet_minio_secret"
MINIO_BUCKET="safetywallet-uploads"
MINIO_USE_SSL=false

# API
API_PORT=3001
API_URL="http://localhost:3001"

# Worker App (PWA)
NEXT_PUBLIC_API_URL="http://localhost:3001"
WORKER_PORT=3000

# Admin App
ADMIN_PORT=3002

# JWT (for future auth)
JWT_SECRET="dev-secret-change-in-production"
JWT_EXPIRES_IN="7d"
```

---

#### File 8: `/docker/docker-compose.yml`

```yaml
version: "3.8"

services:
  postgresql:
    image: postgres:15-alpine
    container_name: safetywallet-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-safetywallet}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-safetywallet_dev}
      POSTGRES_DB: ${POSTGRES_DB:-safetywallet}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-safetywallet}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: safetywallet-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes

  minio:
    image: minio/minio:latest
    container_name: safetywallet-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-safetywallet_minio}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-safetywallet_minio_secret}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: server /data --console-address ":9001"

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  minio_data:
    driver: local

networks:
  default:
    name: safetywallet-network
```

---

#### File 9: `/docker/.env.example`

```bash
# PostgreSQL
POSTGRES_USER=safetywallet
POSTGRES_PASSWORD=safetywallet_dev
POSTGRES_DB=safetywallet
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# MinIO
MINIO_ROOT_USER=safetywallet_minio
MINIO_ROOT_PASSWORD=safetywallet_minio_secret
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
```

---

#### File 10: `/apps/.gitkeep`

```
# This directory contains application packages:
# - api/     - NestJS backend API
# - worker/  - Next.js PWA for construction workers
# - admin/   - Next.js admin dashboard
```

---

#### File 11: `/packages/.gitkeep`

```
# This directory contains shared packages:
# - database/  - Prisma schema and client
# - types/     - Shared TypeScript types and DTOs
# - ui/        - Shared UI components (shadcn/ui)
```

---

#### File 12: `/.sisyphus/evidence/.gitkeep`

```
# QA evidence artifacts (screenshots, logs) are stored here
```

---

**Execution Commands**:

```bash
# Step 1: Create directory structure
mkdir -p /home/jclee/dev/safework2/{apps,packages,docker,.sisyphus/evidence,.github/workflows}

# Step 2: Initialize git repository
cd /home/jclee/dev/safework2
git init

# Step 3: Create all files (use Write tool for each file above)

# Step 4: Copy docker env and start services
cd docker
cp .env.example .env
docker compose up -d

# Step 5: Verify services are running
docker compose ps
docker compose exec -T postgresql pg_isready -U safetywallet
docker compose exec -T redis redis-cli ping
curl -s http://localhost:9000/minio/health/live

# Step 6: Install root dependencies
cd /home/jclee/dev/safework2
pnpm install

# Step 7: Commit initial setup
git add .
git commit -m "chore: initialize monorepo with Turborepo and Docker infrastructure"
```

**Acceptance Criteria**:

```
Scenario: Monorepo structure is valid
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2
    2. cat package.json | jq '.workspaces'
    3. Assert: workspaces array contains "apps/*", "packages/*"
    4. cat pnpm-workspace.yaml
    5. Assert: packages includes "apps/*" and "packages/*"
  Expected Result: Workspace config is correct
  Evidence: Command output captured

Scenario: Docker services start successfully
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2/docker
    2. cp .env.example .env
    3. docker compose up -d
    4. sleep 5
    5. docker compose ps --format json
    6. Assert: postgresql, redis, minio containers are "running"
    7. docker compose exec -T postgresql pg_isready -U safetywallet
    8. Assert: exit code 0
    9. docker compose exec -T redis redis-cli ping
    10. Assert: output is "PONG"
    11. curl -s http://localhost:9000/minio/health/live
    12. Assert: status 200
    13. docker compose down
  Expected Result: All 3 services healthy
  Evidence: docker compose ps output, health check responses

Scenario: Node version file exists
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/.nvmrc
    2. Assert: contains "20" (Node 20 LTS)
  Expected Result: Node version specified
  Evidence: .nvmrc content
```

**Commit**: YES

- Message: `chore: initialize monorepo with Turborepo and Docker infrastructure`
- Files: All files listed above
- Pre-commit: `docker compose -f docker/docker-compose.yml config`

---

### Task 2: Prisma Schema + Database Package

**What to do**:

- Create packages/database with Prisma setup
- Design complete schema with all 11 entities
- Configure Prisma client generation
- Add database package to workspace
- Create seed script placeholder

**Must NOT do**:

- Run migrations against any database
- Create actual seed data
- Set up database connection pooling (defer)

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: Schema design requires careful thought about relationships, indexes, enums
- **Skills**: []
  - No special skills needed, deep category handles complexity

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Tasks 3,4,5,6,7)
- **Blocks**: Task 5 (API needs Prisma), Task 8
- **Blocked By**: Task 1

**References**:

- Prisma schema docs: https://www.prisma.io/docs/concepts/components/prisma-schema
- Prisma with NestJS: https://docs.nestjs.com/recipes/prisma

**Files to Create**:

```
/packages/database/package.json
/packages/database/tsconfig.json
/packages/database/prisma/schema.prisma
/packages/database/src/index.ts
/packages/database/src/client.ts
/packages/database/src/seed.ts
```

**Schema Entities** (12 total):

1. **User** - id, phone (encrypted), name (encrypted), role enum, status, createdAt, updatedAt
2. **Site** - id, name, address, joinCode (unique), status, createdAt
3. **SiteMembership** - id, userId, siteId, role enum, joinedAt, leftAt
4. **Post** - id, siteId, authorId, category enum, visibilityState enum, resolutionState enum, content, location, createdAt
5. **PostImage** - id, postId, url, order, createdAt
6. **Review** - id, postId, reviewerId, decision enum, comment, createdAt
7. **Action** - id, postId, assigneeId, description, status enum, dueDate, completedAt
8. **ActionImage** - id, actionId, url, createdAt
9. **PointsLedger** - id, userId, siteId, points, reason enum, referenceId, createdAt (immutable)
10. **Notification** - id, userId, type enum, title, body, read, data json, createdAt
11. **Announcement** - id, siteId, authorId, title, content, priority enum, expiresAt, createdAt
12. **AuditLog** - id, userId, action, entityType, entityId, oldValue json, newValue json, createdAt

**Acceptance Criteria**:

```
Scenario: Prisma schema is valid
  Tool: Bash
  Preconditions: Task 1 complete, pnpm available
  Steps:
    1. cd /home/jclee/dev/safework2
    2. pnpm install
    3. cd packages/database
    4. npx prisma validate
    5. Assert: exit code 0, "The schema is valid"
  Expected Result: Schema validates without errors
  Evidence: prisma validate output

Scenario: Prisma client generates
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2/packages/database
    2. npx prisma generate
    3. Assert: exit code 0
    4. ls node_modules/.prisma/client
    5. Assert: index.d.ts exists
  Expected Result: Client generated successfully
  Evidence: Generated client files exist

Scenario: All 12 entities exist in schema
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/packages/database/prisma/schema.prisma
    2. Assert: contains "model User"
    3. Assert: contains "model Site"
    4. Assert: contains "model SiteMembership"
    5. Assert: contains "model Post"
    6. Assert: contains "model PostImage"
    7. Assert: contains "model Review"
    8. Assert: contains "model Action"
    9. Assert: contains "model ActionImage"
    10. Assert: contains "model PointsLedger"
    11. Assert: contains "model Notification"
    12. Assert: contains "model Announcement"
    13. Assert: contains "model AuditLog"
  Expected Result: All entities defined
  Evidence: Schema file content

Scenario: Package exports Prisma client
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/packages/database/src/index.ts
    2. Assert: exports PrismaClient or prisma instance
  Expected Result: Client is exported for consumption
  Evidence: index.ts content
```

**Commit**: YES (groups with Wave 2)

- Message: `feat(database): add Prisma schema with all 11 entities`
- Files: packages/database/\*\*
- Pre-commit: `cd packages/database && npx prisma validate`

---

### Task 3: Shared Types Package

**What to do**:

- Create packages/types with shared TypeScript types
- Define DTOs, enums, and interfaces used across apps
- Configure TypeScript for library output
- Export all types from index

**Must NOT do**:

- Duplicate Prisma-generated types (import from @safetywallet/database)
- Include runtime code (types only)
- Add validation logic (that's for apps)

**Recommended Agent Profile**:

- **Category**: `quick`
  - Reason: Simple TypeScript setup with type definitions only
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Tasks 5,6,7,8
- **Blocked By**: Task 1

**Files to Create**:

```
/packages/types/package.json
/packages/types/tsconfig.json
/packages/types/src/index.ts
/packages/types/src/enums.ts
/packages/types/src/dto/index.ts
/packages/types/src/dto/user.dto.ts
/packages/types/src/dto/site.dto.ts
/packages/types/src/dto/post.dto.ts
/packages/types/src/dto/auth.dto.ts
/packages/types/src/api-response.ts
```

**Types to Define**:

- Enums: UserRole, UserStatus, SiteStatus, PostCategory, VisibilityState, ResolutionState, ReviewDecision, ActionStatus, PointsReason, NotificationType, AnnouncementPriority
- DTOs: CreateUserDto, UpdateUserDto, CreateSiteDto, CreatePostDto, LoginRequestDto, LoginResponseDto, ApiResponse<T>, PaginatedResponse<T>

**Acceptance Criteria**:

```
Scenario: Types package builds
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2
    2. pnpm install
    3. pnpm --filter @safetywallet/types build
    4. Assert: exit code 0
    5. ls packages/types/dist
    6. Assert: index.js and index.d.ts exist
  Expected Result: Package compiles to JS + type declarations
  Evidence: dist/ contents

Scenario: All enums are exported
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/packages/types/src/enums.ts
    2. Assert: contains "export enum UserRole"
    3. Assert: contains "export enum PostCategory"
    4. Assert: contains "export enum VisibilityState"
    5. Assert: contains "export enum ResolutionState"
  Expected Result: Core enums defined
  Evidence: enums.ts content
```

**Commit**: YES (groups with Wave 2)

- Message: `feat(types): add shared TypeScript types and DTOs`
- Files: packages/types/\*\*
- Pre-commit: `pnpm --filter @safetywallet/types build`

---

### Task 4: Shared UI Package (shadcn/ui)

**What to do**:

- Create packages/ui with React component library
- Set up Tailwind CSS configuration
- Add 8 core shadcn/ui components: Button, Input, Card, Form, Dialog, Toast, Avatar, Badge
- Configure component exports
- Add Storybook (optional, nice-to-have)

**Must NOT do**:

- Create custom components (just shadcn primitives)
- Add application-specific styling
- Include business logic

**Recommended Agent Profile**:

- **Category**: `visual-engineering`
  - Reason: UI component library setup with Tailwind/shadcn
- **Skills**: [`frontend-ui-ux`]
  - `frontend-ui-ux`: shadcn/ui patterns and Tailwind configuration

**Parallelization**:

- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Tasks 6,7,8
- **Blocked By**: Task 1

**Files to Create**:

```
/packages/ui/package.json
/packages/ui/tsconfig.json
/packages/ui/tailwind.config.ts
/packages/ui/postcss.config.js
/packages/ui/src/index.ts
/packages/ui/src/styles/globals.css
/packages/ui/src/components/button.tsx
/packages/ui/src/components/input.tsx
/packages/ui/src/components/card.tsx
/packages/ui/src/components/form.tsx
/packages/ui/src/components/dialog.tsx
/packages/ui/src/components/toast.tsx
/packages/ui/src/components/avatar.tsx
/packages/ui/src/components/badge.tsx
/packages/ui/src/lib/utils.ts
```

**Acceptance Criteria**:

```
Scenario: UI package builds
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2
    2. pnpm install
    3. pnpm --filter @safetywallet/ui build
    4. Assert: exit code 0
  Expected Result: Package compiles without errors
  Evidence: Build output

Scenario: All 8 components are exported
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/packages/ui/src/index.ts
    2. Assert: exports Button
    3. Assert: exports Input
    4. Assert: exports Card (or CardHeader, CardContent, etc.)
    5. Assert: exports Form (or FormField, FormItem, etc.)
    6. Assert: exports Dialog
    7. Assert: exports Toast (or Toaster, useToast)
    8. Assert: exports Avatar
    9. Assert: exports Badge
  Expected Result: All core components exported
  Evidence: index.ts content

Scenario: Tailwind config includes shadcn presets
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/packages/ui/tailwind.config.ts
    2. Assert: contains theme extension with colors
    3. Assert: contains animation keyframes
  Expected Result: shadcn theming configured
  Evidence: tailwind.config.ts content
```

**Commit**: YES (groups with Wave 2)

- Message: `feat(ui): add shared UI library with shadcn/ui components`
- Files: packages/ui/\*\*
- Pre-commit: `pnpm --filter @safetywallet/ui build`

---

### Task 5: NestJS API Scaffold

**What to do**:

- Create apps/api with NestJS application
- Set up core modules: App, Auth, Users, Sites, Posts
- Configure Prisma integration
- Add health check endpoint
- Set up Jest for testing (config only)
- Configure CORS, validation pipes, swagger

**Must NOT do**:

- Implement real authentication (mock only)
- Create actual business logic beyond scaffolding
- Connect to production database
- Write actual test cases (setup only)

**Recommended Agent Profile**:

- **Category**: `deep`
  - Reason: NestJS module architecture requires understanding of DI, decorators, and patterns
- **Skills**: []

**Parallelization**:

- **Can Run In Parallel**: YES (after Tasks 2,3 complete)
- **Parallel Group**: Wave 2 (late start)
- **Blocks**: Task 8
- **Blocked By**: Tasks 1, 2 (Prisma), 3 (types)

**Files to Create**:

```
/apps/api/package.json
/apps/api/tsconfig.json
/apps/api/tsconfig.build.json
/apps/api/nest-cli.json
/apps/api/jest.config.js
/apps/api/.env.example
/apps/api/src/main.ts
/apps/api/src/app.module.ts
/apps/api/src/app.controller.ts
/apps/api/src/app.service.ts
/apps/api/src/common/prisma/prisma.module.ts
/apps/api/src/common/prisma/prisma.service.ts
/apps/api/src/modules/auth/auth.module.ts
/apps/api/src/modules/auth/auth.controller.ts
/apps/api/src/modules/auth/auth.service.ts
/apps/api/src/modules/auth/guards/auth.guard.ts
/apps/api/src/modules/users/users.module.ts
/apps/api/src/modules/users/users.controller.ts
/apps/api/src/modules/users/users.service.ts
/apps/api/src/modules/sites/sites.module.ts
/apps/api/src/modules/sites/sites.controller.ts
/apps/api/src/modules/sites/sites.service.ts
/apps/api/src/modules/posts/posts.module.ts
/apps/api/src/modules/posts/posts.controller.ts
/apps/api/src/modules/posts/posts.service.ts
```

**Acceptance Criteria**:

```
Scenario: NestJS app compiles
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2
    2. pnpm install
    3. pnpm --filter @safetywallet/api build
    4. Assert: exit code 0
    5. ls apps/api/dist
    6. Assert: main.js exists
  Expected Result: App compiles to dist/
  Evidence: dist/ contents

Scenario: Health endpoint responds
  Tool: Bash
  Preconditions: Docker services running
  Steps:
    1. cd /home/jclee/dev/safework2/apps/api
    2. cp .env.example .env
    3. pnpm start:dev &
    4. sleep 5
    5. curl -s http://localhost:3001/health
    6. Assert: response contains "ok" or status 200
    7. pkill -f "nest start"
  Expected Result: /health returns OK
  Evidence: curl response

Scenario: All core modules exist
  Tool: Bash
  Steps:
    1. ls /home/jclee/dev/safework2/apps/api/src/modules/
    2. Assert: auth/ directory exists
    3. Assert: users/ directory exists
    4. Assert: sites/ directory exists
    5. Assert: posts/ directory exists
  Expected Result: Core modules scaffolded
  Evidence: Directory listing

Scenario: Prisma service is injectable
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/apps/api/src/common/prisma/prisma.service.ts
    2. Assert: contains "@Injectable()"
    3. Assert: contains "extends PrismaClient"
  Expected Result: Prisma configured for DI
  Evidence: prisma.service.ts content

Scenario: Jest is configured
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/apps/api/jest.config.js
    2. Assert: contains "moduleFileExtensions"
    3. Assert: contains "testRegex" or "testMatch"
    4. pnpm --filter @safetywallet/api test --passWithNoTests
    5. Assert: exit code 0
  Expected Result: Jest runs (even with no tests)
  Evidence: Jest output
```

**Commit**: YES (groups with Wave 2)

- Message: `feat(api): scaffold NestJS application with core modules`
- Files: apps/api/\*\*
- Pre-commit: `pnpm --filter @safetywallet/api build`

---

### Task 6: Next.js Worker App (PWA)

**What to do**:

- Create apps/worker with Next.js 14 App Router
- Configure PWA with next-pwa (manifest, service worker)
- Set up Tailwind CSS with shared UI package
- Create basic layout with mobile-first design
- Add Zustand store setup
- Add React Hook Form + Zod setup
- Configure Vitest for testing
- Create mock auth context

**Must NOT do**:

- Implement actual features (just scaffolding)
- Connect to real API
- Create actual pages beyond layout and home

**Recommended Agent Profile**:

- **Category**: `visual-engineering`
  - Reason: PWA setup with mobile-first Next.js requires UI expertise
- **Skills**: [`frontend-ui-ux`, `playwright`]
  - `frontend-ui-ux`: Next.js App Router patterns, PWA configuration
  - `playwright`: Browser verification of PWA manifest

**Parallelization**:

- **Can Run In Parallel**: YES (after Tasks 3,4 complete)
- **Parallel Group**: Wave 2 (late start)
- **Blocks**: Task 8
- **Blocked By**: Tasks 1, 3 (types), 4 (UI)

**Files to Create**:

```
/apps/worker/package.json
/apps/worker/tsconfig.json
/apps/worker/next.config.js
/apps/worker/tailwind.config.ts
/apps/worker/postcss.config.js
/apps/worker/vitest.config.ts
/apps/worker/.env.example
/apps/worker/public/manifest.json
/apps/worker/public/icons/icon-192.png (placeholder)
/apps/worker/public/icons/icon-512.png (placeholder)
/apps/worker/src/app/layout.tsx
/apps/worker/src/app/page.tsx
/apps/worker/src/app/globals.css
/apps/worker/src/components/providers.tsx
/apps/worker/src/stores/auth.store.ts
/apps/worker/src/stores/app.store.ts
/apps/worker/src/lib/api.ts
/apps/worker/src/contexts/auth-context.tsx
```

**Acceptance Criteria**:

```
Scenario: Worker app builds
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2
    2. pnpm install
    3. pnpm --filter @safetywallet/worker build
    4. Assert: exit code 0
    5. ls apps/worker/.next
    6. Assert: .next directory exists
  Expected Result: Next.js builds successfully
  Evidence: Build output

Scenario: Worker app serves with PWA manifest
  Tool: Playwright (playwright skill)
  Steps:
    1. Start dev server: pnpm --filter @safetywallet/worker dev &
    2. Navigate to: http://localhost:3000
    3. Wait for: page load complete
    4. Fetch: http://localhost:3000/manifest.json
    5. Assert: manifest has "name" field
    6. Assert: manifest has "icons" array
    7. Assert: manifest has "start_url"
    8. Screenshot: .sisyphus/evidence/task-6-pwa-manifest.png
  Expected Result: PWA manifest accessible
  Evidence: .sisyphus/evidence/task-6-pwa-manifest.png

Scenario: Shared UI components work
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/apps/worker/src/app/page.tsx
    2. Assert: imports from "@safetywallet/ui"
    3. Assert: uses at least one component (Button, Card, etc.)
  Expected Result: UI package integrated
  Evidence: page.tsx content

Scenario: Zustand store exists
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/apps/worker/src/stores/auth.store.ts
    2. Assert: contains "create" from "zustand"
    3. Assert: exports a store hook (useAuthStore or similar)
  Expected Result: State management configured
  Evidence: auth.store.ts content

Scenario: Vitest is configured
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/apps/worker/vitest.config.ts
    2. Assert: contains vitest config
    3. pnpm --filter @safetywallet/worker test --passWithNoTests
    4. Assert: exit code 0
  Expected Result: Vitest runs
  Evidence: Test output
```

**Commit**: YES (groups with Wave 2)

- Message: `feat(worker): scaffold Next.js PWA for construction workers`
- Files: apps/worker/\*\*
- Pre-commit: `pnpm --filter @safetywallet/worker build`

---

### Task 7: Next.js Admin App

**What to do**:

- Create apps/admin with Next.js 14 App Router
- Set up Tailwind CSS with shared UI package
- Create admin layout with sidebar navigation placeholder
- Add Zustand store setup
- Configure Vitest for testing
- Create mock auth context (admin role)

**Must NOT do**:

- Implement actual admin features
- Create real dashboard pages
- Connect to real API

**Recommended Agent Profile**:

- **Category**: `visual-engineering`
  - Reason: Admin dashboard scaffold with layout patterns
- **Skills**: [`frontend-ui-ux`]
  - `frontend-ui-ux`: Next.js App Router patterns, admin layout design

**Parallelization**:

- **Can Run In Parallel**: YES (after Tasks 3,4 complete)
- **Parallel Group**: Wave 2 (late start)
- **Blocks**: Task 8
- **Blocked By**: Tasks 1, 3 (types), 4 (UI)

**Files to Create**:

```
/apps/admin/package.json
/apps/admin/tsconfig.json
/apps/admin/next.config.js
/apps/admin/tailwind.config.ts
/apps/admin/postcss.config.js
/apps/admin/vitest.config.ts
/apps/admin/.env.example
/apps/admin/src/app/layout.tsx
/apps/admin/src/app/page.tsx
/apps/admin/src/app/globals.css
/apps/admin/src/components/providers.tsx
/apps/admin/src/components/sidebar.tsx
/apps/admin/src/stores/auth.store.ts
/apps/admin/src/contexts/auth-context.tsx
```

**Acceptance Criteria**:

```
Scenario: Admin app builds
  Tool: Bash
  Steps:
    1. cd /home/jclee/dev/safework2
    2. pnpm install
    3. pnpm --filter @safetywallet/admin build
    4. Assert: exit code 0
    5. ls apps/admin/.next
    6. Assert: .next directory exists
  Expected Result: Next.js builds successfully
  Evidence: Build output

Scenario: Admin app serves on port 3002
  Tool: Playwright (playwright skill)
  Steps:
    1. Start dev server: PORT=3002 pnpm --filter @safetywallet/admin dev &
    2. Navigate to: http://localhost:3002
    3. Wait for: body visible
    4. Assert: page title or heading present
    5. Screenshot: .sisyphus/evidence/task-7-admin-home.png
  Expected Result: Admin app loads
  Evidence: .sisyphus/evidence/task-7-admin-home.png

Scenario: Shared UI components work
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/apps/admin/src/app/layout.tsx
    2. Assert: imports from "@safetywallet/ui"
  Expected Result: UI package integrated
  Evidence: layout.tsx content

Scenario: Vitest is configured
  Tool: Bash
  Steps:
    1. pnpm --filter @safetywallet/admin test --passWithNoTests
    2. Assert: exit code 0
  Expected Result: Vitest runs
  Evidence: Test output
```

**Commit**: YES (groups with Wave 2)

- Message: `feat(admin): scaffold Next.js admin dashboard`
- Files: apps/admin/\*\*
- Pre-commit: `pnpm --filter @safetywallet/admin build`

---

### Task 8: CI/CD Pipeline (GitHub Actions)

**What to do**:

- Create GitHub Actions workflow for CI
- Configure: lint, typecheck, build for all packages/apps
- Use Turborepo's remote caching (optional)
- Add PR trigger and push to main trigger

**Must NOT do**:

- Set up deployment (defer to later sprint)
- Add test execution (tests not written yet)
- Configure secrets for production

**Recommended Agent Profile**:

- **Category**: `quick`
  - Reason: Standard GitHub Actions boilerplate
- **Skills**: [`git-master`]
  - `git-master`: Git workflow and CI configuration

**Parallelization**:

- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3 (final)
- **Blocks**: None
- **Blocked By**: Tasks 1-7 (needs all apps to verify build)

**Files to Create**:

```
/.github/workflows/ci.yml
/.github/dependabot.yml (optional)
```

**Acceptance Criteria**:

```
Scenario: CI workflow file is valid YAML
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/.github/workflows/ci.yml
    2. Assert: contains "name:"
    3. Assert: contains "on:" with "push" and "pull_request"
    4. Assert: contains "jobs:"
    5. python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
    6. Assert: exit code 0 (valid YAML)
  Expected Result: Valid workflow file
  Evidence: ci.yml content

Scenario: CI workflow includes all quality checks
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/.github/workflows/ci.yml
    2. Assert: contains "pnpm install" or "pnpm i"
    3. Assert: contains "lint" command
    4. Assert: contains "typecheck" or "type-check" command
    5. Assert: contains "build" command
  Expected Result: lint, typecheck, build steps present
  Evidence: ci.yml content

Scenario: CI uses correct Node version
  Tool: Bash
  Steps:
    1. cat /home/jclee/dev/safework2/.github/workflows/ci.yml
    2. Assert: contains "node-version" with "20" or references .nvmrc
  Expected Result: Node 20 specified
  Evidence: ci.yml content
```

**Commit**: YES

- Message: `ci: add GitHub Actions workflow for lint, typecheck, and build`
- Files: .github/\*\*
- Pre-commit: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`

---

## Commit Strategy

| After Task  | Message                                                | Files               | Verification          |
| ----------- | ------------------------------------------------------ | ------------------- | --------------------- |
| 1           | `chore: initialize monorepo with Turborepo and Docker` | root files, docker/ | docker compose config |
| 2-7 (batch) | Individual commits per task                            | Each app/package    | turbo build           |
| 8           | `ci: add GitHub Actions workflow`                      | .github/            | YAML validation       |

**Final verification after all tasks:**

```bash
cd /home/jclee/dev/safework2
pnpm install
pnpm turbo build
pnpm turbo lint
pnpm turbo typecheck
```

---

## Success Criteria

### Verification Commands

```bash
# All packages install
pnpm install  # Expected: success, no errors

# All apps and packages build
pnpm turbo build  # Expected: all 6 targets build successfully

# Linting passes
pnpm turbo lint  # Expected: no errors

# Type checking passes
pnpm turbo typecheck  # Expected: no errors

# Docker services start
cd docker && docker compose up -d  # Expected: 3 services running

# Prisma schema valid
cd packages/database && npx prisma validate  # Expected: "The schema is valid"

# API health check
curl http://localhost:3001/health  # Expected: {"status":"ok"} or similar

# Worker app loads
curl http://localhost:3000  # Expected: HTML response

# Admin app loads
curl http://localhost:3002  # Expected: HTML response
```

### Final Checklist

- [ ] Monorepo structure: apps/worker, apps/admin, apps/api, packages/database, packages/types, packages/ui
- [ ] Docker Compose: PostgreSQL 15, Redis 7, MinIO all healthy
- [ ] Prisma schema: All 12 entities defined and validated
- [ ] NestJS API: Compiles, /health responds, core modules exist
- [ ] Worker PWA: Builds, serves, manifest.json accessible
- [ ] Admin app: Builds, serves on port 3002
- [ ] Shared UI: 8 shadcn components exported
- [ ] Shared types: Enums and DTOs exported
- [ ] CI/CD: Valid GitHub Actions workflow
- [ ] All "Must NOT Have" guardrails respected
