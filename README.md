# 360 NFC Valet

A hotel valet parking system that runs on one tap card. A control panel for the hotel, an app for the drivers, and a simple page for the guests. Live in Dubai hotels today.

## What's in this repository

This is a monorepo with four sub-projects:

| Folder | Purpose | Framework |
| --- | --- | --- |
| `web/` | Admin/control-panel web application (orders, properties, billing, auth, realtime) | Next.js 16 (App Router), TypeScript, Prisma, Tailwind, Cloudflare Workers via OpenNext |
| `app/` | Driver mobile app (NFC tap, parking, retrieval, history) | Expo / React Native (Expo Go), TypeScript |
| `mobile/` | Guest-facing mobile web app (card tap, ETA, offers, validation) | Next.js Pages Router, plain JavaScript |
| `landing/` | Marketing landing page (static HTML, GSAP animations) | Static HTML/CSS/JS |

## Sub-project documentation

- [`mobile/README.md`](mobile/README.md) — guest mobile web app overview, stack, commands, routes
- [`mobile/ARCHITECTURE.md`](mobile/ARCHITECTURE.md) — mobile app architecture and data flow
- [`mobile/DEVELOPMENT.md`](mobile/DEVELOPMENT.md) — mobile local development and verification
- [`mobile/PROJECT_STRUCTURE.md`](mobile/PROJECT_STRUCTURE.md) — mobile folder and route map
- [`mobile/AGENTS.md`](mobile/AGENTS.md) — coding-agent rules and boundaries for the mobile app

The `web/` and `app/` sub-projects are documented inside their own folders (`web/README.md`, `app/README.md`) when present.

## Getting started

Each sub-project is self-contained. Install and run from the sub-project folder:

```bash
# Guest mobile web
cd mobile && npm ci && npm run dev   # http://localhost:3001

# Driver app
cd app && npm ci && npm start        # Expo

# Admin web
cd web && npm ci && npm run dev     # Next.js dev server
```

See each sub-project's own README for environment variables, build, and deployment details.

## Repository layout

```text
360-NFC-Valet-monorepo/
├── .gitignore
├── README.md
├── app/                 # Expo / React Native driver app
├── landing/             # Static marketing landing page
├── mobile/              # Next.js Pages Router guest web app
└── web/                 # Next.js App Router admin/control-panel app
```

## Notes

- The guest mobile web app (`mobile/`) depends on an external admin API and an optional realtime WebSocket server that are not present in this repository. Their contracts are treated as unknown until a source of truth is available.
- The admin web app (`web/`) owns the backend: Prisma schema, API routes, auth, billing, and realtime (Socket.IO / Redis).
- The driver app (`app/`) is a client that consumes the admin API and uses NFC (`react-native-nfc-manager`) on device.