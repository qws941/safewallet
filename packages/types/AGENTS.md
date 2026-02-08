# PACKAGES/TYPES

## OVERVIEW

Shared TypeScript types, 15 enums, and 10 DTO interfaces consumed by all apps.

## STRUCTURE

```
src/
├── index.ts              # Barrel export (ALL types/enums/DTOs)
├── enums.ts              # 15 enum definitions
├── api.ts                # ApiResponse<T> generic interface
└── dto/
    ├── index.ts          # DTO barrel export
    ├── action.dto.ts     # Corrective action types
    ├── announcement.dto.ts
    ├── auth.dto.ts       # Auth request/response types
    ├── education.dto.ts  # Course, material, quiz types
    ├── points.dto.ts     # Point ledger types
    ├── post.dto.ts       # Post CRUD types
    ├── review.dto.ts     # Review workflow types
    ├── site.dto.ts       # Site types
    ├── user.dto.ts       # User types
    └── vote.dto.ts       # Vote types
```

## CONVENTIONS

- **Barrel exports**: Everything re-exported from `src/index.ts`
- **Import as**: `import { UserRole, CreatePostDto } from "@safetywallet/types"`
- **DTOs are interfaces** — no runtime validation (Zod is on API side)
- **Enums MUST match** Drizzle schema enums in `api-worker/src/db/schema.ts`

## ENUMS (15)

UserRole, MembershipStatus, Category, RiskLevel, Visibility, ReviewStatus, ActionStatus, ReviewAction, TaskStatus, RejectReason, ApprovalStatus, EducationContentType, QuizStatus, StatutoryTrainingType, TrainingCompletionStatus

## ANTI-PATTERNS

- **Never add runtime logic** — types-only package
- **Never import from sub-paths** — always import from `@safetywallet/types`
- **Enum sync**: Adding/changing an enum HERE requires matching change in `api-worker/src/db/schema.ts`
