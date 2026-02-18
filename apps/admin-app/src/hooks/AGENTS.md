# ADMIN HOOKS

17 domain-specific TanStack Query hooks (2.6k LOC). Each wraps API endpoints for a single domain.

## INVENTORY

| Hook                   | Lines | Domain                                      |
| ---------------------- | ----- | ------------------------------------------- |
| use-education-api.ts   | 531   | Course/quiz/question CRUD, progress         |
| use-admin-api.ts       | 300   | Dashboard stats, members, announcements     |
| use-points-api.ts      | 175   | Points balance, history, settlement         |
| use-attendance.ts      | 160   | Attendance records, overrides               |
| use-votes.ts           | 139   | Vote periods, candidates, results           |
| use-recommendations.ts | 119   | Safety recommendation CRUD                  |
| use-rewards.ts         | 118   | Reward configuration, distribution          |
| use-posts-api.ts       | 111   | Post review, moderation, filtering          |
| use-monitoring-api.ts  | 97    | System metrics (60s refetch interval)       |
| use-actions-api.ts     | 77    | Corrective action tracking                  |
| use-sync-errors.ts     | 75    | FAS sync error review, resolution           |
| use-trends.ts          | 70    | Trend analysis, statistics                  |
| use-sites-api.ts       | 50    | Site management                             |
| use-fas-sync.ts        | 40    | FAS sync trigger, status                    |
| use-stats.ts           | 33    | Dashboard statistics                        |
| use-api.ts             | 15    | Barrel export (re-exports all domain hooks) |
| use-api-base.ts        | 5     | Base `apiFetch` re-export                   |

## PATTERN

```typescript
// Every domain hook follows this structure:
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useDomainList(siteId: string) {
  return useQuery({
    queryKey: ["admin", "domain", siteId],
    queryFn: () => apiFetch("/admin/domain", { params: { siteId } }),
  });
}

export function useDomainMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) =>
      apiFetch("/admin/domain", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "domain"] }),
  });
}
```

## CONVENTIONS

- **Query keys**: `["admin", "domain", ...params]` — always namespaced with `"admin"`.
- **Barrel export**: Import via `use-api.ts` for backward compat, or directly from domain hook.
- **Refetch intervals**: Only `use-monitoring-api.ts` uses auto-refetch (60s). All others on-demand.
- **Never `fetch()` directly** — always through `apiFetch` from `@/lib/api`.

## ADDING A HOOK

1. Create `src/hooks/use-{domain}-api.ts`
2. Follow query key pattern: `["admin", "{domain}", ...params]`
3. Export from `use-api.ts` barrel
4. Use `useMutation` with `onSuccess` invalidation
