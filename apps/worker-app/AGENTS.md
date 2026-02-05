# apps/worker-app - Worker PWA

**Status**: 100% complete. Production-ready.

## OVERVIEW

Next.js 14 Progressive Web App for construction workers. Mobile-first, offline-capable.

## STRUCTURE

```
src/
├── app/              # Next.js App Router pages
│   ├── layout.tsx    # Root layout, PWA config
│   ├── page.tsx      # Dashboard (attendance, posts)
│   ├── posts/        # View/create safety reports
│   ├── profile/      # User profile, points
│   ├── join/         # Site join flow (QR/code)
│   ├── attendance/   # Daily check-in status
│   └── vote/         # Monthly voting
├── components/       # Page-specific components
├── hooks/            # useApi, useAuth, useToast
├── lib/              # API client, utilities
└── stores/           # Zustand state stores
```

## WHERE TO LOOK

| Task             | Location                    | Notes                 |
| ---------------- | --------------------------- | --------------------- |
| Add page         | `src/app/{path}/page.tsx`   | App Router convention |
| Add component    | `src/components/{feature}/` | Co-locate with page   |
| Add API call     | Use `useApi` hook           | Auto token refresh    |
| Add global state | `src/stores/{name}.ts`      | Zustand store         |
| PWA config       | `next.config.js`            | next-pwa settings     |

## KEY PATTERNS

### API Client (useApi hook)

```typescript
const { data, isLoading, error } = useApi("/posts", { siteId });
```

- Auto-injects Bearer token
- Handles 401 → token refresh → retry
- Returns typed response

### State Management

- **Zustand**: Auth state, site context, UI preferences
- **TanStack Query**: Server state, caching

## CONVENTIONS

- **Mobile-first**: All layouts start from mobile viewport
- **PWA**: Service worker, manifest, offline fallback
- **Korean locale**: All UI strings in Korean
- **Time**: Asia/Seoul timezone, 5 AM day boundary

## ANTI-PATTERNS

| Pattern                 | Why Forbidden                       |
| ----------------------- | ----------------------------------- |
| `alert()` / `confirm()` | Use toast or modal components       |
| Direct fetch()          | Use `useApi` hook for auth handling |
| Inline styles           | Use Tailwind classes                |

## COMMANDS

```bash
npm run dev:worker      # Dev server (port 3000)
npm run build:worker    # Production build
npx wrangler pages dev  # Test on Cloudflare Pages
```
