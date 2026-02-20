# E2E: WORKER APP

## OVERVIEW

Playwright specs for worker PWA login, registration, and report submission paths with Korean UI assertions.

## STRUCTURE

```
worker-app/
├── login.spec.ts      # Auth UI, form validation, responsive and PWA checks
├── register.spec.ts   # Registration field and flow checks
├── posts.spec.ts      # Authenticated safety report submission path
└── smoke.spec.ts      # Fast availability checks
```

## CONVENTIONS

- Prefer role/text locators over brittle CSS selectors.
- Validate Korean copy for critical auth and submission UX.
- Handle possible auth throttling in tests without flaking entire suite.
- Keep mobile viewport checks for high-traffic entry pages.

## ANTI-PATTERNS

- No hardcoded assumptions that every protected route redirects server-side.
- No duplicated login boilerplate when helper patterns can be extracted.
- No fixed sleeps when auto-wait or URL waits are sufficient.
