# packages/types - Shared TypeScript Types

## OVERVIEW

Centralized TypeScript types, enums, DTOs shared across all apps. Barrel exports via `index.ts`.

## STRUCTURE

```
src/
├── index.ts          # Barrel export (re-exports all)
├── enums/            # UserRole, ReviewStatus, etc.
├── dto/              # Request/response DTOs
├── api/              # API response interfaces
└── entities/         # Entity type definitions
```

## WHERE TO LOOK

| Task             | Location              | Notes                      |
| ---------------- | --------------------- | -------------------------- |
| Add enum         | `src/enums/{name}.ts` | Export in index.ts         |
| Add DTO          | `src/dto/{entity}/`   | Create, Update, Query DTOs |
| Add API response | `src/api/`            | ApiResponse<T> wrapper     |
| Add entity type  | `src/entities/`       | Mirror Prisma models       |

## KEY TYPES

### Enums (10)

```typescript
export enum UserRole {
  WORKER,
  SITE_ADMIN,
  SUPER_ADMIN,
  SYSTEM,
}
export enum ReviewStatus {
  RECEIVED,
  IN_REVIEW,
  NEED_INFO,
  APPROVED,
  REJECTED,
}
export enum ActionStatus {
  NONE,
  REQUIRED,
  ASSIGNED,
  IN_PROGRESS,
  DONE,
  REOPENED,
}
```

### API Response

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  timestamp: string;
}
```

## CONVENTIONS

- **Barrel exports**: All types must be re-exported from `src/index.ts`
- **Naming**: PascalCase for types, SCREAMING_CASE for enum values
- **DTOs**: Suffix with `Dto` (CreatePostDto, QueryPostsDto)
- **Import path**: `import { UserRole } from '@safetywallet/types'`

## COMMANDS

```bash
npm run build:types    # Compile TypeScript
```
