# ADMIN POSTS PAGES

## OVERVIEW

Safety report review pages: queue filtering, detail inspection, and approval/rejection actions.

## WHERE TO LOOK

| Task                  | File              | Notes                               |
| --------------------- | ----------------- | ----------------------------------- |
| Post list and filters | `page.tsx`        | Review queue entry point            |
| Post detail workflow  | `[id]/page.tsx`   | Review actions and evidence display |
| Reusable logic        | `post-helpers.ts` | Mapping and formatting helpers      |

## CONVENTIONS

- Keep review-state transitions aligned with backend workflow states.
- Use existing admin hooks for loading and mutation actions.
- Surface assignment/review status clearly in list and detail pages.
- Keep comment/reason fields explicit for auditability.

## ANTI-PATTERNS

- No optimistic state transitions that bypass server confirmation.
- No direct mutation calls outside domain hooks.
- No hidden reject/approve reasons; always show user-facing rationale fields.
