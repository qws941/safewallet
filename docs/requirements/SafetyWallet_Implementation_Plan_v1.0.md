# ⚠️ DEPRECATED — 이 문서는 더 이상 유효하지 않습니다

> **사유**: 이 계획은 NestJS + PostgreSQL 아키텍처 기반으로 작성되었으나, 실제 구현은 Cloudflare Workers + D1 + Hono로 완전히 변경되었습니다.
>
> **현재 아키텍처 참조**: [`AGENTS.md`](../../AGENTS.md), [`docs/FEATURE_CHECKLIST.md`](../FEATURE_CHECKLIST.md), [`docs/cloudflare-operations.md`](../cloudflare-operations.md)
>
> 기록 보존 목적으로만 유지합니다.

---

# SafetyWallet Implementation Plan

> **Version**: v1.0  
> **Date**: 2025-02-05  
> **Reference**: SafetyWallet_PRD_v1.1.md  
> **Estimated Duration**: 12 weeks (MVP)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Phase Breakdown](#4-phase-breakdown)
5. [Sprint Plan](#5-sprint-plan)
6. [API Design](#6-api-design)
7. [Database Schema](#7-database-schema)
8. [Security Implementation](#8-security-implementation)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Strategy](#10-deployment-strategy)
11. [Risk Mitigation](#11-risk-mitigation)
12. [Team Structure](#12-team-structure)

---

## 1. Executive Summary

### 1.1 Project Scope

Build a mobile-first PWA for construction site safety reporting with:

- Worker app (PWA) for hazard reporting and point tracking
- Admin web app for review, action management, and analytics
- Backend API for business logic and data management

### 1.2 Key Deliverables

| Phase         | Duration | Deliverables                                                  |
| ------------- | -------- | ------------------------------------------------------------- |
| Phase 1 (MVP) | 12 weeks | Core worker/admin features, point system, basic notifications |
| Phase 2       | 6 weeks  | Analytics dashboard, multi-site, KakaoTalk integration        |
| Phase 3       | 6 weeks  | AI features, ERP integration, advanced reporting              |

### 1.3 Success Criteria

- [ ] QR-based registration working on all major mobile browsers
- [ ] Post submission with photos under 3 seconds on 3G
- [ ] Admin review queue processing 100+ posts/day
- [ ] Point ledger immutability verified
- [ ] 99.5% uptime achieved

---

## 2. Technology Stack

### 2.1 Frontend (Worker PWA)

| Layer      | Technology                           | Rationale                                 |
| ---------- | ------------------------------------ | ----------------------------------------- |
| Framework  | **Next.js 14** (App Router)          | SSR/SSG, PWA support, optimal performance |
| UI Library | **Tailwind CSS** + **shadcn/ui**     | Rapid development, consistent design      |
| State      | **Zustand**                          | Lightweight, simple API                   |
| Forms      | **React Hook Form** + **Zod**        | Validation, performance                   |
| PWA        | **next-pwa**                         | Service worker, offline support           |
| i18n       | **next-intl**                        | Multi-language support                    |
| Image      | **Browser native** + compression lib | Client-side resize before upload          |

### 2.2 Frontend (Admin Web)

| Layer      | Technology                       | Rationale                              |
| ---------- | -------------------------------- | -------------------------------------- |
| Framework  | **Next.js 14** (App Router)      | Shared codebase possible               |
| UI Library | **Tailwind CSS** + **shadcn/ui** | Consistency with worker app            |
| Tables     | **TanStack Table**               | Complex filtering, sorting, pagination |
| Charts     | **Recharts**                     | Dashboard visualizations               |
| State      | **Zustand** + **TanStack Query** | Server state management                |

### 2.3 Backend

| Layer      | Technology                                  | Rationale                                         |
| ---------- | ------------------------------------------- | ------------------------------------------------- |
| Runtime    | **Node.js 20 LTS**                          | Team familiarity, ecosystem                       |
| Framework  | **NestJS**                                  | Enterprise patterns, TypeScript, modular          |
| ORM        | **Prisma**                                  | Type-safe, migrations, excellent DX               |
| Validation | **class-validator** + **class-transformer** | DTO validation                                    |
| Auth       | **Passport.js** + **JWT**                   | Flexible auth strategies                          |
| Queue      | **BullMQ** + **Redis**                      | Background jobs (notifications, image processing) |
| Storage    | **AWS S3** / **MinIO**                      | Image storage, CDN-ready                          |

### 2.4 Database

| Component  | Technology               | Rationale                             |
| ---------- | ------------------------ | ------------------------------------- |
| Primary DB | **PostgreSQL 15**        | ACID, JSON support, mature            |
| Cache      | **Redis 7**              | Session, rate limiting, queue         |
| Search     | **PostgreSQL FTS** (MVP) | Simplicity; Elasticsearch for Phase 2 |

### 2.5 Infrastructure

| Component     | Technology                              | Rationale                         |
| ------------- | --------------------------------------- | --------------------------------- |
| Container     | **Docker** + **Docker Compose**         | Local dev, deployment consistency |
| Orchestration | **Kubernetes** (EKS/GKE) or **AWS ECS** | Production scaling                |
| CDN           | **CloudFront** / **Cloudflare**         | Static assets, images             |
| CI/CD         | **GitHub Actions**                      | Integrated, flexible              |
| Monitoring    | **Datadog** / **Grafana + Prometheus**  | Observability                     |
| Logging       | **AWS CloudWatch** / **Loki**           | Centralized logs                  |

### 2.6 External Services

| Service            | Provider                     | Purpose              |
| ------------------ | ---------------------------- | -------------------- |
| SMS OTP            | **Twilio** / **NHN Cloud**   | Phone verification   |
| Push Notifications | **Firebase Cloud Messaging** | Web push             |
| Email              | **AWS SES** / **SendGrid**   | Admin notifications  |
| Image Processing   | **Sharp** (server-side)      | Thumbnail generation |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CDN (CloudFront)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Worker PWA  │    │  Admin Web   │    │   QR Pages   │       │
│  │  (Next.js)   │    │  (Next.js)   │    │  (Next.js)   │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                     │
│                             ▼                                     │
│                 ┌───────────────────────┐                        │
│                 │    API Gateway /      │                        │
│                 │    Load Balancer      │                        │
│                 └───────────┬───────────┘                        │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   API Pod   │    │   API Pod   │    │   API Pod   │          │
│  │  (NestJS)   │    │  (NestJS)   │    │  (NestJS)   │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ PostgreSQL  │    │    Redis    │    │   S3/MinIO  │          │
│  │  (Primary)  │    │   (Cache)   │    │  (Storage)  │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   Worker Pod    │
                    │   (BullMQ)      │
                    │  - Notifications│
                    │  - Image resize │
                    │  - Reports      │
                    └─────────────────┘
```

### 3.2 Module Structure (Backend)

```
src/
├── modules/
│   ├── auth/           # Authentication, OTP, JWT
│   ├── users/          # User management, profiles
│   ├── sites/          # Site management, QR codes
│   ├── memberships/    # Site-user relationships
│   ├── posts/          # Post CRUD, state machine
│   ├── reviews/        # Review workflow
│   ├── actions/        # Action management
│   ├── points/         # Ledger, policies, ranking
│   ├── notifications/  # Push, SMS, in-app
│   ├── announcements/  # Announcement management
│   ├── admin/          # Admin-specific endpoints
│   ├── audit/          # Audit logging
│   └── storage/        # File upload, image processing
├── common/
│   ├── decorators/     # Custom decorators
│   ├── guards/         # Auth, role guards
│   ├── interceptors/   # Logging, transform
│   ├── filters/        # Exception handling
│   └── pipes/          # Validation pipes
├── config/             # Configuration
├── database/           # Prisma schema, migrations
└── main.ts
```

### 3.3 Frontend Structure (Monorepo)

```
apps/
├── worker/             # Worker PWA
│   ├── app/
│   │   ├── (auth)/     # Login, register
│   │   ├── (main)/     # Home, posts, points
│   │   └── layout.tsx
│   └── components/
├── admin/              # Admin web
│   ├── app/
│   │   ├── dashboard/
│   │   ├── posts/
│   │   ├── points/
│   │   └── settings/
│   └── components/
└── shared/             # Shared components, utils
    ├── ui/
    ├── hooks/
    └── lib/

packages/
├── api-client/         # Generated API client
├── types/              # Shared TypeScript types
└── config/             # Shared configs (ESLint, TS)
```

---

## 4. Phase Breakdown

### 4.1 Phase 1: MVP (Weeks 1-12)

#### Sprint 1-2: Foundation (Weeks 1-4)

| Area         | Tasks                                                            | Priority |
| ------------ | ---------------------------------------------------------------- | -------- |
| **Infra**    | Docker setup, CI/CD pipeline, Dev/Staging environments           | P0       |
| **Backend**  | NestJS scaffold, Prisma setup, Core modules (auth, users, sites) | P0       |
| **Frontend** | Next.js monorepo, UI component library, PWA config               | P0       |
| **Database** | Schema design, Initial migrations                                | P0       |

#### Sprint 3-4: Core Features (Weeks 5-8)

| Area       | Tasks                                                   | Priority |
| ---------- | ------------------------------------------------------- | -------- |
| **Auth**   | QR registration, SMS OTP, JWT auth, Rate limiting       | P0       |
| **Posts**  | Create post, Photo upload, State machine, My posts list | P0       |
| **Admin**  | Review queue, Approve/Reject flow, Basic dashboard      | P0       |
| **Points** | Ledger implementation, Award points, History view       | P0       |

#### Sprint 5-6: Complete MVP (Weeks 9-12)

| Area              | Tasks                                               | Priority |
| ----------------- | --------------------------------------------------- | -------- |
| **Actions**       | Assign handler, Status transitions, Evidence upload | P0       |
| **Ranking**       | Monthly ranking, Snapshot generation                | P0       |
| **Notifications** | Web push, In-app notifications                      | P0       |
| **Announcements** | CRUD, Templates                                     | P1       |
| **Audit**         | Logging implementation, PII access control          | P0       |
| **Testing**       | E2E tests, Load testing, Security audit             | P0       |

### 4.2 Phase 2: Enhancement (Weeks 13-18)

| Feature               | Description                      |
| --------------------- | -------------------------------- |
| Analytics Dashboard   | Charts, trends, hotspot analysis |
| Multi-site Membership | Workers can join multiple sites  |
| KakaoTalk Integration | Business message notifications   |
| Reward Module         | Automated distribution, tracking |
| Advanced Filters      | Elasticsearch for search         |

### 4.3 Phase 3: Scale (Weeks 19-24)

| Feature           | Description                         |
| ----------------- | ----------------------------------- |
| AI Classification | Auto-categorize hazards from photos |
| ERP Integration   | Sync with existing systems          |
| HQ Dashboard      | Cross-site analytics                |
| Mobile App        | Native apps if needed               |

---

## 5. Sprint Plan

### 5.1 Sprint 1 (Weeks 1-2): Project Setup

| Task                                      | Owner    | Days | Status |
| ----------------------------------------- | -------- | ---- | ------ |
| Repository setup (monorepo)               | DevOps   | 1    |        |
| Docker Compose (PostgreSQL, Redis, MinIO) | DevOps   | 1    |        |
| NestJS project scaffold                   | Backend  | 2    |        |
| Prisma schema (initial)                   | Backend  | 2    |        |
| Next.js worker app scaffold               | Frontend | 2    |        |
| Next.js admin app scaffold                | Frontend | 2    |        |
| UI component library setup                | Frontend | 2    |        |
| CI/CD pipeline (GitHub Actions)           | DevOps   | 2    |        |
| Dev environment deployment                | DevOps   | 1    |        |

**Deliverables**: Running dev environment, empty apps deployable

### 5.2 Sprint 2 (Weeks 3-4): Auth & Sites

| Task                           | Owner    | Days | Status |
| ------------------------------ | -------- | ---- | ------ |
| User module (CRUD, encryption) | Backend  | 3    |        |
| Site module (CRUD, join_code)  | Backend  | 2    |        |
| Membership module              | Backend  | 2    |        |
| SMS OTP service integration    | Backend  | 2    |        |
| Rate limiting (Redis)          | Backend  | 1    |        |
| JWT auth (access + refresh)    | Backend  | 2    |        |
| QR registration flow (UI)      | Frontend | 3    |        |
| Login flow (UI)                | Frontend | 2    |        |
| PWA configuration              | Frontend | 1    |        |
| Admin login (UI)               | Frontend | 1    |        |

**Deliverables**: Working registration, login, QR scanning

### 5.3 Sprint 3 (Weeks 5-6): Posts & Photos

| Task                       | Owner    | Days | Status |
| -------------------------- | -------- | ---- | ------ |
| Post module (CRUD)         | Backend  | 3    |        |
| Post state machine         | Backend  | 2    |        |
| Image upload service (S3)  | Backend  | 2    |        |
| Image compression (Sharp)  | Backend  | 1    |        |
| Thumbnail generation       | Backend  | 1    |        |
| Post creation form (UI)    | Frontend | 3    |        |
| Camera/Gallery integration | Frontend | 2    |        |
| Image compression (client) | Frontend | 1    |        |
| My posts list (UI)         | Frontend | 2    |        |
| Post detail view (UI)      | Frontend | 2    |        |

**Deliverables**: Workers can submit posts with photos

### 5.4 Sprint 4 (Weeks 7-8): Review & Points

| Task                       | Owner    | Days | Status |
| -------------------------- | -------- | ---- | ------ |
| Review module              | Backend  | 2    |        |
| Points ledger module       | Backend  | 3    |        |
| Point policy engine        | Backend  | 2    |        |
| Ranking calculation        | Backend  | 2    |        |
| Admin review queue (UI)    | Frontend | 3    |        |
| Post detail + actions (UI) | Frontend | 2    |        |
| Points history (UI)        | Frontend | 2    |        |
| Ranking display (UI)       | Frontend | 2    |        |
| Worker home screen (UI)    | Frontend | 2    |        |

**Deliverables**: Full review workflow, points awarded

### 5.5 Sprint 5 (Weeks 9-10): Actions & Notifications

| Task                          | Owner    | Days | Status |
| ----------------------------- | -------- | ---- | ------ |
| Action module                 | Backend  | 3    |        |
| Action state machine          | Backend  | 2    |        |
| Evidence upload               | Backend  | 1    |        |
| Notification service (BullMQ) | Backend  | 2    |        |
| Web push integration (FCM)    | Backend  | 2    |        |
| In-app notification storage   | Backend  | 1    |        |
| Action management (UI)        | Frontend | 3    |        |
| Evidence upload (UI)          | Frontend | 2    |        |
| Push notification handling    | Frontend | 2    |        |
| Notification center (UI)      | Frontend | 2    |        |

**Deliverables**: Actions assignable, notifications working

### 5.6 Sprint 6 (Weeks 11-12): Polish & Launch

| Task                         | Owner    | Days | Status |
| ---------------------------- | -------- | ---- | ------ |
| Announcement module          | Backend  | 2    |        |
| Audit logging                | Backend  | 2    |        |
| PII access control           | Backend  | 2    |        |
| Monthly snapshot job         | Backend  | 1    |        |
| Admin dashboard (UI)         | Frontend | 3    |        |
| Announcement management (UI) | Frontend | 2    |        |
| i18n (Korean + English)      | Frontend | 2    |        |
| E2E test suite               | QA       | 3    |        |
| Load testing                 | QA       | 2    |        |
| Security audit               | Security | 3    |        |
| Production deployment        | DevOps   | 2    |        |
| Documentation                | All      | 2    |        |

**Deliverables**: Production-ready MVP

---

## 6. API Design

### 6.1 API Conventions

| Aspect     | Convention                           |
| ---------- | ------------------------------------ |
| Base URL   | `/api/v1`                            |
| Auth       | Bearer JWT in `Authorization` header |
| Pagination | `?page=1&limit=20`                   |
| Filtering  | `?status=RECEIVED&category=HAZARD`   |
| Sorting    | `?sort=createdAt&order=desc`         |
| Errors     | RFC 7807 Problem Details             |
| Dates      | ISO 8601 (UTC)                       |

### 6.2 Core Endpoints

#### Authentication

| Method | Endpoint           | Description               |
| ------ | ------------------ | ------------------------- |
| `POST` | `/auth/register`   | Register with phone + OTP |
| `POST` | `/auth/otp/send`   | Request OTP               |
| `POST` | `/auth/otp/verify` | Verify OTP                |
| `POST` | `/auth/login`      | Login (phone + OTP)       |
| `POST` | `/auth/refresh`    | Refresh tokens            |
| `POST` | `/auth/logout`     | Invalidate tokens         |

#### Users

| Method  | Endpoint                | Description              |
| ------- | ----------------------- | ------------------------ |
| `GET`   | `/users/me`             | Get current user profile |
| `PATCH` | `/users/me`             | Update profile           |
| `GET`   | `/users/me/memberships` | Get site memberships     |

#### Sites (Admin)

| Method  | Endpoint                     | Description          |
| ------- | ---------------------------- | -------------------- |
| `GET`   | `/sites`                     | List sites           |
| `POST`  | `/sites`                     | Create site          |
| `GET`   | `/sites/:id`                 | Get site details     |
| `PATCH` | `/sites/:id`                 | Update site          |
| `POST`  | `/sites/:id/regenerate-code` | Regenerate join code |

#### Posts

| Method   | Endpoint                     | Description               |
| -------- | ---------------------------- | ------------------------- |
| `GET`    | `/posts`                     | List posts (filtered)     |
| `POST`   | `/posts`                     | Create post               |
| `GET`    | `/posts/:id`                 | Get post detail           |
| `PATCH`  | `/posts/:id`                 | Update post (if RECEIVED) |
| `POST`   | `/posts/:id/images`          | Upload images             |
| `DELETE` | `/posts/:id/images/:imageId` | Remove image              |

#### Reviews (Admin)

| Method | Endpoint                         | Description                    |
| ------ | -------------------------------- | ------------------------------ |
| `POST` | `/posts/:id/review/start`        | Start review                   |
| `POST` | `/posts/:id/review/approve`      | Approve + award points         |
| `POST` | `/posts/:id/review/reject`       | Reject                         |
| `POST` | `/posts/:id/review/request-info` | Request more info              |
| `POST` | `/posts/:id/supplement`          | Worker submits additional info |

#### Actions (Admin)

| Method | Endpoint                     | Description              |
| ------ | ---------------------------- | ------------------------ |
| `POST` | `/posts/:id/action/require`  | Mark as requiring action |
| `POST` | `/posts/:id/action/assign`   | Assign handler           |
| `POST` | `/posts/:id/action/start`    | Start action             |
| `POST` | `/posts/:id/action/complete` | Complete with evidence   |
| `POST` | `/posts/:id/action/reopen`   | Reopen                   |

#### Points

| Method  | Endpoint             | Description                   |
| ------- | -------------------- | ----------------------------- |
| `GET`   | `/points/me`         | Get my points summary         |
| `GET`   | `/points/me/history` | Get my point history          |
| `GET`   | `/points/ranking`    | Get site ranking              |
| `POST`  | `/points/adjust`     | Adjust points (admin)         |
| `GET`   | `/points/policies`   | Get point policies            |
| `PATCH` | `/points/policies`   | Update policies (super admin) |

#### Notifications

| Method  | Endpoint                   | Description          |
| ------- | -------------------------- | -------------------- |
| `GET`   | `/notifications`           | Get my notifications |
| `PATCH` | `/notifications/:id/read`  | Mark as read         |
| `POST`  | `/notifications/subscribe` | Subscribe to push    |

#### Announcements

| Method   | Endpoint             | Description        |
| -------- | -------------------- | ------------------ |
| `GET`    | `/announcements`     | List announcements |
| `POST`   | `/announcements`     | Create (admin)     |
| `PATCH`  | `/announcements/:id` | Update (admin)     |
| `DELETE` | `/announcements/:id` | Delete (admin)     |

### 6.3 Error Response Format

```json
{
  "type": "https://safetywallet.site/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "Phone number format is invalid",
  "instance": "/api/v1/auth/register",
  "errors": [
    {
      "field": "phone",
      "message": "Must be 10-11 digits"
    }
  ]
}
```

---

## 7. Database Schema

### 7.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    Users    │───────│ SiteMemberships │───────│    Sites    │
└─────────────┘  1:N  └─────────────────┘  N:1  └─────────────┘
      │                                               │
      │ 1:N                                           │ 1:N
      ▼                                               ▼
┌─────────────┐                               ┌─────────────┐
│    Posts    │───────────────────────────────│  MasterData │
└─────────────┘                               │ (Companies, │
      │                                       │  Trades,    │
      │ 1:N                                   │  Locations) │
      ▼                                       └─────────────┘
┌─────────────┐
│ PostImages  │
└─────────────┘
      │
      │ (Post also has)
      ▼
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│   Reviews   │  │   Actions   │  │ PointsLedger │
└─────────────┘  └─────────────┘  └──────────────┘
                       │
                       │ 1:N
                       ▼
                ┌──────────────┐
                │ ActionImages │
                └──────────────┘
```

### 7.2 Prisma Schema (Key Models)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus {
  ACTIVE
  PENDING
  BLOCKED
}

enum ReviewStatus {
  RECEIVED
  IN_REVIEW
  NEED_INFO
  APPROVED
  REJECTED
}

enum ActionStatus {
  NONE
  REQUIRED
  ASSIGNED
  IN_PROGRESS
  DONE
  REOPENED
}

enum Category {
  HAZARD
  UNSAFE_BEHAVIOR
  INCONVENIENCE
  SUGGESTION
  BEST_PRACTICE
}

enum RiskLevel {
  HIGH
  MEDIUM
  LOW
}

model User {
  id                String    @id @default(uuid())
  phoneHash         String    @unique @map("phone_hash")
  phoneEncrypted    String    @map("phone_encrypted")
  name              String
  dobEncrypted      String?   @map("dob_encrypted")
  nationalityFlag   String?   @map("nationality_flag")
  emergencyContact  String?   @map("emergency_contact")
  status            UserStatus @default(ACTIVE)
  createdAt         DateTime  @default(now()) @map("created_at")
  lastLoginAt       DateTime? @map("last_login_at")

  memberships       SiteMembership[]
  posts             Post[]
  pointsLedger      PointsLedger[]
  notifications     Notification[]

  @@map("users")
}

model Site {
  id              String    @id @default(uuid())
  name            String
  joinCode        String    @unique @map("join_code")
  active          Boolean   @default(true)
  joinEnabled     Boolean   @default(true) @map("join_enabled")
  requiresApproval Boolean  @default(false) @map("requires_approval")
  createdAt       DateTime  @default(now()) @map("created_at")
  closedAt        DateTime? @map("closed_at")

  memberships     SiteMembership[]
  posts           Post[]
  pointsLedger    PointsLedger[]
  announcements   Announcement[]
  masterCompanies MasterCompany[]
  masterTrades    MasterTrade[]
  masterLocations MasterLocation[]

  @@map("sites")
}

model SiteMembership {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  siteId      String    @map("site_id")
  companyName String    @map("company_name")
  tradeType   String    @map("trade_type")
  joinedAt    DateTime  @default(now()) @map("joined_at")
  leftAt      DateTime? @map("left_at")

  user        User      @relation(fields: [userId], references: [id])
  site        Site      @relation(fields: [siteId], references: [id])

  @@unique([userId, siteId])
  @@map("site_memberships")
}

model Post {
  id              String        @id @default(uuid())
  userId          String        @map("user_id")
  siteId          String        @map("site_id")
  category        Category
  hazardType      String?       @map("hazard_type")
  riskLevel       RiskLevel?    @map("risk_level")
  locationFloor   String        @map("location_floor")
  locationZone    String        @map("location_zone")
  locationDetail  String        @map("location_detail")
  content         String
  visibility      String        @default("worker_public")
  isAnonymous     Boolean       @default(true) @map("is_anonymous")
  reviewStatus    ReviewStatus  @default(RECEIVED) @map("review_status")
  actionStatus    ActionStatus  @default(NONE) @map("action_status")
  isUrgent        Boolean       @default(false) @map("is_urgent")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  user            User          @relation(fields: [userId], references: [id])
  site            Site          @relation(fields: [siteId], references: [id])
  images          PostImage[]
  reviews         Review[]
  action          Action?
  pointsLedger    PointsLedger[]

  @@index([siteId, reviewStatus])
  @@index([siteId, createdAt])
  @@map("posts")
}

model PostImage {
  id            String   @id @default(uuid())
  postId        String   @map("post_id")
  fileUrl       String   @map("file_url")
  thumbnailUrl  String   @map("thumbnail_url")
  createdAt     DateTime @default(now()) @map("created_at")

  post          Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@map("post_images")
}

model Review {
  id          String   @id @default(uuid())
  postId      String   @map("post_id")
  adminId     String   @map("admin_id")
  action      String   // approve, reject, request_more, etc.
  comment     String?
  reasonCode  String?  @map("reason_code")
  createdAt   DateTime @default(now()) @map("created_at")

  post        Post     @relation(fields: [postId], references: [id])

  @@map("reviews")
}

model Action {
  id              String    @id @default(uuid())
  postId          String    @unique @map("post_id")
  assigneeType    String?   @map("assignee_type")
  assigneeId      String?   @map("assignee_id")
  dueDate         DateTime? @map("due_date")
  completionNote  String?   @map("completion_note")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  post            Post      @relation(fields: [postId], references: [id])
  images          ActionImage[]

  @@map("actions")
}

model ActionImage {
  id            String   @id @default(uuid())
  actionId      String   @map("action_id")
  fileUrl       String   @map("file_url")
  thumbnailUrl  String   @map("thumbnail_url")
  createdAt     DateTime @default(now()) @map("created_at")

  action        Action   @relation(fields: [actionId], references: [id], onDelete: Cascade)

  @@map("action_images")
}

model PointsLedger {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  siteId        String   @map("site_id")
  postId        String?  @map("post_id")
  refLedgerId   String?  @map("ref_ledger_id")
  amount        Int
  reasonCode    String   @map("reason_code")
  reasonText    String   @map("reason_text")
  adminId       String?  @map("admin_id")
  settleMonth   String   @map("settle_month") // YYYY-MM
  occurredAt    DateTime @map("occurred_at")
  createdAt     DateTime @default(now()) @map("created_at")

  user          User     @relation(fields: [userId], references: [id])
  site          Site     @relation(fields: [siteId], references: [id])
  post          Post?    @relation(fields: [postId], references: [id])
  refLedger     PointsLedger? @relation("LedgerCorrection", fields: [refLedgerId], references: [id])
  corrections   PointsLedger[] @relation("LedgerCorrection")

  @@index([userId, siteId, settleMonth])
  @@map("points_ledger")
}

model Notification {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  type        String
  title       String
  body        String
  data        Json?
  read        Boolean   @default(false)
  createdAt   DateTime  @default(now()) @map("created_at")

  user        User      @relation(fields: [userId], references: [id])

  @@index([userId, read])
  @@map("notifications")
}

model Announcement {
  id          String    @id @default(uuid())
  siteId      String    @map("site_id")
  title       String
  content     String
  type        String
  startDate   DateTime  @map("start_date")
  endDate     DateTime  @map("end_date")
  createdAt   DateTime  @default(now()) @map("created_at")

  site        Site      @relation(fields: [siteId], references: [id])

  @@map("announcements")
}

model AuditLog {
  id          String   @id @default(uuid())
  actorId     String   @map("actor_id")
  action      String
  targetType  String   @map("target_type")
  targetId    String   @map("target_id")
  reason      String?
  ip          String?
  userAgent   String?  @map("user_agent")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([actorId])
  @@index([targetType, targetId])
  @@map("audit_logs")
}
```

---

## 8. Security Implementation

### 8.1 Authentication Security

| Measure              | Implementation                                            |
| -------------------- | --------------------------------------------------------- |
| OTP Security         | 6 digits, 5min expiry, single-use, rate limited           |
| JWT Access Token     | 15min expiry, RS256 signing                               |
| JWT Refresh Token    | 7 days expiry, rotation on use, stored in HttpOnly cookie |
| Session Invalidation | Redis blacklist for revoked tokens                        |

### 8.2 Rate Limiting

```typescript
// Rate limit configuration
const rateLimits = {
  "otp:send:phone": { points: 5, duration: 3600 }, // 5/hour per phone
  "otp:send:ip": { points: 20, duration: 600 }, // 20/10min per IP
  "otp:verify:phone": { points: 5, duration: 900 }, // 5 attempts, 15min lockout
  "register:ip": { points: 30, duration: 3600 }, // 30/hour per IP
  "api:general": { points: 100, duration: 60 }, // 100/min per user
};
```

### 8.3 Data Encryption

| Data              | Encryption           | Key Management     |
| ----------------- | -------------------- | ------------------ |
| Phone numbers     | AES-256-GCM          | AWS KMS / Vault    |
| Date of birth     | AES-256-GCM          | AWS KMS / Vault    |
| Phone hash        | SHA-256 (for lookup) | Static salt in env |
| Passwords (admin) | bcrypt (cost 12)     | N/A                |

### 8.4 Access Control

```typescript
// Guard implementation example
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const requiredFlags = this.reflector.get<string[]>('flags', context.getHandler());
    const user = context.switchToHttp().getRequest().user;

    // Check role
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      return false;
    }

    // Check flags
    if (requiredFlags && !requiredFlags.every(f => user.flags.includes(f))) {
      return false;
    }

    return true;
  }
}

// Usage
@Post('points/adjust')
@Roles('SITE_ADMIN', 'SUPER_ADMIN')
@RequireFlags('POINT_AWARD')
adjustPoints(@Body() dto: AdjustPointsDto) { ... }
```

### 8.5 Audit Logging

```typescript
// Mandatory audit events
const auditEvents = [
  "PII_VIEW_FULL", // Full PII viewed
  "EXPORT_EXCEL", // Excel download
  "EXPORT_IMAGE", // Image download
  "POINT_AWARD", // Points awarded
  "POINT_ADJUST", // Points adjusted
  "POLICY_CHANGE", // Policy modified
  "PERMISSION_CHANGE", // Role/flag changed
  "STATUS_OVERRIDE", // Forced status change
];
```

---

## 9. Testing Strategy

### 9.1 Test Pyramid

| Level       | Coverage Target | Tools            |
| ----------- | --------------- | ---------------- |
| Unit        | 80%+            | Jest             |
| Integration | Key flows       | Jest + Supertest |
| E2E         | Critical paths  | Playwright       |
| Load        | 500 concurrent  | k6               |

### 9.2 Test Categories

#### Unit Tests

```typescript
// Example: Point calculation
describe("PointService", () => {
  it("should calculate base points for hazard", () => {
    expect(service.calculatePoints({ category: "HAZARD" })).toBe(10);
  });

  it("should add risk level bonus", () => {
    expect(
      service.calculatePoints({
        category: "HAZARD",
        riskLevel: "HIGH",
      }),
    ).toBe(15);
  });

  it("should respect daily limit", async () => {
    // ... test daily limit enforcement
  });
});
```

#### E2E Tests

```typescript
// Example: Post submission flow
test("worker can submit hazard report", async ({ page }) => {
  await page.goto("/posts/new");
  await page.selectOption("[name=category]", "HAZARD");
  await page.fill("[name=content]", "Exposed rebar on B2 floor");
  await page.setInputFiles("[name=photo]", "test-hazard.jpg");
  await page.click("button[type=submit]");

  await expect(page.locator(".success-message")).toBeVisible();
  await expect(page.locator(".post-status")).toHaveText("Received");
});
```

### 9.3 Load Testing

```javascript
// k6 script
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up
    { duration: "5m", target: 500 }, // Peak load
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% under 1s
    http_req_failed: ["rate<0.01"], // <1% errors
  },
};

export default function () {
  const res = http.get("https://api.safetywallet.site/api/v1/posts");
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
```

---

## 10. Deployment Strategy

### 10.1 Environments

| Environment | Purpose             | URL                       |
| ----------- | ------------------- | ------------------------- |
| Local       | Development         | localhost:3000            |
| Dev         | Integration testing | dev.safetywallet.site     |
| Staging     | Pre-production      | staging.safetywallet.site |
| Production  | Live                | safetywallet.site         |

### 10.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker images
        run: docker compose build
      - name: Push to registry
        run: docker compose push

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: kubectl apply -f k8s/staging/

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: kubectl apply -f k8s/production/
```

### 10.3 Rollback Strategy

| Scenario                   | Action                                  |
| -------------------------- | --------------------------------------- |
| Failed deployment          | Automatic rollback via Kubernetes       |
| Runtime errors spike       | Manual rollback to previous version     |
| Database migration failure | Restore from backup + redeploy previous |

---

## 11. Risk Mitigation

### 11.1 Technical Risks

| Risk                                | Probability | Impact | Mitigation                                |
| ----------------------------------- | ----------- | ------ | ----------------------------------------- |
| PWA push not working on iOS         | High        | Medium | Fallback to in-app + SMS for critical     |
| Image upload fails on slow networks | High        | High   | Client compression, chunked upload, retry |
| Point calculation errors            | Medium      | High   | Immutable ledger, comprehensive tests     |
| SMS costs exceed budget             | Medium      | Low    | Rate limits, batch sending, monitor usage |

### 11.2 Operational Risks

| Risk                     | Probability | Impact   | Mitigation                                  |
| ------------------------ | ----------- | -------- | ------------------------------------------- |
| Fraudulent registrations | Medium      | Medium   | Rate limits, device ID, admin approval mode |
| Point gaming/abuse       | High        | Medium   | Daily limits, duplicate detection, audit    |
| Data breach              | Low         | Critical | Encryption, access logs, security audit     |
| Site overwhelm at peak   | Medium      | High     | Load testing, auto-scaling                  |

### 11.3 Contingency Plans

| Scenario               | Response                                        |
| ---------------------- | ----------------------------------------------- |
| Database corruption    | Restore from hourly backup, max 1h data loss    |
| Third-party SMS outage | Switch to backup provider (have 2 configured)   |
| Complete outage        | Static maintenance page, incident communication |

---

## 12. Team Structure

### 12.1 Recommended Team

| Role               | Count | Responsibilities                               |
| ------------------ | ----- | ---------------------------------------------- |
| Tech Lead          | 1     | Architecture, code review, technical decisions |
| Backend Developer  | 2     | API, business logic, integrations              |
| Frontend Developer | 2     | Worker PWA, Admin web, UI/UX                   |
| DevOps Engineer    | 1     | Infrastructure, CI/CD, monitoring              |
| QA Engineer        | 1     | Testing strategy, E2E tests, load tests        |
| UI/UX Designer     | 0.5   | Design system, user flows (can be shared)      |

### 12.2 Communication

| Meeting         | Frequency     | Participants       |
| --------------- | ------------- | ------------------ |
| Daily standup   | Daily, 15min  | All dev team       |
| Sprint planning | Bi-weekly, 2h | All + PM           |
| Sprint review   | Bi-weekly, 1h | All + stakeholders |
| Tech sync       | Weekly, 1h    | Dev team           |

### 12.3 Definition of Done

- [ ] Code reviewed and approved
- [ ] Unit tests passing (80%+ coverage)
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] No critical security issues
- [ ] Deployed to staging and verified
- [ ] PM sign-off on acceptance criteria

---

## Appendix A: Development Environment Setup

```bash
# Clone repository
git clone git@github.com:org/safetywallet.git
cd safetywallet

# Install dependencies
npm install

# Copy environment files
cp .env.example .env.local

# Start infrastructure
docker compose up -d postgres redis minio

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start development servers
npm run dev          # All apps
npm run dev:worker   # Worker PWA only
npm run dev:admin    # Admin web only
npm run dev:api      # Backend only
```

---

## Appendix B: Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/safetywallet

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# SMS (Twilio example)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# Storage (S3)
S3_BUCKET=safetywallet-uploads
S3_REGION=ap-northeast-2
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx

# Encryption
ENCRYPTION_KEY=32-byte-key-here

# Push Notifications
FCM_SERVER_KEY=xxx

# Application
APP_URL=https://safetywallet.site
API_URL=https://api.safetywallet.site
```

---

## Change History

| Version | Date       | Changes                     |
| ------- | ---------- | --------------------------- |
| v1.0    | 2025-02-05 | Initial implementation plan |
