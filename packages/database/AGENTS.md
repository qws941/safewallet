# packages/database - Prisma Schema

## OVERVIEW

Shared Prisma client and schema. 18 entities, 10 enums, comprehensive relationships.

## STRUCTURE

```
prisma/
├── schema.prisma     # Data model (18 entities)
└── migrations/       # Migration history
src/
└── index.ts          # Re-exports Prisma client
```

## KEY ENTITIES

| Entity         | Purpose        | Key Relationships                |
| -------------- | -------------- | -------------------------------- |
| User           | Identity, auth | 15 outbound relations            |
| Site           | Organization   | 9 outbound relations             |
| SiteMembership | User↔Site join | Unique [userId, siteId]          |
| Post           | Safety reports | Images, reviews, actions         |
| PointsLedger   | Points history | Self-referential for adjustments |
| Attendance     | Daily check-in | FAS or manual source             |

## ENUMS

- **UserRole**: WORKER, SITE_ADMIN, SUPER_ADMIN, SYSTEM
- **MembershipStatus**: PENDING, ACTIVE, LEFT, REMOVED
- **ReviewStatus**: RECEIVED, IN_REVIEW, NEED_INFO, APPROVED, REJECTED
- **ActionStatus**: NONE, REQUIRED, ASSIGNED, IN_PROGRESS, DONE, REOPENED

## CONVENTIONS

### Naming

- **Fields**: camelCase in schema, snake_case in DB via `@map()`
- **Hash fields**: `phoneHash`, `dobHash` for PII lookup
- **Timestamps**: `createdAt`, `updatedAt`, `expiresAt`, `occurredAt`

### Relationships

- **Cascade**: For owned records (Post→PostImage)
- **SetNull**: For optional references (Action.assignee)

### Indexes

```prisma
@@index([phoneHash, dobHash])        // Auth lookup
@@index([siteId, reviewStatus])      // Post queries
@@index([siteId, createdAt])         // Timeline queries
```

## COMMANDS

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:push        # Push schema (dev only)
npm run db:studio      # Open Prisma Studio
```

## NOTES

- **D1 Migration**: Schema needs conversion for SQLite (DateTime→TEXT, CUID→UUID)
- **PII**: Phone/DOB stored as HMAC hashes, never plaintext
- **Immutable ledger**: PointsLedger entries never deleted, adjustments via refLedgerId
