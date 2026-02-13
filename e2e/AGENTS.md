# E2E TESTS

## OVERVIEW

Playwright end-to-end tests. 4 test projects targeting production URLs. 7 spec files, ~1064 total lines.

## STRUCTURE

```
e2e/
├── admin-app/               # 261L total
│   ├── pages.spec.ts        # Admin page navigation tests
│   └── smoke.spec.ts        # Admin smoke tests
├── api/                     # 391L total
│   ├── endpoints.spec.ts    # API endpoint tests (largest spec)
│   └── smoke.spec.ts        # API health/smoke tests
├── cross-app/               # 119L total
│   └── integration.spec.ts  # Cross-app integration flows
└── worker-app/              # 293L total
    ├── pages.spec.ts        # Worker page navigation tests
    └── smoke.spec.ts        # Worker smoke tests
```

## PROJECTS

| Project      | Base URL                                       | Tests          |
| ------------ | ---------------------------------------------- | -------------- |
| `api`        | `https://safework2-api.jclee.workers.dev/api/` | 2 specs (391L) |
| `worker-app` | `https://safework2-api.jclee.workers.dev`      | 2 specs (293L) |
| `admin-app`  | `https://safework2-admin.pages.dev`            | 2 specs (261L) |
| `cross-app`  | _(uses worker-app baseURL)_                    | 1 spec (119L)  |

## CONFIG

Config file: `playwright.config.ts` (repo root)

- **Timeout**: 30 seconds
- **Retries**: 2 (CI), 0 (local)
- **Reporter**: github (CI), list (local)
- **Test directory**: `./e2e` (relative to repo root)
- **Each project**: own subdirectory matching project name

## RUNNING TESTS

```bash
# All tests (from repo root)
npx playwright test

# Single project
npx playwright test --project=api

# Specific file
npx playwright test e2e/api/endpoints.spec.ts
```

## CONVENTIONS

- **Test against production URLs** (safework2.jclee.me)
- **Smoke tests**: Basic page load / health checks
- **Page tests**: Navigation, element presence
- **Endpoint tests**: API request/response validation
- **Integration tests**: Cross-app workflows

## ADDING TESTS

1. Create spec file in appropriate project directory
2. Follow `{feature}.spec.ts` naming
3. Use `test.describe()` for grouping
4. Target production URLs (configured in playwright.config.ts)

## ANTI-PATTERNS

- **No unit tests** — this project uses e2e only
- **No mocking API responses** — tests hit real endpoints
- **No test-specific env variables** — URLs hardcoded in config
