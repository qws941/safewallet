# WORKER APP HOOKS

## OVERVIEW

TanStack Query hooks for worker-facing APIs. Hooks encapsulate request keys, mutation invalidation, and auth-aware request behavior.

## STRUCTURE

```
hooks/
├── use-api.ts                # Core domain hooks (posts, points, education, actions)
├── use-auth.ts               # Auth utility hooks tied to store/api client
├── use-leaderboard.ts        # Ranking-specific queries
├── use-push-subscription.ts  # Web push registration lifecycle
└── use-translation.ts        # i18n hook adapters
```

## CONVENTIONS

- Query keys must be stable and parameterized (siteId, itemId, filters).
- Mutations should invalidate only impacted keys, not the entire cache.
- Use `apiFetch` wrappers for auth refresh and consistent error handling.
- Keep hook return values UI-ready to reduce page/component boilerplate.

## ANTI-PATTERNS

- No duplicate query keys for the same resource shape.
- No direct state mutation in components when a mutation hook exists.
- No direct API call from components that bypasses these hooks.
