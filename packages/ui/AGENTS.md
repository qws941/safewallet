# UI PACKAGE (@safetywallet/ui)

Shared shadcn/ui component library for worker-app and admin-app.

## OVERVIEW

Minimal shadcn component set. 6 components + cn() utility. CVA for variants.

## STRUCTURE

```
src/
├── index.ts           # Barrel export (all components + cn)
├── globals.css        # Tailwind base styles
├── lib/
│   └── utils.ts       # cn() utility (clsx + tailwind-merge)
└── components/
    ├── button.tsx     # Button + buttonVariants
    ├── card.tsx       # Card, CardHeader, CardTitle, etc.
    ├── input.tsx      # Input
    ├── badge.tsx      # Badge + badgeVariants
    ├── skeleton.tsx   # Skeleton
    └── avatar.tsx     # Avatar, AvatarImage, AvatarFallback
```

## CONVENTIONS

### Adding Components

1. Use shadcn CLI or copy from ui.shadcn.com
2. Place in `src/components/{name}.tsx`
3. Export from `src/index.ts`

### Variant Pattern (CVA)

```typescript
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
});
```

### Usage in Apps

```typescript
import { Button, cn } from "@safetywallet/ui";
import "@safetywallet/ui/globals.css";
```

## DEPENDENCIES

- `class-variance-authority` - Variant management
- `clsx` - Conditional classes
- `tailwind-merge` - Merge Tailwind classes
- `lucide-react` - Icons

## ANTI-PATTERNS

- **No inline styles** - Use Tailwind classes
- **No hardcoded colors** - Use CSS variables from globals.css
- **No component logic** - Pure presentational only
