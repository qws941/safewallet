# WORKER APP PAGES

## OVERVIEW

App Router pages for field users. This layer coordinates mobile UX flows, route guards, and page-level data loading.

## STRUCTURE

```
app/
├── layout.tsx          # Root metadata, Providers mount, lang=ko
├── login/ register/    # Auth entry flows
├── home/ profile/      # Core worker dashboard pages
├── posts/ actions/     # Reporting and corrective-action flows
└── education/ votes/   # Learning and participation features
```

## WHERE TO LOOK

| Task                         | File                     | Notes                                               |
| ---------------------------- | ------------------------ | --------------------------------------------------- |
| Add a new page               | `app/{feature}/page.tsx` | Keep `'use client'` on interactive pages            |
| Adjust global metadata       | `app/layout.tsx`         | PWA metadata and viewport controls live here        |
| New protected route behavior | feature page + guards    | Auth/attendance gates handled via shared components |

## CONVENTIONS

- Worker pages are client-first and Korean-localized.
- Route-level data comes from hooks in `src/hooks/`, not direct network calls.
- Keep page components thin; move reusable UI to `src/components/`.
- Preserve static-export compatibility for CF Pages.

## ANTI-PATTERNS

- No direct `fetch()` in page components.
- No browser `alert()`/`confirm()` dialogs.
- No page-local token storage logic; use Zustand auth store + API client.
