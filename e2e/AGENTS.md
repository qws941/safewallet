# AGENT CONTEXT: E2E TESTING

## OVERVIEW

This directory contains the Playwright-based end-to-end testing suite for the SafetyWallet platform. Unlike unit tests, these verify full user flows and API integrity against **live production environments**. High reliability and deterministic behavior are the primary goals for all automation in this domain.

## STRUCTURE

The suite is organized into subdirectories matching the Playwright projects defined in the root `playwright.config.ts`:

- `admin-app/`: Tests for the Next.js 14 Admin Dashboard (navigation, stats, user management).
- `worker-app/`: Tests for the Next.js 14 PWA Worker App (reporting, profile, attendance).
- `api/`: Direct API request/response validation targeting the Cloudflare Worker backend.
- `cross-app/`: Complex integration flows that span multiple applications (e.g., Worker report → Admin review).

## CONVENTIONS

- **Production-First**: Tests target production URLs (safework2.jclee.me). Never mock the backend.
- **Execution Modes**:
  - Use `test.describe.configure({ mode: 'serial' })` for dependent sequences (Auth flow).
  - Use `parallel` mode for independent smoke and page navigation tests.
- **Tagging Strategy**:
  - Use `@smoke` for critical health checks.
  - Use descriptive feature-based naming for all `test.describe` blocks.
- **Reliability**:
  - Handle API rate limiting (429) with explicit retry logic in test setups.
  - Use Playwright's auto-waiting locators; avoid `page.waitForTimeout`.
- **API Testing**: Use the `request` fixture for endpoint validation. Verify JSON schema and status codes.
- **Localization**: `worker-app` tests must validate Korean (ko) UI strings.
- **Naming**: Files must follow the `{feature}.spec.ts` pattern.

### Key Commands

- Run all: `npx playwright test`
- Specific project: `npx playwright test --project=worker-app`
- UI Mode: `npx playwright test --ui`

## SUBMODULE DOCS

- `e2e/admin-app/AGENTS.md`: Admin login setup, sidebar helpers, rate-limit-safe patterns
- `e2e/api/AGENTS.md`: API endpoint validation, serial auth flow, CORS and status checks
