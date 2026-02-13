# WORKER-APP (Next.js 14 PWA)

## OVERVIEW

Construction worker mobile PWA. Next.js 14 App Router, static export to CF Pages.

## STRUCTURE

```
src/
├── app/
│   ├── layout.tsx              # Root layout, PWA metadata, Providers
│   ├── page.tsx                # Root redirect (→ login | join | home)
│   ├── login/page.tsx          # Employee code + name login form
│   ├── join/page.tsx           # Site join (QR scan or code entry)
│   ├── home/page.tsx           # Dashboard (attendance, points, ranking)
│   ├── posts/
│   │   ├── page.tsx            # Posts list
│   │   ├── new/page.tsx        # Create post (R2 image upload)
│   │   └── view/page.tsx       # View single post
│   ├── education/
│   │   ├── page.tsx            # Education hub (316L, tabs: Contents/Quizzes/TBM)
│   │   ├── view/page.tsx       # Course detail
│   │   └── quiz-take/page.tsx  # Take quiz
│   ├── points/page.tsx         # Leaderboard
│   ├── announcements/page.tsx  # Site announcements
│   ├── votes/page.tsx          # Monthly voting
│   ├── actions/
│   │   ├── page.tsx            # Corrective actions list
│   │   └── view/page.tsx       # Action detail view
│   └── profile/page.tsx        # User profile, logout
├── components/
│   ├── providers.tsx           # TanStack QueryClient + Toaster
│   ├── header.tsx              # Sticky top bar + site ID
│   ├── bottom-nav.tsx          # 5-item bottom navigation
│   ├── post-card.tsx           # Post display
│   ├── points-card.tsx         # Points balance
│   ├── ranking-card.tsx        # User ranking
│   ├── qr-scanner.tsx          # QR code scanner (@yudiel/react-qr-scanner)
│   ├── attendance-guard.tsx    # Attendance check wrapper
│   └── unsafe-warning-modal.tsx
├── hooks/
│   ├── use-auth.ts             # Auth store wrapper
│   ├── use-api.ts              # TanStack Query hooks (279L, 20+ hooks)
│   └── use-leaderboard.ts      # Leaderboard hook
├── stores/
│   └── auth.ts                 # Zustand auth store (localStorage)
└── lib/
    ├── api.ts                  # apiFetch + auto token refresh
    ├── image-compress.ts       # Canvas resize (>1920px), JPEG 80%, skip <100KB
    └── utils.ts                # cn() re-export
```

## CONVENTIONS

- **ALL pages `'use client'`** — zero RSC, static export
- **Auth state**: Zustand → localStorage key `safetywallet-auth`
- **Server data**: TanStack Query (staleTime: 60s, no auto-refetch)
- **API base**: `NEXT_PUBLIC_API_URL` env or `http://localhost:3333`
- **Auto 401 handling**: `lib/api.ts` intercepts → refresh → retry → logout
- **Korean (ko-KR)** localization, **mobile-first** (`pb-nav` / `safe-bottom` padding)

## ANTI-PATTERNS

- No `alert()`/`confirm()` — use modal components
- **Known**: `app/points/page.tsx:180` — type assertion on history array (not `as any`, but loose cast)

## LOGIN FLOW

1. `/` → redirects to `/login` if unauthenticated
2. LoginPage: dual-auth — AceTime (`employee_code` + `name`) OR Phone (`phone` + `dob`)
3. Response: `{ accessToken, refreshToken, user }`
4. `login()` → updates Zustand store → redirects to `/join`
5. After site join → `/home` (dashboard)

## PWA

- **Manifest**: Korean, portrait, standalone, `#ff8c42` theme. Viewport: no-zoom
- **Service worker**: next-pwa generated `sw.js`
