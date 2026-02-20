# E2E: CROSS-APP

## OVERVIEW

Integration smoke tests across API, worker-app, and admin-app availability boundaries.

## STRUCTURE

```
cross-app/
└── integration.spec.ts   # Health, CORS, and multi-service response checks
```

## CONVENTIONS

- Use env-driven endpoints (`API_URL`, `WORKER_APP_URL`, `ADMIN_APP_URL`) with safe defaults.
- Keep assertions tolerant of SPA redirect timing differences.
- Validate CORS preflight behavior for both frontend origins.
- Keep response-time checks realistic for cold-start scenarios.

## ANTI-PATTERNS

- No assumptions that non-auth routes imply app-level health for all features.
- No hard fail on client redirect race conditions when content assertions can verify readiness.
- No origin checks against only one frontend host.
