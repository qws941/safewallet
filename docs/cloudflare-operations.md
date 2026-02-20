# SafetyWallet Cloudflare Operations Runbook

This runbook is the single operational guide for Cloudflare deployment and rollback in SafetyWallet.

## Scope

- Single Worker (Cloudflare Workers)
- Admin App (Cloudflare Pages)
- Worker App (Cloudflare Pages + static assets)
- D1 migrations and recovery notes

## Prerequisites

### GitHub Secrets

| Secret                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Fallback token for Workers/Pages/R2/D1 operations |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                             |

Optional scoped tokens and cache purge settings used by production workflow:

- `CLOUDFLARE_API_TOKEN_API`
- `CLOUDFLARE_API_TOKEN_WORKER`
- `CLOUDFLARE_API_TOKEN_ADMIN`
- `CLOUDFLARE_API_TOKEN_PURGE`
- `CLOUDFLARE_ZONE_ID`
- `SLACK_WEBHOOK_URL` (optional; deploy/verify notification channel)
- `DEPLOY_MONITOR_WEBHOOK_URL` (optional legacy alias; monitoring and notification fallback)
- `ELASTICSEARCH_URL` (required production secret for ELK shipping; deploy fails fast when missing)
- `ELASTICSEARCH_INDEX_PREFIX` (optional plain env var; defaults to `safewallet-logs`)

Production workflow uses fallback resolution per target:

- Worker: `CLOUDFLARE_API_TOKEN_API || CLOUDFLARE_API_TOKEN`
- Worker App: `CLOUDFLARE_API_TOKEN_WORKER || CLOUDFLARE_API_TOKEN`
- Admin App: `CLOUDFLARE_API_TOKEN_ADMIN || CLOUDFLARE_API_TOKEN`
- Cache Purge: `CLOUDFLARE_API_TOKEN_PURGE || CLOUDFLARE_API_TOKEN`

### Cloudflare Resources

- D1 databases: `safework2-db` (prod), `safework2-db-dev` (dev)
- R2 buckets: `safework2-images`, `safework2-static`
- KV namespace: `safework2-cache` (optional)

Naming policy:

- Runtime worker identity and hosts use `safewallet` / `safewallet-dev` only.
- `safework2-*` resource names are legacy infrastructure identifiers and stay unchanged in this phase.

The authoritative runtime binding config is `apps/api-worker/wrangler.toml`.

## Deploy

Policy: manual deploy is prohibited. Production deployment must be triggered only by Git reference (`master` push) through CI.

### Git Connection Preflight (Before Deploy)

Run this once before any production deploy from local environment.

```bash
npm run git:preflight
```

This checks remote connectivity, GitHub auth, upstream tracking, and a dry-run push.

### One-Worker Deploy Path

Single-worker runtime is active (`safewallet` serves API + `/` + `/admin` static routes).
Deploy execution is CI-only.

### CI/CD Production

- Trigger: CI workflow success on `master` (`workflow_run`)
- Workflow: `.github/workflows/deploy-production.yml`
- Single-worker behavior: deploys the worker only
- Deploy source: checked out by git ref (`github.event.workflow_run.head_sha`)
- Pre-deploy verification: `.github/workflows/deploy-verify.yml` via `workflow_call`
- Post-deploy verification: `.github/workflows/deploy-verify.yml` via `workflow_call`

### CI/CD Staging

- No dedicated staging deployment workflow is currently checked in under `.github/workflows/`.
- Staging verification exists in `.github/workflows/deploy-verify.yml` (`environment=staging`).
- Manual deploy is prohibited.

## D1 Migrations

Run development migration first, then production.

```bash
# Development
npm --prefix apps/api-worker run db:migrate

# Production
npm --prefix apps/api-worker run db:migrate:prod
```

Always snapshot before risky schema changes.

```bash
npx wrangler d1 export safework2-db --output=backup-$(date +%Y%m%d).sql
```

## Rollback

### Worker

```bash
npx wrangler rollback --config apps/api-worker/wrangler.toml
```

### Admin/Worker App (Removed)

Single-worker mode is active. Pages projects are removed from deployment scope.
Rollback path is worker only.

### D1

If backup exists:

```bash
npx wrangler d1 execute safework2-db --file=backup.sql --config apps/api-worker/wrangler.toml
```

If no backup exists, use Cloudflare point-in-time recovery options for the configured database.

## Post-Deploy/Post-Rollback Verification

Automated smoke verification runs in deploy workflows (`@smoke` Playwright tag).
Manual checks below remain required for incident triage and rollback confidence.

- Verify worker app: `https://safewallet.jclee.me`
- Verify admin app: `https://safewallet.jclee.me/admin` (custom domain `https://admin.safewallet.jclee.me` is also mapped)
- Verify API health and smoke routes under `https://safewallet.jclee.workers.dev/api`
- Check errors/latency dashboards and alert channels

## Official References

- Workers Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Pages deployments: https://developers.cloudflare.com/pages/configuration/deployments/
- D1 migrations: https://developers.cloudflare.com/d1/wrangler-commands/
