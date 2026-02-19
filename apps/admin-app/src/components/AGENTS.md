# ADMIN COMPONENTS

## OVERVIEW

Admin dashboard presentation layer: layout/navigation shell, reusable data widgets, and domain-specific UI blocks.

## STRUCTURE

```
components/
├── sidebar.tsx         # Desktop/mobile nav + site switcher
├── providers.tsx       # QueryClientProvider + Toaster
├── data-table.tsx      # Shared table UI
├── review-actions.tsx  # Review workflow actions
├── stats-card.tsx      # Dashboard metric tiles
├── approvals/          # Approval domain components
├── votes/              # Voting domain components
└── __tests__/          # Component tests
```

## CONVENTIONS

- All files are client components (`"use client"`).
- Shared primitives come from `@safetywallet/ui`; do not recreate base UI atoms locally.
- Sidebar interactions must keep query cache coherent (`queryClient.clear()` on logout, invalidation on site switch).
- Keep domain-specific component logic in `approvals/` or `votes/` when not reusable across domains.

## ANTI-PATTERNS

- No direct API requests in components; use hooks from `src/hooks`.
- No hardcoded English labels; admin UI is Korean-first.
- No stateful logic that belongs in store/hooks (keep components presentation-first).
