# API SCHEDULED JOBS

## OVERVIEW

CRON orchestration for sync, retention, alerts, and month-end settlement. Jobs run inside Workers runtime and must remain idempotent.

## STRUCTURE

```
scheduled/
├── index.ts       # 9 CRON jobs + shared retry/date helpers
└── __tests__/     # scheduler behavior tests
```

## SCHEDULE MATRIX

| Window          | Jobs                                                    |
| --------------- | ------------------------------------------------------- |
| Every 5 min     | FAS incremental sync, AceTime sync, metrics alert check |
| Daily 21:00 KST | FAS full sync, overdue checks, PII lifecycle cleanup    |
| Weekly          | Retention cleanup                                       |
| Monthly (1st)   | Settlement snapshot, top-earner nomination              |

## CONVENTIONS

- Use `acquireSyncLock()` / `releaseSyncLock()` around sync-sensitive tasks.
- Use `withRetry()` for external dependency calls (FAS, alert endpoints).
- Date math uses KST-aware helpers (`getKSTDate()`, `getMonthRange()`).
- Write audit/system records for major scheduled state transitions.

## ANTI-PATTERNS

- No new CRON branch without lock strategy and failure logging.
- No direct bulk DB mutation loops without chunking (`dbBatchChunked`).
- No silent drops of retryable errors when external services fail.
