# ADMIN-APP (Next.js 14 Dashboard)

## OVERVIEW

Admin dashboard for site managers. Next.js 14 App Router, deployed to CF Pages via `@cloudflare/next-on-pages` (port 3001). Note: does NOT use `output: 'export'` (diverges from worker-app). 26 pages, 12-item sidebar.

## STRUCTURE

```
src/
├── app/
│   ├── layout.tsx, page.tsx          # Root layout + redirect
│   ├── login/page.tsx                # Admin login
│   ├── dashboard/                    # Dashboard home
│   │   ├── layout.tsx                # Sidebar layout (wraps /dashboard)
│   │   ├── page.tsx                  # 8 stat cards + chart
│   │   ├── analytics/page.tsx        # Dashboard analytics
│   │   └── recommendations/page.tsx  # Dashboard recommendations
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
│   ├── attendance/unmatched/page.tsx # Unmatched attendance records
│   ├── announcements/page.tsx        # Announcements
│   ├── monitoring/page.tsx           # System monitoring dashboard
│   ├── votes/page.tsx                # Vote management
│   ├── votes/new/page.tsx            # Create vote
│   ├── votes/[id]/page.tsx           # Vote detail
│   ├── votes/[id]/candidates/new/    # Add candidate to vote
│   ├── actions/page.tsx              # Corrective actions
│   ├── audit/page.tsx                # Audit log
│   ├── points/page.tsx               # Points ledger
│   ├── settings/page.tsx             # App settings
│   ├── recommendations/page.tsx      # Safety recommendations
│   ├── not-found.tsx                 # Custom 404
│   └── error.tsx                     # Error boundary
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
│   ├── use-api.ts                    # Barrel re-export (13L) — was 1288L monolithic, NOW SPLIT
│   └── 15 domain hooks              # Largest: use-education-api.ts (531L)
├── stores/
│   └── auth.ts                       # Zustand auth store
└── lib/
    ├── api.ts                        # API client + token refresh
    └── utils.ts                      # cn() re-export
```

## CONVENTIONS

- **ALL pages `'use client'`** — zero RSC
- **Dynamic routes**: `[id]` for detail pages. **Route groups**: `(dashboard)/` for shared sidebar layout
- **API base**: `NEXT_PUBLIC_API_URL` env or `http://localhost:3333`
- Same auth/API patterns as worker-app (Zustand + TanStack Query)

## ANTI-PATTERNS

- **Known**: `app/votes/page.tsx:63` — `window.confirm()` anti-pattern (should use dialog component)
- **Known**: `app/actions/page.tsx:120` — `(statusColors[item.status] as any)` type assertion
- No `alert()`/`confirm()` — use modal components
- **Known**: `dashboard/layout.tsx:16-22` — client-side auth guard via useEffect (should be middleware)
- **Refactor targets**: `education/page.tsx` (extract sub-components)
