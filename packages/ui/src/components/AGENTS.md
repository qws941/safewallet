# UI COMPONENTS

## OVERVIEW

Shared shadcn/Radix component primitives consumed by both admin and worker apps.

## STRUCTURE

```
components/
├── button.tsx, input.tsx, card.tsx, badge.tsx
├── dialog.tsx, alert-dialog.tsx, sheet.tsx
├── select.tsx, switch.tsx, avatar.tsx, skeleton.tsx
├── toast.tsx, toaster.tsx, use-toast.tsx
```

## CONVENTIONS

- Keep components atomic and domain-agnostic; business logic belongs in app layers.
- Export public primitives from `src/index.ts` only.
- Preserve accessibility semantics from Radix primitives and keyboard interactions.
- Keep style variants centralized in component files (CVA/utility classes).

## ANTI-PATTERNS

- No direct API/data fetching hooks in this package.
- No app-specific text/constants baked into shared components.
- No deep import usage from apps (`@safetywallet/ui` barrel only).
