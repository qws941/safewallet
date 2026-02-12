# ADMIN APP PAGES

## OVERVIEW

Next.js 14 App Router pages for the admin dashboard. 14 feature directories + root layout files. All pages use `'use client'` — zero React Server Components.

## STRUCTURE

| Directory          | Files | Purpose                                    |
| ------------------ | ----- | ------------------------------------------ |
| `actions/`         | 1     | Corrective action tracking                 |
| `announcements/`   | 1     | Site announcement management               |
| `approvals/`       | 0     | Approval workflow (empty — may be pending) |
| `attendance/`      | 3     | Attendance records, FAS sync status        |
| `audit/`           | 1     | Audit log viewer                           |
| `dashboard/`       | 4     | Main dashboard with stats/charts           |
| `education/`       | 1     | Course and material management             |
| `login/`           | 1     | Admin login page                           |
| `members/`         | 2     | Site membership management                 |
| `points/`          | 1     | Point ledger and policies                  |
| `posts/`           | 2     | Safety report management and review        |
| `recommendations/` | 1     | Safety recommendations                     |
| `settings/`        | 1     | Site/system settings                       |
| `votes/`           | 4     | Monthly worker voting management           |

### Root Files

| File               | Lines | Purpose                             |
| ------------------ | ----- | ----------------------------------- |
| `layout.tsx`       | 28    | Root layout with sidebar navigation |
| `page.tsx`         | 5     | Root redirect to `/dashboard`       |
| `error.tsx`        | 22    | Error boundary component            |
| `global-error.tsx` | 26    | Global error boundary               |
| `not-found.tsx`    | 8     | 404 page                            |
| `globals.css`      | 55    | Global styles (Tailwind imports)    |

## CONVENTIONS

- **All pages `'use client'`** — no RSC
- **API calls via domain hooks** — `use-admin-api.ts`, `use-posts-api.ts`, etc. (barrel: `use-api.ts`)
- **UI components from `@safetywallet/ui`** (shared package)
- **Korean UI text** — admin-facing labels
- **Port 3001** in development
- **Deployed via `@cloudflare/next-on-pages`** to CF Pages

## ADDING A PAGE

1. Create directory under `src/app/{feature}/`
2. Add `page.tsx` with `'use client'` directive
3. Use `useApi()` hook for API calls
4. Import UI primitives from `@safetywallet/ui`
5. Add navigation link in `layout.tsx` sidebar

## ANTI-PATTERNS

- **No React Server Components** — always `'use client'`
- **No direct `fetch()`** — use `useApi()` hook
- **No `confirm()` / `alert()`** — use dialog components
- **No inline styles** — use Tailwind classes
