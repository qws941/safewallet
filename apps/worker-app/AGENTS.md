# WORKER-APP: Next.js 14 PWA

## OVERVIEW

Mobile-first safety reporting PWA for construction workers.

- **Tech Stack**: Next.js 14 (Client-only), Zustand, TanStack Query.
- **Deployment**: Cloudflare Pages (Static Export: `output: 'export'`).
- **Domain**: High-frequency reporting, attendance, and education (Korean UI).

## STRUCTURE

```
src/
├── app/                # App Router (ALL 'use client')
│   ├── layout.tsx      # PWA Metadata & Providers
│   ├── login/          # AceTime/Phone dual-auth
│   ├── education/      # Quizzes, TBM, education hub
│   ├── posts/          # Safety reports (R2 image uploads)
│   └── points/         # Leaderboard & rewards
├── components/         # Mobile UI (BottomNav, QRScanner)
├── hooks/              # use-api (20+ TanStack Query hooks)
├── stores/             # auth.ts (Zustand + localStorage)
└── lib/                # apiFetch (auto-refresh), image-compress
```

## WHERE TO LOOK

| Task            | Location                                   |
| :-------------- | :----------------------------------------- |
| Add new page    | `src/app/` (Must have `'use client'`)      |
| API Integration | `src/hooks/use-api.ts` (Shared hooks)      |
| Auth logic      | `src/stores/auth.ts` + `src/lib/api.ts`    |
| Image handling  | `src/lib/image-compress.ts` (Canvas-based) |
| QR Scanning     | `src/components/qr-scanner.tsx`            |

## SUBMODULE DOCS

- `src/lib/AGENTS.md`: API client, offline queue, token refresh, image compression

## CONVENTIONS

- **Mobile-First**: Use `pb-nav` and `safe-bottom` for notch/navbar padding.
- **Static Export**: Zero RSC components. No `headers()` or `cookies()` from `next/headers`.
- **Localization**: Pure Korean (ko-KR) strings only.
- **State Management**: Zustand for auth; TanStack Query for server state.
- **Image Upload**: Compress to JPEG 80%, skip if <100KB, max width 1920px.

## ANTI-PATTERNS

- **No RSC**: Do not use Server Components; static export will fail.
- **No Native Dialogs**: Use `unsafe-warning-modal.tsx` or similar shadcn primitives.
- **No Manual Token Storage**: Use `useAuth` hook/store to manage tokens.
- **Avoid Loose Casts**: Specifically check `app/points/page.tsx:180` for history array casts.
