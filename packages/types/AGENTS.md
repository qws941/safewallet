# AGENTS: PACKAGES/TYPES

**Context:** Shared Type Definitions
**Scope:** Internal types, Enums, and DTOs

## OVERVIEW

This package is the Source of Truth (SoT) for all TypeScript definitions used across the Safework2 monorepo. It is a logic-less library strictly restricted to types, interfaces, and enums consumed by both the API and frontend applications.

## STRUCTURE

```
src/
├── index.ts              # Global barrel export (Source of Truth)
├── enums.ts              # System-wide enum definitions (24 total)
├── api.ts                # Generic API response envelopes
└── dto/                  # Domain-specific Data Transfer Objects
    ├── action.dto.ts     # Corrective actions
    ├── auth.dto.ts       # Authentication & Login
    ├── education.dto.ts  # Courses, Materials, Quizzes
    ├── user.dto.ts       # Profiles & Identity
    └── ...               # (See directory for full list)
```

## CONVENTIONS

- **Barrel Exports**: Every public type, interface, or enum MUST be re-exported in `src/index.ts`.
- **Interface vs Type**: Prefer `interface` for DTOs and object structures to allow for extension.
- **Naming**: DTOs must be suffixed with `Dto` (e.g., `CreatePostDto`, `UserResponseDto`).
- **Enum Parity**: Enums defined here must match the Drizzle schema enums in `apps/api-worker/src/db/schema.ts`.
- **Workspace Aliasing**: Always import via `@safetywallet/types` rather than relative paths from other packages.

## ANTI-PATTERNS

- **No Runtime Code**: NEVER include functions, classes with methods, or logic. Enums are the only exception.
- **No Deep Imports**: NEVER import from sub-paths (e.g., `src/dto/user`). Use the root barrel.
- **No Validation Logic**: Keep Zod schemas and validation logic in `apps/api-worker`.
- **No External Dependencies**: Avoid adding runtime dependencies; `devDependencies` for types only.
- **No `any`**: Strictly prohibited. Use `unknown` if a type is truly dynamic.
