# DURABLE OBJECTS

## OVERVIEW

Cloudflare Durable Objects for stateful coordination. Current usage centers on rate limiting and OTP lock windows.

## STRUCTURE

```
durable-objects/
├── RateLimiter.ts   # DO class handling request/OTP rate limits
└── __tests__/       # Behavior and edge-case tests
```

## WHERE TO LOOK

| Task                          | File             | Notes                                       |
| ----------------------------- | ---------------- | ------------------------------------------- |
| Adjust throttling behavior    | `RateLimiter.ts` | Keep compatibility with middleware contract |
| Add a new action path         | `RateLimiter.ts` | Extend existing action-dispatch shape       |
| Validate lock-window behavior | `__tests__/`     | Cover OTP and generic limiter paths         |

## CONVENTIONS

- Keep object state serializable and version-safe.
- Preserve distinct paths for generic API limits and OTP-specific limits.
- Return stable JSON response envelopes so middleware callers remain compatible.
- Prefer explicit constants for windows/thresholds over inline literals.

## ANTI-PATTERNS

- No in-memory assumptions outside DO storage semantics.
- No breaking changes to action names without middleware updates.
- No bypass path that skips lock-state updates on failure cases.
