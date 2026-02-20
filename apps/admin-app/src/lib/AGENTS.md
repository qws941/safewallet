# ADMIN LIB MODULES

## OVERVIEW

Thin admin-side API and utility layer shared by hooks and pages.

## STRUCTURE

```
lib/
├── api.ts      # apiFetch + refresh flow + ApiError
└── utils.ts    # formatting and UI helpers
```

## CONVENTIONS

- Keep network behavior in `api.ts`; domain hooks call `apiFetch` instead of raw fetch.
- Keep `NEXT_PUBLIC_API_URL` as the single base URL source for admin API calls.
- Preserve refresh-token retry flow in `apiFetch` (401 -> `/auth/refresh` -> retry once).
- Keep `utils.ts` side-effect free and presentation-focused.

## ANTI-PATTERNS

- Do not add domain/business rules here; keep that in `src/hooks/*`.
- Do not swallow auth failures silently; throw `ApiError` with status/code.
- Do not duplicate token storage logic outside `src/stores/auth.ts`.
