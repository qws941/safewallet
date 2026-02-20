# WORKER APP COMPONENTS

## OVERVIEW

Reusable mobile UI components for worker flows: guards, cards, navigation, and provider boundaries.

## STRUCTURE

```
components/
├── providers.tsx         # QueryClient + I18n + AuthGuard composition
├── auth-guard.tsx        # Authentication gate for protected pages
├── attendance-guard.tsx  # Attendance check gate for restricted actions
├── bottom-nav.tsx        # Mobile navigation shell
└── *.tsx                 # Cards/modals/presentation components
```

## CONVENTIONS

- Keep business logic in hooks/stores; components stay presentation-oriented.
- Use shared primitives from `@safetywallet/ui` where possible.
- Preserve mobile-safe spacing and PWA ergonomics.
- Keep provider stack order stable (`QueryClient -> I18n -> AuthGuard`).

## ANTI-PATTERNS

- No direct API requests inside components.
- No duplicate auth/attendance checks when guard components already exist.
- No hardcoded non-Korean user-facing labels in worker flows.
