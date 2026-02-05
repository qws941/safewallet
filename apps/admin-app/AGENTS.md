# apps/admin-app - Admin Dashboard

**Status**: 79% complete. Missing audit logs UI, advanced stats.

## OVERVIEW

Next.js 14 admin dashboard for site managers and super admins. Desktop-first.

## STRUCTURE

```
src/
├── app/              # Next.js App Router
│   ├── layout.tsx    # Root layout with sidebar
│   ├── page.tsx      # Dashboard overview
│   ├── users/        # User management
│   ├── sites/        # Site management
│   ├── posts/        # Post review/approval
│   ├── attendance/   # Attendance records, approvals
│   ├── announcements/# Announcement CRUD
│   ├── votes/        # Vote management
│   └── stats/        # Analytics (TBD)
├── components/       # Shared admin components
├── hooks/            # useApi, useAuth, usePermissions
└── lib/              # API client, utils
```

## WHERE TO LOOK

| Task              | Location                    | Notes                  |
| ----------------- | --------------------------- | ---------------------- |
| Add admin page    | `src/app/{path}/page.tsx`   | Check role permissions |
| Add data table    | Use `@tanstack/react-table` | Pagination, sorting    |
| Check permissions | `usePermissions` hook       | Role-based UI          |
| Add API call      | Use `useApi` from hooks     | Auto token refresh     |

## KEY PATTERNS

### Role-Based Access

```typescript
const { isAdmin, isSuperAdmin, canManageUsers } = usePermissions();
if (!isAdmin) return <AccessDenied />;
```

### Data Tables

- TanStack Table for complex grids
- Server-side pagination
- Column sorting/filtering

## CONVENTIONS

- **Desktop-first**: Optimized for 1024px+ screens
- **Data density**: Tables, not cards
- **Audit trail**: All actions logged via API
- **Confirmation**: Modal for destructive actions

## ANTI-PATTERNS

| Pattern                    | Why Forbidden         |
| -------------------------- | --------------------- |
| `confirm()` for deletion   | Use modal component   |
| Skipping permission check  | Always verify role    |
| Client-side only filtering | Use server pagination |

## COMMANDS

```bash
npm run dev:admin       # Dev server (port 3001)
npm run build:admin     # Production build
```

## GAPS (TODO)

- [ ] Audit logs viewer
- [ ] Advanced statistics dashboard
- [ ] Bulk user import
- [ ] Export to CSV/Excel
