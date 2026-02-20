# ADMIN STORES

## OVERVIEW

Admin auth/session state managed by a single persisted Zustand store.

## STRUCTURE

```
stores/
├── auth.ts         # user/tokens/currentSiteId/isAdmin
└── __tests__/      # store behavior tests
```

## CONVENTIONS

- Treat `auth.ts` as the source of truth for admin login state.
- Keep persistence key stable: `safetywallet-admin-auth`.
- Keep site context (`currentSiteId`) synchronized with dashboard hooks.
- Keep logout side-effect (`/auth/logout`) best-effort and non-blocking.

## ANTI-PATTERNS

- No direct localStorage manipulation in components/hooks.
- No duplicate token objects outside this store.
- No role checks scattered in pages when store already exposes `isAdmin`.
