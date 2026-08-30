# Linting

`npm run lint` runs [oxlint](https://oxc.rs). Configuration is in
`.oxlintrc.json`.

## Why oxlint and not `eslint-config-next`

The standard Next.js lint stack does not currently work on this project.

- `next lint` was **removed in Next 16**. It now parses its argument as a
  directory, so the script it replaced fails with
  `Invalid project directory provided, no such directory: .../web/lint`.
- The replacement, `eslint-config-next@16.3.3`, depends on `typescript-eslint`,
  which **hard-throws on TypeScript 7**:
  `Error: typescript-eslint does not support TS 7.0.` Every entry point of the
  config (`.`, `/core-web-vitals`, `/typescript`) pulls it in, so none of them
  can be loaded. Tracking issue:
  <https://github.com/typescript-eslint/typescript-eslint/issues/10940>.

This project is on TypeScript 7, which `tsc --noEmit` and `next build` are both
happy with. oxlint has its own parser and no TypeScript dependency, so it works
today.

**When `typescript-eslint` supports TS 7**, `eslint-config-next` can be added
alongside oxlint — mainly for `react-hooks/exhaustive-deps`, which oxlint does
not implement and which is the one meaningful gap.

## Rules turned off, and why

These are off because they do not apply to this codebase, not to silence real
findings.

| Rule | Why |
|---|---|
| `react/react-in-jsx-scope` | The project uses the automatic JSX runtime (`"jsx": "react-jsx"` in `tsconfig.json`). `React` does not need to be in scope; the rule is for the legacy classic runtime and fires on every JSX element. |
| `unicorn/no-array-sort` | Suggests `Array#toSorted()`, which needs `lib: es2023`. This project targets ES2022, so the suggestion would not compile. The code already uses the correct non-mutating pattern, `[...array].sort()`. |

## Targeted disables in source

Each of these is a single line with a comment explaining it, rather than a
project-wide rule change:

- `lib/invoices/pipeline.ts` — `no-await-in-loop`. The pipeline is sequential
  **on purpose**: each iteration calls the vision model, and firing ten
  concurrent extractions would hit rate limits; supplier and product resolution
  must also be serialized or concurrent inserts race on the unique index.
- `lib/supabase/storage.ts` — `no-control-regex`. Matching control characters is
  the point: they are stripped out of uploaded filenames before the name becomes
  a storage key.
- `components/3d/FloatingData.tsx`, `components/dashboard/PriceTrendChart.tsx` —
  `no-array-index-key`. Both render fixed arrays that are never reordered,
  inserted into, or filtered, so the index is stable.
- `components/results/ProductDetailPanel.tsx`,
  `components/dashboard/DeleteInvoiceButton.tsx` — `prefer-tag-over-role`.
  These are custom modals; `<dialog>` only behaves as a modal when opened
  imperatively with `showModal()`, so `role="dialog"` with `aria-modal` is the
  correct pattern here.
- `components/dashboard/PriceTrendChart.tsx` — `prefer-tag-over-role` for
  `role="img"`. That is the standard accessible pattern for an inline `<svg>`
  paired with `aria-label`; `<img>` would require an external asset.
