# WORKER I18N

## OVERVIEW

Client-side locale loading, message context, and key-based translation utilities.

## STRUCTURE

```
i18n/
├── config.ts       # supported locales + default locale
├── loader.ts       # lazy locale JSON loader + fallback
├── context.tsx     # I18nProvider, locale state, persistence
├── translate.ts    # nested key lookup + interpolation
└── index.ts        # public exports
```

## CONVENTIONS

- Keep `defaultLocale` aligned with business default (`ko`).
- Load messages via `loader.ts`; do not import locale JSON directly in pages.
- Keep fallback behavior deterministic: requested locale -> default locale.
- Keep translation keys dot-notated and stable (`a.b.c`) for `getNestedValue`.

## ANTI-PATTERNS

- No page-level ad-hoc translation dictionaries.
- No breaking rename of translation keys without updating all callers.
- No provider usage outside client components.
