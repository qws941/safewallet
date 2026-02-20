# WORKER STORES

## OVERVIEW

PWA authentication/session state with persisted Zustand hydration controls.

## STRUCTURE

```
stores/
├── auth.ts         # user, access/refresh tokens, currentSiteId
└── __tests__/      # store tests
```

## CONVENTIONS

- Keep auth/session lifecycle in `auth.ts`; UI code uses store actions only.
- Persist via `createJSONStorage(() => localStorage)` with key `safetywallet-auth`.
- Keep `_hasHydrated` flag handling intact for static-export safety.
- Keep logout flow best-effort: call `/auth/logout`, then clear state.

## ANTI-PATTERNS

- No manual token reads/writes in pages or hooks.
- No parallel auth states outside this store.
- No direct API-side auth assumptions in UI without reading store hydration state.
