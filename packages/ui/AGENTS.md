# PROJECT KNOWLEDGE BASE: PACKAGES/UI

**Updated:** 2026-02-19  
**Package:** @safetywallet/ui

## OVERVIEW

Shared component library for the SafetyWallet ecosystem. Built on **shadcn/ui** primitives using Tailwind CSS v4. This package is consumed by `worker-app` and `admin-app` to ensure visual consistency across the construction site safety platform.

## STRUCTURE

```
src/
├── components/       # Atomic shadcn/ui components (Button, Card, Input, etc.)
├── lib/              # Shared UI utilities
│   └── utils.ts      # cn() helper (clsx + tailwind-merge)
├── index.ts          # Barrel export for all public components
└── globals.css       # Tailwind v4 directives and base styles
```

## SUBMODULE DOCS

- `src/components/AGENTS.md`: Shared primitive component boundaries and anti-patterns

## CONVENTIONS

### Component Standards

- **shadcn Consistency**: Follow the shadcn/ui pattern: Radix UI primitives + Tailwind CSS + CVA (Class Variance Authority).
- **Atomic Only**: Components must remain generic and decoupled from business logic. They should receive data via props and emit events via callbacks.
- **forwardRef**: Always use `React.forwardRef` to allow parent components to access DOM elements for focus management and animations.
- **Composition**: Prefer the `Slot` pattern (from `@radix-ui/react-slot`) for high-flexibility components.

### Styling & Theming

- **Tailwind CSS v4**: Use modern Tailwind syntax. Avoid legacy `@apply` in CSS files; prefer utility classes in TSX.
- **Dark Mode**: Support the `class` strategy for dark mode. Use `dark:` variants for themed colors.
- **CVA**: Use `class-variance-authority` for managing component variants (e.g., button sizes, colors).

### Workflow for New Components

1. **Source**: Pull primitives from shadcn/ui.
2. **Placement**: Store in `src/components/{name}.tsx`.
3. **Export**: Register the component in `src/index.ts` to make it available to the monorepo.
4. **Validation**: Ensure components are accessible (ARIA labels, keyboard navigation) before committing.

### Anti-Patterns

- **No Data Fetching**: Never perform API calls or use hooks that depend on specific backend data.
- **No Hardcoded Values**: Use Tailwind variables and theme colors instead of magic hex/rgb values.
- **No Direct Imports**: Apps should import from `@safetywallet/ui`, not reach into sub-paths.
