# ADMIN ATTENDANCE PAGES

## OVERVIEW

Attendance management surfaces: daily records, unmatched records, and FAS sync troubleshooting views.

## WHERE TO LOOK

| Task                      | File                    | Notes                                   |
| ------------------------- | ----------------------- | --------------------------------------- |
| Main attendance dashboard | `page.tsx`              | Tab entry point for attendance views    |
| FAS sync operations       | `sync/page.tsx`         | Manual sync + status checks             |
| Resolve unmatched records | `unmatched/page.tsx`    | Record matching and reconciliation flow |
| Shared helpers            | `attendance-helpers.ts` | Date/range and table shaping helpers    |

## CONVENTIONS

- Keep UI as tab-driven workflows with clear loading/error states.
- Use domain hooks from `src/hooks/` for API operations.
- Preserve KST-based day/month assumptions used by attendance reports.
- Show explicit status for sync operations and partial failures.

## ANTI-PATTERNS

- No direct `fetch()` from page components.
- No hidden retries for sync failures; surface retry intent in UI.
- No attendance business-rule duplication outside shared helpers/hooks.
