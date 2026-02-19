# LIB UTILITIES

27 utility modules (4.5k LOC). Backbone of the API — crypto, integrations, logging, state machines.

## INVENTORY

### Integration & External Services

| Module                  | Lines | Purpose                                      |
| ----------------------- | ----- | -------------------------------------------- |
| web-push.ts             | 446   | Web Push API, subscription management        |
| fas-mariadb.ts          | 407   | FAS MariaDB queries via Hyperdrive           |
| fas-sync.ts             | 336   | FAS→D1 employee upsert, deactivation         |
| alerting.ts             | 318   | Webhook dispatch (Slack/Teams) on failures   |
| sms.ts                  | 255   | SMS sending via provider API                 |
| workers-ai.ts           | 164   | Workers AI: hazard classification, face blur |
| notification-queue.ts   | 132   | CF Queue message handling for push delivery  |
| device-registrations.ts | 91    | Device tracking for push notifications       |

### Security & Crypto

| Module         | Lines | Purpose                                  |
| -------------- | ----- | ---------------------------------------- |
| crypto.ts      | 218   | HMAC-SHA256 hashing, PII encrypt/decrypt |
| jwt.ts         | 71    | JWT create/verify, loginDate claim       |
| key-manager.ts | 108   | Encryption key rotation                  |
| rate-limit.ts  | 189   | Rate limiting via Durable Objects        |

### Business Logic

| Module           | Lines | Purpose                                |
| ---------------- | ----- | -------------------------------------- |
| points-engine.ts | 310   | Points calculation, monthly settlement |
| state-machine.ts | 175   | Review/action status transitions       |
| audit.ts         | 207   | Audit log creation, action tracking    |

### Image Processing

| Module              | Lines | Purpose                           |
| ------------------- | ----- | --------------------------------- |
| image-privacy.ts    | 148   | Blur, watermark for privacy       |
| face-blur.ts        | 131   | Face detection & blur via AI      |
| phash.ts            | 152   | Perceptual hashing for similarity |
| aceviewer-parser.ts | 139   | AceTime photo metadata parsing    |

### Infrastructure

| Module           | Lines | Purpose                         |
| ---------------- | ----- | ------------------------------- |
| logger.ts        | 260   | Structured JSON logging         |
| session-cache.ts | 66    | Session caching layer           |
| sync-lock.ts     | 67    | Distributed lock (KV-based)     |
| response.ts      | 33    | `success()` / `error()` helpers |
| constants.ts     | 17    | Batch sizes, timeouts           |
| observability.ts | 6     | Observability stubs             |

### Type Declarations

| Module        | Lines | Purpose            |
| ------------- | ----- | ------------------ |
| sql-js.d.ts   | 25    | sql.js type shim   |
| piexifjs.d.ts | 14    | piexifjs type shim |

## CONVENTIONS

- All helpers accept `c` (Hono Context) as first arg for binding access.
- Use `logger.ts` for all logging — never `console.log`.
- State transitions MUST go through `state-machine.ts`.
- PII operations MUST use `crypto.ts` — never store plaintext.
