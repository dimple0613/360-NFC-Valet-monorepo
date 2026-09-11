# Development

This file covers local development for the `mobile` Next.js Pages Router application.

## Prerequisites

- Node.js compatible with the installed Next.js package: `^18.18.0`, `^19.8.0`, or `>=20.0.0`
- npm
- Access to the external admin API and, for realtime testing, the configured WebSocket server
- A browser with the required capabilities for the feature being tested:
  - QR scanning: Chromium/Chrome/Edge with camera access and `BarcodeDetector`
  - NFC scanning: Web NFC support, secure context, and Android Chrome support as checked by the landing screen

No project-specific Node version file is present.

## Install

From this folder:

```bash
npm ci
```

Use `npm install` only when dependencies need to be refreshed. Do not edit `package-lock.json` unless a dependency change is intentional and the lockfile is updated deliberately.

## Environment

The browser application reads:

| Variable | Purpose | Default in code |
| --- | --- | --- |
| `NEXT_PUBLIC_ADMIN_API` | Base URL for `/public/*` requests | Built-in localhost API base |
| `NEXT_PUBLIC_WS_URL` | Socket.IO URL for property/order updates | Empty; realtime is skipped |

`.env.local` is ignored by `.gitignore`. Configure it locally and do not commit it. Do not put secrets in `NEXT_PUBLIC_*` variables because they are bundled into browser code.

The external API and WebSocket endpoints are not defined in this repository. Use the values supplied by the backend/deployment owner.

## Development Workflow

Start the local server:

```bash
npm run dev
```

The configured script starts Next.js on port 3001. Open one of the following routes in a browser:

- `/` for the landing screen
- `/?uid=<card>` for a direct card load
- `/<slug>/<uid>` for the card-specific route

The card route passes `slug` and `uid` into `TapApp`. The client also accepts `id` as a fallback card identifier.

## API Behavior to Verify

The shared browser API client is `lib/client.js`.

| Method | Endpoint | Request |
| --- | --- | --- |
| GET | `/public/tap/{uid}` | Load card, property, order, and offers |
| POST | `/public/tap/{uid}` | Submit `{ minutes }` for an ETA request |
| POST | `/public/offer/validate` | Submit `{ propertyId | offerId, code, cardUid }` |

Verify that non-2xx responses show a usable error state and that successful ETA/validation responses update the local view. Do not add a second fetch implementation when `api()` can express the request.

## Realtime Verification

Realtime is optional. When `NEXT_PUBLIC_WS_URL` is configured, the client connects after card data is loaded and emits:

```text
subscribe:property
```

It listens for:

```text
valet.order.parked
valet.order.return.requested
valet.order.completed
valet.delay.notified
```

A matching event should show a banner and refresh the card data. Verify that the socket disconnects when the app unmounts and that polling remains available when the WebSocket is unavailable.

## UI Verification Checklist

After UI changes, manually verify:

- `/` shows the landing screen and handles unavailable NFC/QR capabilities
- `/?uid=<card>` loads a card and displays the home state
- `/<slug>/<uid>` loads the card-specific state and property mismatch handling
- `pages/404.js` renders the custom 404 page
- ETA submission accepts the expected 5-30 minute choices and displays errors
- Polling refreshes card status every 15 seconds where the external service is available
- Matching Socket.IO events refresh the card view
- Offer category listing and offer detail navigation work
- Staff-code validation works for both property and offer paths where enabled
- The ready state and visit completion flow work

## Build and Lint

Run from this folder:

```bash
npm run lint
npm run build
```

The package scripts are:

```json
{
  "dev": "next dev -p 3001",
  "build": "next build",
  "start": "next start -p 3001",
  "lint": "next lint"
}
```

`npm run start` starts the built application on port 3001.

There is no configured test script, test framework, or dedicated formatting command. Do not invent a test command. If lint or build fails for pre-existing reasons, report the failure rather than changing unrelated application code.

## Database, Migrations, and Seeds

Not applicable to this folder. There is no database connection, ORM, schema, migration tool, or seed script. Database setup belongs to the external admin API/backend repository. Do not create database files or migration commands here.

## Deployment

No deployment configuration is present in this folder. There is no `next.config.*`, Dockerfile, CI configuration, or deployment script. The deployment target, environment-specific variables, and production build output require confirmation from the hosting setup.

## Feature Locations

- Card loading, polling, ETA, status, offers, validation, and scanning: `components/TapApp.js`
- Browser API requests: `lib/client.js`
- Route entry points: `pages/index.js`, `pages/[slug]/[uid].js`
- Custom 404: `pages/404.js`
- Global CSS: `styles/globals.css`
- Document metadata: `pages/_document.js`
- Favicon: `public/favicon.svg`
- Package scripts and dependencies: `package.json`, `package-lock.json`
- JavaScript alias: `jsconfig.json`

See [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md), and [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the broader project context.
