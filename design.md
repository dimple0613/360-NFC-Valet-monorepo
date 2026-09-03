# saasclaude Design System

Status: applied to `web/` on top of the existing shadcn/ui (`base-nova` style) + Tailwind CSS v4 setup. This document is the reference for anyone (human or Claude) adding UI — read it before introducing a new color, font size, or component variant.

The one rule that matters more than any individual token: **never write a raw color or font-size value in a component.** Every visual property comes from a CSS variable defined in `web/src/app/globals.css`, consumed through Tailwind utilities (`bg-primary`, `text-muted-foreground`, `text-title`, ...). If a new UI need doesn't fit an existing token, extend the token set in `globals.css` rather than reaching for an arbitrary value in a component file.

## Source of truth

| What | Where |
|---|---|
| Token values (colors, type scale, radius, shadows) | `web/src/app/globals.css` |
| Font loading | `web/src/app/layout.tsx` (`next/font/google`) |
| Base component styling (button, input, card, ...) | `web/src/components/ui/*.tsx` — shadcn primitives, customized to consume the tokens below |
| shadcn config | `web/components.json` (`style: "base-nova"`, `baseColor: "neutral"`, `cssVariables: true`) |

`components.json`'s `baseColor: "neutral"` is only the seed shadcn used when it scaffolded these files — the actual palette is fully overridden in `globals.css`. Don't re-run shadcn's neutral theme generator over this file.

## Brand palette

Raw brand colors, defined once in `globals.css` as `--brand-*` and never referenced directly from components — they exist only to feed the semantic tokens below.

| Token | Hex | Role |
|---|---|---|
| `--brand-sunset` | `#F4531F` | Primary / action color |
| `--brand-sunset-tint` | `#FEEFEB` | Sunset at ~10% — subtle accent surfaces |
| `--brand-navy` | `#1C2B46` | Deep Navy — primary text, navigation |
| `--brand-slate` | `#6C7A93` | Secondary / muted text |
| `--brand-mist` | `#F6F7F9` | Page surface / background |
| `--brand-success` | `#0C9D61` | Success status |
| `--brand-warning` | `#E9A23B` | Warning status |
| `--brand-danger` | `#E23D3D` | Destructive / error status |

## Semantic color tokens

These are what components actually use (as Tailwind utilities: `bg-primary`, `text-foreground`, `border-border`, etc.). Values below are light mode; `.dark` redefines the same variable names with a navy-based dark surface (see globals.css — tokens are ready but no theme toggle is wired up yet, so dark mode is dormant infrastructure, not a shipped feature).

| Token | Light value | Usage |
|---|---|---|
| `background` | Mist `#F6F7F9` | Page background |
| `foreground` | Navy `#1C2B46` | Default text |
| `card` / `popover` | `#FFFFFF` | Elevated surfaces above the mist background |
| `primary` | Sunset `#F4531F` | Primary buttons, links, focus ring, active states |
| `secondary` | Navy `#1C2B46` | Secondary solid buttons — deliberately a second strong color, not a gray fallback |
| `muted` | `#ECEEF2` | Low-emphasis surfaces (table stripes, footer bars) |
| `muted-foreground` | Slate `#6C7A93` | Secondary text, descriptions, placeholders |
| `accent` | Sunset tint `#FEEFEB` | Hover/selected states, subtle highlight |
| `destructive` | Danger `#E23D3D` | Errors, destructive actions |
| `success` | `#0C9D61` | Success badges/alerts/buttons |
| `warning` | Amber `#E9A23B` | Warning badges/alerts/buttons (foreground is Navy, not white — amber is too light for white text to pass contrast) |
| `border` / `input` | `#E2E5EB` | Hairlines, form borders |
| `ring` | Sunset | Focus rings |
| `sidebar` | Navy `#1C2B46` | Navigation is a dark surface, per brand direction ("Deep Navy for navigation") |
| `sidebar-primary` | Sunset | Active nav item accent |

Every token has a paired `-foreground` variable (`primary-foreground`, `success-foreground`, `warning-foreground`, `sidebar-foreground`, ...) — always pair text with its matching foreground token, never assume white/black.

### Status color usage

`success` / `warning` / `destructive` exist as full variant sets on `Badge`, `Alert`, and `Button` (`variant="success"`, `variant="warning"`, `variant="destructive"`). They are infrastructure, not automatically wired to any business status field — a module/page decides when e.g. an organization status maps to `success` vs `destructive`. Don't hardcode `bg-green-500` etc.; use the variant.

## Typography

Font family: **Plus Jakarta Sans** for all UI text (loaded via `next/font/google` as `--font-plus-jakarta-sans`, mapped to Tailwind's `font-sans`/`font-heading`). Geist Mono remains `font-mono`, used only for code-like content (API keys, secrets, permission keys) — this was an explicit, narrow existing usage and is unrelated to the brand type choice.

Type scale, defined in `globals.css` under `@theme` as paired Tailwind v4 font-size utilities (each class sets size + line-height + weight + tracking together — one class, no separate `font-bold` needed):

| Class | Size / weight | Usage |
|---|---|---|
| `text-display` | 28px / 800 | Page-level H1s (auth screens, empty/error states) |
| `text-title` | 20px / 800 | Card, dialog, and sheet titles |
| `text-section` | 15px / 600 | Sub-section headers, small-card titles |
| `text-body` | 14px / 500 | Primary content text (e.g. table cells) |
| `text-overline` | 11px / 800, uppercase, tracked | Eyebrow labels — sidebar group labels, table column headers |

Applied so far: `CardTitle`/`DialogTitle`/`SheetTitle` → `text-title`; all auth-flow `<h1>`s and the `forbidden`/`unauthorized` pages → `text-display`; `SidebarGroupLabel` → `text-overline uppercase`; `TableHead` → `text-overline uppercase` (column headers), `Table` body → `text-body`. Regular UI text (form labels, descriptions, buttons) intentionally keeps Tailwind's standard `text-sm`/`text-xs` utilities rather than being forced onto the 5-step scale — the scale is for structural/heading text, not every string in the app.

When a new heading doesn't fit one of the 5 steps, that's a signal to reconsider the layout, not to add a 6th ad-hoc size.

## Spacing, radius, shadows

- Spacing: Tailwind's default scale (`p-2`, `gap-4`, ...) — not customized. Component-local spacing (e.g. card padding) is parameterized via existing `--card-spacing`-style local variables; keep that pattern for new components rather than hardcoding paddings.
- Radius: driven by a single `--radius: 0.875rem` (14px) base, with `--radius-sm/md/lg/xl/2xl/3xl/4xl` derived from it via `calc()`. This lands inputs/selects (`rounded-lg`) at ~14px and cards/dialogs (`rounded-xl`) at ~20px, matching the design reference's "cards 20px radius" spec. **Buttons are the exception — always a full pill** (`rounded-full`), set directly in `button.tsx` and not derived from `--radius`. To change the app's overall corner roundness, edit `--radius` once — don't hand-tune radii per component.
- Shadows: `--shadow-xs` through `--shadow-xl` are redefined with a Navy tint (`rgb(28 43 70 / …)`) instead of Tailwind's default pure-black shadows, for a softer, "premium" elevation feel. Use the standard `shadow-sm`/`shadow-md`/etc. utilities — they already resolve to the tinted versions. Two extra elevation tokens are plain custom properties on `:root`/`.dark` (not `@theme`, so the `.dark` overrides apply) and are referenced as `shadow-(--shadow-panel)` / `shadow-(--shadow-glow)`: **`--shadow-panel`** is the resting elevation on `Card` (hairline + soft wide drop, per the design reference — every Card carries it, don't add another); **`--shadow-glow`** is the sunset cast under the primary `Button` variant, dropped on `:active`.
- Card spacing: `Card`'s internal `--card-spacing` is `--spacing(5)` (20px), `--spacing(4)` (16px) for `size="sm"`. The portal shells (`super-admin`/`tenant-admin` layouts) pad their `<main>` at `p-6 md:p-8 lg:p-10` for the reference's roomier rhythm.

## Components

All shadcn primitives in `web/src/components/ui/` were already built against semantic CSS variables (this is the `base-nova` style) — no component had a hardcoded color before this pass, so applying the brand was a token-value change plus a few targeted additions, not a rewrite:

- **Button, Input, Select, Card, Table, Badge, Alert, Dialog, Dropdown Menu, Sidebar, Tooltip, Sheet, Avatar, Breadcrumb** — all consume the semantic tokens automatically; no per-component color edits were needed beyond typography (above).
- **Badge / Alert / Button** — added `success` and `warning` variants alongside the existing `default`/`secondary`/`destructive`/`outline` set, so status UI has a token-backed option instead of inline colors.
- **Badge** — every variant is a tinted pill (pale fill + saturated text), the reference's status-pill style: `default` is tinted Sunset, `secondary` a neutral grey pill, `success`/`warning`/`destructive` their own tints (`solid` stays available for a rare filled chip). Status badges pass `dot` for the leading ● in the badge's own colour.
- **Button** — every size is a full pill (`rounded-full`); the primary variant carries `--shadow-glow`.
- **Auth** — one full-bleed split layout for every `(auth)` route: a navy-gradient brand panel (`bg-linear-[150deg] from-(--brand-navy-deep) via-(--brand-navy) to-(--brand-navy-lift)`) on the left, the form on the right.
- **Input / Textarea / Select trigger** — filled at rest (`bg-muted/50`), going transparent on focus; `h-9` with `px-3`. The filled resting state is deliberate (matches the design reference's field style) — don't set `bg-transparent` on form controls.
- **Select content / Dropdown Menu** — popover surfaces use `border border-border` + `shadow-lg` + `rounded-xl` (not `ring-1`), matching `Card`'s treatment; menu items are `px-2 py-1.5`.
- **Table** — column headers are `text-overline uppercase`; cells are `px-3 py-2.5`. Sortable header `<button>`s need an explicit `uppercase` (Preflight resets `text-transform` on buttons). `DataTable` wraps its `Table` in a `rounded-xl border` container with a tinted header row (skipped when `compact`).
- **Row lists** (custom `*-row.tsx` on the Customers / Plans / Roles / Currencies / Invoices / Subscriptions / org-detail Users screens) — the row map goes inside `<div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-panel)">` (a contained card, dividers between rows). Each row's root is `flex flex-wrap items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 md:px-5` — no own `border-b`, the container's `divide-y` handles separators.
- **Avatar** — `AvatarFallback` is a Sunset-tint circle (`bg-accent`) with `font-semibold` navy initials, per the reference's avatar style.
- **Sidebar** — renders as a solid Navy surface (`--sidebar`) with Sunset as the active-item accent (`--sidebar-primary`), per the brand direction that Navy owns navigation.

### Icon tiles

`components/icon-tile.tsx` (`<IconTile>`) — a lucide icon inside a rounded, tinted square, per the design reference's section-icon style. Variants: `tint` (Sunset icon on `bg-accent`, the default), `muted`, `solid` (white icon on `bg-primary` + glow, for a brand mark). Sizes `sm`/`md`/`lg`. Reach for this instead of a bare `<Icon>` beside a heading.

### Page headers

Portal pages use `components/page-header.tsx` (`<PageHeader>`) for their top-of-page heading — an optional `crumbs` trail (rendered through the `Breadcrumb` primitive), a `text-title` `<h1>`, and: `icon` (rendered inside an `IconTile` beside the title — pass every list/detail page a section icon), `titleTrailing` (an inline status `Badge`), `description` (below the icon+title row), `actions` (right-aligned). Don't hand-roll a `<nav>` + `<h1>` block per page. Top-level list pages pass no `crumbs`; sub-pages pass the full `Home › Section › …` trail.

### Adding a new component

1. Reach for an existing `ui/` primitive first.
2. If it needs a new visual variant (e.g. a new `Badge` color), add a `cva` variant using existing semantic tokens — don't invent a new token unless the brand palette genuinely has no matching color.
3. If a genuinely new token is needed (e.g. a chart needs a 6th series color), add it next to the existing `--chart-*` tokens in `globals.css`, derived from the brand palette, and document it here.

## What was intentionally left alone

- No business-domain UI exists yet (per `CLAUDE.md`, the core has zero business-domain functionality), so there are no domain-specific components to theme beyond the platform chrome (auth, tenant-admin, super-admin shells).
- Dark mode tokens exist (`.dark` in `globals.css`) but there's no theme toggle in the app yet — wiring one up is a separate feature decision, not a design-token change.
- Regular body copy, form labels, and buttons keep Tailwind's default `text-sm`/`text-xs` sizing rather than being migrated onto the 5-step display/title/section/body/overline scale, which is reserved for structural headings and labels.
