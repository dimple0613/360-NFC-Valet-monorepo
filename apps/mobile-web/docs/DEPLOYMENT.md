# DEPLOYMENT.md

## Current State

- Local development against the admin console (`:3000`) with a WebSocket server on `:3002`.
- Production build verified locally with `npm run build` + `npm run start`.
- **No cloud deployment configured yet.**

## Environment variables (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_ADMIN_API` | Base URL of the admin console's API (default `http://localhost:3000/api`) |

Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_ADMIN_API` before running.

## Local development

```bash
npm install
# 1. start the admin console (../admin) — npm run dev on http://localhost:3000
#    its API must be seeded (npm run db:setup in ../admin)
# 2. start the WebSocket server on http://localhost:3002 (optional for real-time banners)
# 3. run the app
npm run dev
```

Open http://localhost:3001. Enter a seeded card UID (e.g. `72100112791`) on the landing screen or visit `/t/72100112791` directly.

## Production

1. Deploy the admin console first and set its `CORS_ORIGINS` to include this app's public origin (see `middleware.js` in `../admin`).
2. Set `NEXT_PUBLIC_ADMIN_API` to the deployed admin API base URL.
3. Build and start:

```bash
npm run build
npm run start
```

4. Serve over HTTPS — Web NFC (`NDEFReader`) and the `navigator` APIs require a secure context.

## Deploy target (Next.js hosting)

| Host | Notes |
|---|---|
| Vercel | Native Next.js support; `npm run build` runs on deploy; add `NEXT_PUBLIC_ADMIN_API` as an env var |
| Railway / Render | Node server — build with `npm run build`, start with `npm run start` |
| Docker | `node:20-alpine`, copy `.next` + `package.json`, run `npm run start` |

> This is a fully static-friendly client app — the pages call the admin API at runtime. If the socket server is remote, update the WebSocket URL derivation in `components/TapApp.js` (it currently swaps `:3001` for `:3002` on the current origin).

## Suggested CI/CD (GitHub Actions)

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

## Pending decisions

- Cloud host for the web app (Vercel vs VPS vs container platform).
- Deployment of the admin console (the API + database this app depends on).
- Hosting for the WebSocket server (`:3002`).
- Custom domain / TLS configuration.