# PROJECT KNOWLEDGE BASE: SAFEWORK2

**Updated:** 2026-02-18
**Branch:** master (f4ac56e)

## OVERVIEW

SafetyWallet - Construction site safety reporting PWA. A high-performance Turborepo monorepo leveraging Cloudflare Workers (Hono + Drizzle ORM) for the backend and Next.js 14 for multiple frontends (Worker App & Admin Dashboard).

## STRUCTURE

\`\`\`
safework2/
├── apps/
│ ├── api-worker/ # Cloudflare Workers API (Hono + Drizzle)
│ ├── worker-app/ # Next.js 14 Worker PWA (CF Pages, port 3000)
│ └── admin-app/ # Next.js 14 Admin Dashboard (CF Pages, port 3001)
├── packages/
│ ├── types/ # Shared TS types, enums, and DTOs
│ └── ui/ # Shared shadcn/ui component library
├── AceTime/ # Attendance system integration (Win32 binaries/logs)
├── e2e/ # Playwright end-to-end tests
├── scripts/ # Build, deployment, and sync helpers
├── docs/ # PRDs, plans, and technical specs
└── .sisyphus/ # AI agent planning artifacts
\`\`\`

## WHERE TO LOOK

| Task             | Location                             | Notes                            |
| :--------------- | :----------------------------------- | :------------------------------- |
| Add API endpoint | \`apps/api-worker/src/routes/\`      | Hono route modules               |
| Modify DB schema | \`apps/api-worker/src/db/schema.ts\` | Drizzle ORM definitions          |
| Add shared DTO   | \`packages/types/src/\`              | Export via \`index.ts\`          |
| UI Components    | \`packages/ui/src/components/\`      | shadcn conventions               |
| Worker App pages | \`apps/worker-app/src/app/\`         | Next.js App Router (Client-only) |
| Admin App pages  | \`apps/admin-app/src/app/\`          | Next.js App Router               |
| CF Bindings      | \`apps/api-worker/wrangler.toml\`    | D1, R2, KV, DO, CRON             |
| E2E Tests        | \`e2e/\`                             | Playwright projects              |

## CODE MAP

### Entry Points

| App        | Path                                   | Framework  | Port    |
| :--------- | :------------------------------------- | :--------- | :------ |
| api-worker | \`apps/api-worker/src/index.ts\`       | Hono 4     | Workers |
| worker-app | \`apps/worker-app/src/app/layout.tsx\` | Next.js 14 | 3000    |
| admin-app  | \`apps/admin-app/src/app/layout.tsx\`  | Next.js 14 | 3001    |

### Worker App (PWA)

- **Context**: Mobile-first Next.js 14 PWA for construction site field use.
- **Structure**:
  - \`src/app/\`: App Router pages (Client-only).
  - \`src/components/\`: PWA-specific UI components.
  - \`src/stores/\`: Zustand state (Auth, Offline Cache).

## CONVENTIONS

- **Strict TypeScript**: No \`any\`, no \`ignore\`.
- **Barrel Exports**: Use \`index.ts\` for clean package imports.
- **Path Aliases**: \`@/\` maps to \`src/\` within applications.
- **Response Format**: Always use \`success(c, data)\` or \`error(c, code, msg)\` helpers.
- **Authentication**: JWT based on \`loginDate\` with daily rotation. PII is HMAC-SHA256 hashed.
- **Zustand Store**: Auth and offline state managed exclusively via Zustand with persistence.
- **Offline First**: Submission queue logic to handle intermittent site connectivity.

## ANTI-PATTERNS

- **No \`as any\`**: Active removal of legacy type casts.
- **No Browser Dialogs**: Use UI modal components instead of \`alert()\` or \`confirm()\`.
- **No \`console.log\`**: Use structured logging for production observability.
- **No Secrets in Git**: Specifically check \`.env\` and Splunk/Wrangler configs.
- **No Manual Tokens**: Never use \`localStorage\` or cookies directly for JWTs; use Zustand stores.
- **No RSC (Worker App)**: Absolute Zero RSC policy; all components must use \`'use client'\`.
- **No Placeholder Promises**: Do not ship \`Promise.resolve()\` mocks.

## UNIQUE STYLES

- **5 AM KST Cutoff**: The logical "day" starts at 5:00 AM Korea Standard Time.
- **Client-Side Only**: All Next.js pages use \`'use client'\` (Zero RSC pattern).
- **Korean Localization**: The Worker PWA is fully localized in Korean.
- **Review Workflow**: Strict state machine: \`RECEIVED\` → \`IN_REVIEW\` → \`APPROVED\`/\`REJECTED\`/\`NEED_INFO\`.

## COMMANDS

\`\`\`bash
npm run dev # Start all apps via Turborepo
npm run dev:worker # Start worker-app only
npm run dev:admin # Start admin-app only
npx drizzle-kit generate # Create DB migration SQL
npx drizzle-kit push # Sync schema directly to D1
npm run build # Full monorepo build
tsc --noEmit # Global type check (Quality Gate)
\`\`\`

## NOTES

- **Package Manager**: npm (standardized; avoid pnpm usage here).
- **Static Export**: `worker-app` is a static export for CF Pages.
- **Integration**: FAS (Foreign Attendance System) syncs via Hyperdrive (MariaDB) every 5 minutes.
- **Scheduled Tasks**: 9 CRON jobs across 4 schedules (5-min sync, daily overdue/PII, weekly retention, monthly settlement).
- **E2E Tests**: 1000+ lines Playwright; primary verification method.
- **Scale**: ~19k LOC backend, 36 route modules, 32 DB tables, 10 CF bindings.
