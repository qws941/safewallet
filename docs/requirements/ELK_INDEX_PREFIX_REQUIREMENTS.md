# ELK Index Prefix Requirements Definition

> Version: v1.0  
> Date: 2026-02-20  
> Scope: `apps/api-worker` logging path (`logger`, `request-logger`, `scheduled`)

---

## 1. Background and Problem

Current operations observed index-name drift between runtime and code:

- Runtime ELK index: `safework2-logs-*`
- Current code default index: `safewallet-logs-*`

This mismatch causes query confusion, dashboard inconsistency, and delayed incident response.

---

## 2. Goal

Make Elasticsearch index naming controllable by configuration (not hardcoded) so that deployments can switch index family safely without source edits.

---

## 3. In Scope / Out of Scope

### In Scope

- Add index prefix binding: `ELASTICSEARCH_INDEX_PREFIX`
- Apply same rule across all ELK write paths in API Worker
- Keep backward-compatible default behavior when the variable is missing
- Add tests for override behavior

### Out of Scope

- Elasticsearch alias/ILM/pipeline design changes
- Kibana dashboard migration
- Historical data reindexing

---

## 4. Definitions

- `ELASTICSEARCH_URL`: Elasticsearch endpoint URL (existing binding)
- `ELASTICSEARCH_INDEX_PREFIX`: Index prefix for log writes (new binding)
- Final index format: `{ELASTICSEARCH_INDEX_PREFIX}-{YYYY.MM.DD}`

---

## 5. Functional Requirements

### FR-1. Configurable Index Prefix

- The system MUST read `ELASTICSEARCH_INDEX_PREFIX` from Worker bindings.
- If missing, the system MUST default to `safewallet-logs`.

### FR-2. Unified Prefix Rule Across Log Paths

The same prefix rule MUST be applied to:

1. `createLogger()` Elasticsearch shipping (`warn`/`error`)
2. `requestLoggerMiddleware` error/warn request logging
3. `emitSyncFailureToElk()` scheduled failure telemetry

### FR-3. No Breaking Change on Missing Config

- Existing deployments without `ELASTICSEARCH_INDEX_PREFIX` MUST continue to write to `safewallet-logs-*`.

### FR-4. Environment Binding Support

- `wrangler.toml` production and `env.dev` MUST allow setting `ELASTICSEARCH_INDEX_PREFIX`.

---

## 6. Non-Functional Requirements

### NFR-1. Compatibility

- Existing API contracts and response formats MUST remain unchanged.

### NFR-2. Reliability

- Logging path must not block request handling if Elasticsearch is unavailable (existing async/best-effort behavior preserved).

### NFR-3. Observability Consistency

- All three logging paths MUST resolve to the same prefix source to avoid split-index writes.

---

## 7. Acceptance Criteria

### AC-1. Prefix Override Works

- Given `ELASTICSEARCH_INDEX_PREFIX=safework2-logs`,
- When warn/error logs are emitted,
- Then write target includes `/safework2-logs-YYYY.MM.DD/_doc`.

### AC-2. Default Fallback Works

- Given `ELASTICSEARCH_INDEX_PREFIX` is undefined,
- When logs are emitted,
- Then write target includes `/safewallet-logs-YYYY.MM.DD/_doc`.

### AC-3. Scheduled Failure Telemetry Uses Same Prefix Rule

- Given override prefix,
- When `emitSyncFailureToElk()` runs,
- Then endpoint uses overridden prefix for deterministic `_doc` writes.

### AC-4. Verification Gate

- Related tests pass
- TypeScript typecheck passes
- Worker dry-run build passes

---

## 8. Implementation Mapping

- `apps/api-worker/src/lib/logger.ts`
  - add optional `elasticsearchIndexPrefix` in `LoggerOptions`
  - apply fallback to `safewallet-logs`
- `apps/api-worker/src/middleware/request-logger.ts`
  - pass `c.env.ELASTICSEARCH_INDEX_PREFIX` to logger
- `apps/api-worker/src/index.ts`
  - pass `c.env.ELASTICSEARCH_INDEX_PREFIX` in `onError` logger
- `apps/api-worker/src/scheduled/index.ts`
  - apply prefix override for scheduled ELK endpoint
- `apps/api-worker/src/types.ts`
  - add `ELASTICSEARCH_INDEX_PREFIX?: string`
- `apps/api-worker/wrangler.toml`
  - define `ELASTICSEARCH_INDEX_PREFIX` for production/dev vars

---

## 9. Test Requirements

- `src/lib/__tests__/logger.test.ts`
  - MUST verify override prefix target URL
- `src/scheduled/__tests__/index.test.ts`
  - MUST verify override prefix endpoint
- `src/middleware/__tests__/request-logger.test.ts`
  - MUST verify middleware passes prefix to `createLogger`

---

## 10. Operational Notes

- If production still writes to `safework2-logs-*`, set `ELASTICSEARCH_INDEX_PREFIX=safework2-logs` until full cutover.
- For final rename to `safewallet-logs-*`, switch only this variable and verify fresh index creation for the current date.
