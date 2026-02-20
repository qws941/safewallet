# ADMIN-APP KNOWLEDGE BASE

**Next.js 14 Dashboard** (Static Export via R2)

## STRUCTURE

```
src/
├── app/                  # App Router pages
│   ├── approvals/        # Approval workflow
│   └── [domain]/         # Domain pages (posts, members)
├── components/           # UI Components
│   ├── sidebar.tsx       # Core nav (12 items)
│   └── [domain]/         # Domain-local UI
├── hooks/                # Domain hooks (TanStack Query)
└── lib/                  # API client
```

## WHERE TO LOOK

| Task    | Location                     | Notes                       |
| ------- | ---------------------------- | --------------------------- |
| Sidebar | `src/components/sidebar.tsx` | 12 items, collapsible       |
| Pages   | `src/app/`                   | `page.tsx`, `layout.tsx`    |
| API     | `src/hooks/`                 | `use-education-api.ts` etc. |
| Auth    | `src/stores/auth.ts`         | Zustand store               |

## SUBMODULE DOCS

- `src/app/AGENTS.md`: Dashboard route groups and page-domain structure
- `src/hooks/AGENTS.md`: TanStack Query hook inventory and invalidation rules
- `src/components/AGENTS.md`: Reusable admin UI component boundaries
- `src/lib/AGENTS.md`: API client and utility-layer constraints
- `src/stores/AGENTS.md`: Persisted auth/session state conventions

## CONVENTIONS

- **'use client' Only**: Zero RSC. All pages/components are client-side.
- **Route Groups**: `(dashboard)/` for shared layout.
- **Korean UI**: All text in Korean.
- **API**: Use domain hooks (e.g., `usePosts()`), never `fetch()` directly.

## ANTI-PATTERNS

- **Native Modals**: NO `alert()`/`confirm()`. Use shadcn/ui Dialog.
- **Client Guards**: No `useEffect` auth checks (use Middleware).
- **Loose Types**: No `as any`.
- **Sync Logic**: No FAS sync implementation here (Monitoring only).
