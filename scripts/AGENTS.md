# SCRIPTS KNOWLEDGE BASE

**Automation & Data Helpers**

## OVERVIEW

Utility scripts for data migration, test seeding, and infrastructure tasks.

## STRUCTURE

```
scripts/
├── create-cf-token.sh    # Generate Cloudflare tokens
├── git-preflight.sh       # Git remote/auth/upstream/push preflight
├── sync-r2.sh            # Sync R2 buckets
├── create-test-user.ts   # Seed test data (TS)
├── import-aceviewer.ts   # Import legacy AceViewer data
└── *.sql                 # Helper SQL queries
```

## CONVENTIONS

- **TypeScript First**: Complex logic in `.ts` (run via `tsx` or `ts-node`).
- **Shell**: Use `.sh` for simple wrappers or CI tasks.
- **SQL**: Store raw queries in `.sql` files for reference/manual execution.

## ANTI-PATTERNS

- **No Production Write**: Scripts should be read-only or strictly dev/test targeted unless explicitly named `migrate-*`.
- **No Hardcoded Creds**: Use env vars.
