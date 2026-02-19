# WORKER LIB MODULES

## OVERVIEW

Client runtime utilities for network access and media processing in the worker PWA.

## STRUCTURE

```
lib/
├── api.ts              # apiFetch, token refresh mutex, offline queue
├── image-compress.ts   # Canvas compression + EXIF stripping
├── utils.ts            # small shared helpers
└── __tests__/          # lib tests
```

## CONVENTIONS

- Use `apiFetch()` for all HTTP calls from hooks/components.
- Keep auth token lifecycle inside `api.ts` (`refreshPromise` mutex + store updates).
- Offline write flows should enable `offlineQueue` and rely on `flushOfflineQueue()` when online.
- Preserve image privacy behavior: canvas redraw strips EXIF metadata.

## ANTI-PATTERNS

- No direct `fetch()` from feature code when `apiFetch()` already handles auth/refresh/errors.
- No token handling in UI components.
- No image upload path that bypasses `compressImage()` for user-provided photos.
