# ADMIN-APP (Next.js 14 Dashboard)

## OVERVIEW

Admin dashboard for site managers. Next.js 14 App Router, static export to CF Pages (port 3001). 22 pages, 12-item sidebar.

## STRUCTURE

```
src/
├── app/
│   ├── layout.tsx, page.tsx          # Root layout + redirect
│   ├── login/page.tsx                # Admin login
│   ├── dashboard/                    # Dashboard home
│   │   ├── layout.tsx                # Sidebar layout (wraps /dashboard)
│   │   └── page.tsx                  # 8 stat cards + chart
│   ├── (dashboard)/                  # Route group (organizational, no URL segment)
│   │   ├── approvals/page.tsx        # Approval workflow
│   │   ├── points/policies/page.tsx  # Point policies
│   │   ├── sync-errors/page.tsx      # FAS sync errors
│   │   └── votes/candidates/page.tsx # Vote candidates
│   ├── posts/page.tsx                # Post list
│   ├── posts/[id]/page.tsx           # Post detail
│   ├── members/page.tsx              # Member list
│   ├── members/[id]/page.tsx         # Member detail
│   ├── education/page.tsx            # Education (1391L — BLOATED, needs split)
│   ├── attendance/page.tsx           # Attendance (30s real-time refetch)
│   ├── announcements/page.tsx        # Announcements
│   ├── votes/page.tsx                # Vote management
│   ├── votes/new/page.tsx            # Create vote
│   ├── votes/[id]/page.tsx           # Vote detail
│   ├── votes/[id]/candidates/new/    # Add candidate to vote
│   ├── actions/page.tsx              # Corrective actions
│   ├── audit/page.tsx                # Audit log
│   ├── points/page.tsx               # Points ledger
│   └── settings/page.tsx             # App settings
├── components/
│   ├── sidebar.tsx                   # 281L, 12 menu items, collapsible
│   ├── data-table.tsx                # 269L, generic: search/sort/pagination
│   ├── stats-card.tsx                # Dashboard stat cards
│   ├── review-actions.tsx            # Post review action buttons
│   ├── providers.tsx                 # TanStack Query + auth providers
│   ├── ui/table.tsx                  # Shadcn table primitive
│   ├── approvals/                    # approval-list, approval-dialog, approval-history, reject-dialog
│   └── votes/candidate-dialog.tsx    # Vote candidate modal
├── hooks/
│   ├── use-api.ts                    # 1288L, 60+ hooks (MONOLITHIC — needs split)
│   ├── use-votes.ts                  # Vote hooks (separated — good pattern)
│   ├── use-attendance-logs.ts        # Attendance log hooks
│   └── use-sync-errors.ts            # FAS sync error hooks
├── stores/
│   └── auth.ts                       # Zustand auth store
└── lib/
    ├── api.ts                        # API client + token refresh
    └── utils.ts                      # cn() re-export
```

## KEY DETAILS

| Component  | Detail                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Dashboard  | 8 stat cards (users, posts, sites, etc.) + category distribution chart   |
| data-table | Generic, reusable: column sort, search filter, pagination, row selection |
| Attendance | 30-second auto-refetch interval                                          |
| use-api.ts | **1288 lines, 60+ hooks** — monolithic, refactor candidate               |
| education  | **1391 lines** — single-page CRUD for courses/quizzes/TBM                |

## CONVENTIONS

- **ALL pages `'use client'`** — zero RSC, static export
- **Dynamic routes**: `[id]` pattern for member/post/vote detail pages
- **Route groups**: `(dashboard)/` for shared sidebar layout
- **API base**: `NEXT_PUBLIC_API_URL` env or `http://localhost:3333`
- Same auth/API patterns as worker-app (Zustand + TanStack Query)

## ANTI-PATTERNS

- **Known**: `hooks/use-api.ts:~310` — `useAuditLogs()` returns `Promise.resolve()` (placeholder, HIGH priority)
- No `alert()`/`confirm()` — use modal components
- **Refactor targets**: `use-api.ts` (split by domain), `education/page.tsx` (extract sub-components)
