# 360-NFC-Valet Mobile Web

Guest-facing **tap page (Module 3)** for 360 NFC Valet. A mobile-first web app that opens on a guest's phone when they tap an NFC-tagged valet card — no install, no login. Built with **Next.js (Pages Router)**, **React 19**, and **plain JavaScript**.

## Tech Stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Framework    | Next.js 15 (Pages Router)                           |
| Language     | JavaScript (plain JS, no TypeScript)                |
| Styling      | Global CSS (`styles/globals.css`) + design tokens   |
| Data source  | Admin console public API (`../admin`, port 3000)    |
| Real-time    | socket.io-client (WebSocket server, port 3002)      |
| NFC          | Web NFC (`NDEFReader`) on Android Chrome |

## Getting Started

### Prerequisites

- Node.js >= 18
- The **admin console** (`../admin`) running on `http://localhost:3000` with its API seeded (`npm run db:setup` in `../admin`)
- A WebSocket server on `http://localhost:3002` (optional — powers the live banners)

### Install & Run

```bash
npm install                 # install dependencies
npm run dev                 # start dev server on http://localhost:3001
```

Open http://localhost:3001. Tap an NFC card on the landing screen, or visit `/<slug>/<uid>` directly (e.g. `/jw-marriott-marquis/72100112791`).

### Environment

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `NEXT_PUBLIC_ADMIN_API` | `http://localhost:3000/api` | Base URL of the admin console API |
| `NEXT_PUBLIC_WS_URL` | *(empty — WS disabled)* | WebSocket server URL for real-time banners (e.g. `http://localhost:3002`) |

## Useful Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start dev server                  |
| `npm run build` | Production build                  |
| `npm run start` | Start production server (after build) |
| `npm run lint`  | Run ESLint                        |

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full breakdown.

```
360-NFC-Valet/mobile_web/
├── pages/
│   ├── index.js              # "/" — renders <TapApp />
│   ├── [slug]/[uid].js       # "/<slug>/<uid>" — renders <TapApp /> (slug-based lookup)
│   ├── _app.js               # imports globals.css
│   ├── _document.js          # base HTML shell
│   └── 404.js                # not-found page
├── components/
│   └── TapApp.js             # the entire guest app (views, state, sockets)
├── lib/
│   └── client.js             # browser fetch wrapper (api(), adminUrl()) → admin API
├── styles/globals.css        # design system (tokens, hero, sheets, rings)
├── .env.local                # environment config (gitignored)
└── jsconfig.json             # path alias @/* -> project root
```

## Code Conventions

- Pages Router — pages are thin wrappers; all screens live in `components/TapApp.js`. The UID is read from the URL (`/<slug>/<uid>` or `/?uid=<uid>`).
- Plain JavaScript — no TypeScript.
- API calls go through `lib/client.js` (`api()`); never call `fetch` directly in components.
- **Public by design** — no guest auth, no session logic; server-side auth stays on the admin console.
- Use design tokens (`--primary`, `--navy-2`, …) from `styles/globals.css`; avoid hard-coded hex where a token exists.
- Path alias `@/*` maps to the project root — prefer it over long relative imports.

## Troubleshooting

- **Cards not found** — make sure the admin console is seeded and its API is reachable; the UID must match a card in `nfc_cards`.
- **No real-time banners** — set `NEXT_PUBLIC_WS_URL` in `.env.local` (e.g. `http://localhost:3002`); without it, WebSocket is disabled and the app relies on periodic polling.
- **NFC button missing** — Web NFC needs Chrome on Android over HTTPS/`localhost`; the app no longer offers manual card-number entry.
- **Port already in use** — `next dev -p 3001`.

## Documentation

- [PROJECT.md](./PROJECT.md) — project overview and implementation status
- [ARCHITECTURE.md](./ARCHITECTURE.md) — folder structure, data flow, conventions
- [AGENTS.md](./AGENTS.md) — guidance for AI coding agents working in this repo
- [docs/](./docs/) — API reference, auth flow, database, deployment, roles, testing, roadmap