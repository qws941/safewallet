# E2E: API PROJECT

## OVERVIEW

Request-level validation for the production API surface: auth lifecycle, protected endpoint guards, and protocol behavior (CORS/status envelopes).

## STRUCTURE

```
api/
├── endpoints.spec.ts   # Broad endpoint contract checks
└── smoke.spec.ts       # Fast health and gateway checks (@smoke)
```

## CONVENTIONS

- Keep auth-dependent checks in serial blocks (`test.describe.configure({ mode: "serial" })`).
- Validate envelope shape (`success`, `data`/`error`) and status code together.
- Handle transient 429 responses with bounded retry logic where login/bootstrap is required.
- Use project `request` fixture; do not mix browser-page assertions in API specs.

## ANTI-PATTERNS

- No assumption that non-2xx is always one status; preserve allowed ranges where API intentionally varies (400/401/404).
- No hardcoded tokens; obtain through login/refresh sequence inside tests.
- No skipped assertions on response body semantics when status passes.
