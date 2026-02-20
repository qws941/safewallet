# ADMIN VOTES PAGES

## OVERVIEW

Voting administration pages for period creation, candidate management, and results review.

## WHERE TO LOOK

| Task                     | File                  | Notes                               |
| ------------------------ | --------------------- | ----------------------------------- |
| Voting list and controls | `page.tsx`            | Main admin view for vote periods    |
| Period setup             | `periods/page.tsx`    | Create/update active voting periods |
| Candidate management     | `candidates/page.tsx` | Candidate lifecycle controls        |
| Results inspection       | `results/page.tsx`    | Aggregated outcomes and status      |

## CONVENTIONS

- Treat period state as the primary guard for vote actions.
- Keep candidate operations scoped to the selected period/context.
- Use domain hooks for data sync and invalidation.
- Reflect backend status in UI badges/filters consistently.

## ANTI-PATTERNS

- No edits to closed periods without explicit backend support.
- No mixed-period candidate actions in a single mutation path.
- No client-side recomputation of final results as source of truth.
