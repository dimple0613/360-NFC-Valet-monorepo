# AGENTS.md

Guidance for AI coding agents working in this repository.

## Commands

```bash
npm run dev          # start dev server on http://localhost:3001
npm run build        # production build (RUN AFTER EVERY CODE CHANGE)
npm run lint         # ESLint
```

## Prerequisites

- The **admin console** (`../admin`) must be running on `http://localhost:3000` with its API seeded — this app has no database of its own.
- A WebSocket server on `http://localhost:3002` provides real-time events (optional for basic smoke tests).
- Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_ADMIN_API` (default `http://localhost:3000/api`).

## Conventions

- **Pages Router + plain JavaScript** — never introduce TypeScript.
- **No direct `fetch` in pages/components** — always go through `@/lib/client` (`api()`); it targets the admin API's public endpoints.
- **This app is public by design** — never add guest auth, and never add session logic to the mobile app. Server-side auth stays on the admin console.
- **Path alias `@/*` maps to the project root** (`jsconfig.json`) — prefer it over relative imports.
- **All screens live in `components/TapApp.js`** — pages are thin wrappers that render `<TapApp />`. Put new views/state there unless a page genuinely needs its own shell.
- **Reuse design tokens** (`--primary`, `--navy-2`, …) from `styles/globals.css`; avoid hard-coded hex where a token exists.
- Follow existing component style: functional components, `className`-based styling, JSX.
- Do not add comments to code unless asked.

## Workflow

1. Explore the relevant folders first (`components`, `lib`, `styles`, `pages`).
2. Implement the change following the conventions above.
3. Run `npm run build` and fix any errors.
4. Smoke-test against `http://localhost:3001` (with the admin console on `:3000` and the socket server on `:3002`).
5. When a task changes features or behavior, update the relevant docs (`.md` files such as `README.md` or `docs/*.md`) to stay in sync.
6. Commit and push when the user asks (remote `origin`, branch `main`) — never commit without an explicit request.