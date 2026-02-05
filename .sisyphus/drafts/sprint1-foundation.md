# Draft: SafetyWallet Sprint 1 Foundation Plan

## Requirements (confirmed)
- **Project type**: Construction site safety reporting PWA
- **Monorepo**: pnpm + Turborepo
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand, React Hook Form + Zod
- **Backend**: NestJS, Prisma, PostgreSQL 15, Redis 7
- **Storage**: MinIO (S3-compatible)
- **Infra**: Docker Compose for local dev

## Project Structure (confirmed)
```
safetywallet/
├── apps/
│   ├── worker/          # Worker PWA (Next.js)
│   ├── admin/           # Admin Web (Next.js)
│   └── api/             # Backend (NestJS)
├── packages/
│   ├── database/        # Prisma schema & client
│   ├── types/           # Shared TypeScript types
│   └── ui/              # Shared UI components
├── docker/
│   └── docker-compose.yml
└── package.json         # Turborepo root
```

## Sprint 1 Scope (confirmed - 8 items)
1. Repository setup (pnpm monorepo with Turborepo)
2. Docker Compose (PostgreSQL, Redis, MinIO)
3. NestJS project scaffold with core modules
4. Prisma schema (complete schema)
5. Next.js worker app scaffold with PWA
6. Next.js admin app scaffold
7. Shared UI component library (shadcn/ui)
8. CI/CD pipeline (GitHub Actions)

## Entities (from PRD)
- Users (phone-based auth, encrypted PII)
- Sites (QR join codes)
- SiteMemberships (user-site relationship)
- Posts (5 categories, dual-axis state machine)
- PostImages
- Reviews
- Actions + ActionImages
- PointsLedger (immutable)
- Notifications
- Announcements
- AuditLogs

## Open Questions
- ✅ All resolved

## Technical Decisions (CONFIRMED)
1. **Prisma Schema**: Design from 11 entities listed (Users, Sites, SiteMemberships, Posts, PostImages, Reviews, Actions, ActionImages, PointsLedger, Notifications, Announcements, AuditLogs)
2. **Test Strategy**: YES - Jest for NestJS, Vitest + testing-library for Next.js
3. **CI/CD Scope**: Lint + Type-check + Build (no tests in CI for Sprint 1)
4. **UI Components**: Core set - Button, Input, Card, Form, Dialog, Toast, Avatar, Badge
5. **Auth Mechanism**: Mock auth for Sprint 1 (defer real phone/QR implementation to later sprint)

## Scope Boundaries
- INCLUDE: Sprint 1 only
- EXCLUDE: Sprint 2+ features, production deployment
