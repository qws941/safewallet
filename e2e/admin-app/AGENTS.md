# E2E: ADMIN APP

## OVERVIEW

Playwright coverage for admin dashboard flows: auth, navigation, moderation, attendance, monitoring, and settings.

## STRUCTURE

```
admin-app/
├── admin.setup.ts      # Auth bootstrap project
├── helpers.ts          # adminLogin, navigateViaSidebar, SIDEBAR_ITEMS
├── smoke.spec.ts       # Critical path checks (@smoke)
└── *.spec.ts           # Feature suites (posts, members, points, etc.)
```

## CONVENTIONS

- Use `adminLogin(page)` helper to respect rate-limit retry behavior.
- Keep URL/base config from `playwright.config.ts`; avoid hardcoding host URLs in specs.
- Reuse `SIDEBAR_ITEMS` for navigation assertions when possible.
- Favor locator-driven waits over manual timeouts.

## ANTI-PATTERNS

- No duplicated login routines in each spec; use helper/setup project.
- No brittle selectors tied to incidental DOM shape.
- No backend mocking for admin E2E; tests run against live endpoints.
