# 360 NFC Valet Mobile Web

This folder contains the browser-facing mobile web application for the 360 NFC Valet experience. It provides a card-first landing screen, NFC/QR card discovery, property and car status, ETA requests, offer browsing, and staff-code validation.

## Technology Stack

- Next.js Pages Router (installed/locked to Next.js 15.5.23; `package.json` declares `^15.1.6`)
- React 19.2.8 and React DOM 19.2.8 (declared with `^19.0.0`)
- Socket.IO client 4.8.3 for property/order updates
- Plain JavaScript and global CSS
- Browser `fetch` for the external admin API
- `jsconfig.json` path alias: `@/*` maps to the project root

There is no App Router, TypeScript configuration, database ORM, server action layer, internal API route layer, middleware, or test framework in this folder.

## Requirements

- Node.js that satisfies the installed Next.js package engines: `^18.18.0`, `^19.8.0`, or `>=20.0.0`
- npm and an installed dependency tree
- The external admin API available at runtime
- A WebSocket server for real-time updates when `NEXT_PUBLIC_WS_URL` is configured
- A browser with the required hardware/API support:
  - QR scanning requires a Chromium browser with camera access and `BarcodeDetector`
  - NFC scanning requires Web NFC support, currently documented by the app as Android Chrome, and a secure context for NFC

No project-specific Node version file is present.

## Installation

From this folder:

```bash
npm ci
```

`npm install` is also available if dependencies need to be refreshed. Do not edit `package-lock.json` unless a dependency change is intentional.

## Environment Setup

The application reads these browser-visible variables:

| Variable | Use | Code default |
| --- | --- | --- |
| `NEXT_PUBLIC_ADMIN_API` | Base URL for `/public/*` API calls | Built-in localhost API base |
| `NEXT_PUBLIC_WS_URL` | Socket.IO server URL for live order/property events | No default; realtime is skipped when absent |

Do not commit local environment values. `.env*.local` is ignored by `.gitignore`. The values in a local `.env.local` file are not documentation and must not be copied into repository documentation.

## Development Commands

Run all commands from this folder:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js on port 3001 |
| `npm run start` | Start a production build on port 3001 |
| `npm run build` | Create the production build |
| `npm run lint` | Run the configured Next.js lint command |

The package has no test script. There are no test files or a dedicated test command in this project.

## Routes and Entry Points

- `/` - landing and home view. A card can be supplied with `?uid=...` or `?id=...`; the optional `slug` query is used for property/card mismatch feedback.
- `/{slug}/{uid}` - card-specific view. The page uses the same `TapApp` component and reads `slug`, `uid`, and the fallback `id` from the query.
- Built-in Next.js 404 page - `pages/404.js`

The application does not contain an `app/` directory or an `api/` route directory.

## Project Structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the complete important tree, route table, and feature locations.

```text
mobile/
├── components/
│   └── TapApp.js
├── lib/
│   └── client.js
├── pages/
│   ├── 404.js
│   ├── _app.js
│   ├── _document.js
│   ├── index.js
│   └── [slug]/
│       └── [uid].js
├── public/
│   └── favicon.svg
├── styles/
│   └── globals.css
├── .env.local                 # local-only; ignored
├── .gitignore
├── jsconfig.json
├── package.json
├── package-lock.json
└── README.md
```

## Important Architecture Notes

- This is a client-heavy Pages Router application. `pages/index.js` and `pages/[slug]/[uid].js` are thin route entry points; most state and behavior live in `components/TapApp.js`.
- `lib/client.js` is the only application API client. It sends JSON requests to the external admin API and converts non-2xx responses into errors containing the API error message and HTTP status.
- The client polls `/public/tap/{uid}` every 15 seconds after a card is loaded. It also connects to Socket.IO and subscribes to a property when the loaded data contains a property ID.
- Card identity is carried by `uid` (with `id` as a fallback) and property identity by `slug`. The UI derives the displayed card suffix from `card.uid`.
- The external API response shape is used by the client but is not defined in this repository. Treat the field names in `TapApp.js` as client-side usage, not an authoritative API schema.
- There is no authentication, session, role, or RBAC implementation in this folder. No authorization checks are visible in the client or route files.
- There is no database, ORM, schema, migration, or seed setup in this folder. The external admin API and its backend are outside this project folder.

## Data Flow

```text
Browser route (/ or /{slug}/{uid})
  -> TapApp client state
  -> GET /public/tap/{uid}
  -> external admin API
  -> property, card, order, and offer data
  -> home/status/offer views

ETA request:
  Browser -> POST /public/tap/{uid} with { minutes } -> external admin API

Staff-code validation:
  Browser -> POST /public/offer/validate with property/offer ID, code, and cardUid
  -> external admin API

Socket.IO:
  Browser -> subscribe:property -> external realtime server
  -> order events refresh the card view
```

## Database Setup

Not applicable to this folder. There is no database connection, migration tooling, schema, model, or seed script. Database setup belongs to the external admin API/repository, which is not present here.

## Deployment

No deployment configuration or deployment documentation is present. There is no `next.config.*`, Docker configuration, CI configuration, or deployment script in this folder. Deployment target, environment-specific variables, and build output handling require confirmation from the hosting setup.

## Documentation Index

- [ARCHITECTURE.md](ARCHITECTURE.md) - application architecture, request flow, data contracts, and missing backend concerns
- [AGENTS.md](AGENTS.md) - practical rules for humans and coding agents
- [DEVELOPMENT.md](DEVELOPMENT.md) - local development, verification, and operational workflow
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - actual tree, routes, and feature locations
