# PACKAGES/UI

## OVERVIEW

Shared shadcn/ui component library. 13 components consumed by worker-app and admin-app.

## STRUCTURE

```
src/
├── components/
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── skeleton.tsx
│   ├── avatar.tsx
│   ├── alert-dialog.tsx
│   ├── dialog.tsx
│   ├── select.tsx
│   ├── switch.tsx
│   ├── toaster.tsx
│   ├── toast.tsx
│   └── use-toast.tsx    # Toast hook (not a component)
├── index.ts              # Barrel export
└── lib/
    └── utils.ts          # cn() (clsx + tailwind-merge)
```

## CONVENTIONS

- **Import as**: `import { Button, Card } from "@safetywallet/ui"`
- **shadcn/ui conventions**: CVA variants, forwardRef, Slot composition
- **Styling**: Tailwind CSS v4, dark mode via `class` strategy
- **No custom wrappers** — use shadcn primitives directly

## ADDING COMPONENTS

1. Copy shadcn component to `src/components/`
2. Update dependencies in `package.json` if needed
3. Export from `src/index.ts` barrel

## ANTI-PATTERNS

- **No business logic** — UI primitives only
- **No direct Tailwind `@apply`** — use CVA variants
- **No app-specific styling** — keep generic
