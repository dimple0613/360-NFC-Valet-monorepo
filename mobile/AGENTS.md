# Agent Operating Guide

Use this file when changing or extending the mobile web application. It records the conventions and boundaries that are visible in this repository. If a requested change depends on the external admin API, realtime server, database, authentication, or deployment platform, treat that dependency as unknown until its source of truth is available.

## Scope and Source of Truth

- The source of truth is the checked-in code in this `mobile` folder.
- This is a Next.js Pages Router application, not an App Router application.
- The main application behavior is in `components/TapApp.js`; do not assume that a feature belongs in a separate `app`, `services`, `hooks`, or `db` directory until the codebase has one.
- The browser API boundary is `lib/client.js`.
- The global visual system is `styles/globals.css`.
- Route entry points are under `pages/`.

## Files to Modify by Task Type

| Task | Primary files |
| --- | --- |
| Card flow, ETA, status, offers, NFC/QR | `components/TapApp.js` |
| API request behavior | `lib/client.js` |
| Route entry points | `pages/index.js`, `pages/[slug]/[uid].js` |
| Global styling or responsive behavior | `styles/globals.css` |
| Document metadata and favicon | `pages/_document.js`, `public/favicon.svg` |
| Runtime scripts or dependencies | `package.json`, `package-lock.json` |
| JavaScript alias configuration | `jsconfig.json` |

For a documentation-only task, modify only Markdown documentation. Do not change application code, dependencies, configuration, or generated files.

## Do Not Modify or Rely On Without Approval

- Do not edit or commit `.env.local` or any other local environment file. `.env*.local` is ignored.
- Do not edit `node_modules`, `.next`, `out`, or `build`.
- Do not edit `package-lock.json` unless a dependency change is intentional and the lockfile is updated deliberately.
- Do not invent a database, ORM, schema, migration, seed, authentication provider, or RBAC system for this folder. None is present.
- Do not add server actions, API routes, middleware, or backend behavior unless the task explicitly changes application functionality and the external API contract is known.
- Do not copy local API URLs, tokens, card data, or other environment-specific values into documentation or source control.
- Do not assume that the external admin API enforces authorization. No authorization checks are visible in this folder.

## Project Conventions

- Source files use JavaScript and function components.
- The main component uses React hooks and local state; there is no central store or context provider.
- Imports use the `@/*` alias configured in `jsconfig.json`.
- Existing source uses double-quoted strings and function/arrow-function style.
- UI styling uses global CSS class names in `styles/globals.css`; there is no component-scoped styling setup.
- The app has no TypeScript configuration and no dedicated formatter configuration.
- The app has no test framework or test script. Do not invent test commands; verify with the configured lint/build commands and manual browser checks.

## Routes and Query Parameters

- `/` is the landing/home entry point.
- `/{slug}/{uid}` is the card-specific entry point.
- The client reads `uid` and falls back to `id`; `slug` is used for property/card mismatch feedback.
- The custom 404 page is `pages/404.js`.
- There is no `app/` directory and no `pages/api/` directory.

When changing a route, preserve the existing query behavior unless the external card format and API contract are confirmed.

## API Rules

Use `lib/client.js` for browser API calls. It:

- prepends `NEXT_PUBLIC_ADMIN_API` to the path;
- sends JSON with `Content-Type: application/json`;
- parses JSON;
- throws an error containing the API `error` message and HTTP `status` when the response is not OK.

Known client calls are:

- `GET /public/tap/{uid}` for card loading and polling;
- `POST /public/tap/{uid}` with `{ minutes }` for ETA requests;
- `POST /public/offer/validate` with a property or offer identifier, `code`, and `cardUid`.

Do not add a second ad hoc fetch implementation in `TapApp.js` when the shared helper can express the request. Do not document the external response schema as authoritative; the repository only shows how the client consumes fields.

## Realtime and Polling Rules

- `TapApp` polls the card endpoint every 15 seconds after a card is loaded.
- Socket.IO is optional and is enabled only when `NEXT_PUBLIC_WS_URL` is configured.
- The client emits `subscribe:property` with the property ID and listens for four order events: `valet.order.parked`, `valet.order.return.requested`, `valet.order.completed`, and `valet.delay.notified`.
- A matching realtime event triggers a fresh card fetch. Preserve cleanup of timers, banners, and socket connections when changing effects.
- If realtime is unavailable, polling is the fallback visible in this code.

## Authentication and Authorization Rules

There is no login, session, token, role, permission, or RBAC code in this folder. A card UID is an identifier used by the client, not evidence of authentication. Do not add or document role behavior without a confirmed backend contract.

## Database and Migration Rules

There is no database connection, ORM, schema, migration, or seed setup in this folder. Database setup and data modeling belong to the external admin API/backend repository. Do not create database files or migration commands in this project as part of a documentation-only change.

## Development and Verification

Run commands from this folder:

```bash
npm run dev
npm run build
npm run lint
```

- `npm run dev` starts on port 3001.
- `npm run start` starts a production build on port 3001.
- There is no configured test command.
- After UI changes, manually verify `/`, `/?uid=<card>`, `/<slug>/<uid>`, the 404 page, ETA submission behavior, polling/event refresh behavior where the external services are available, and offer validation.
- Before merging a functional change, run at least the available lint and build commands. If they fail for pre-existing reasons, report that explicitly rather than changing unrelated code.

## Common Pitfalls

- Do not describe this as an App Router project; it uses `pages/`.
- Do not assume `TapApp.js` is a server component. It uses hooks and browser APIs.
- Do not treat `NEXT_PUBLIC_*` variables as secret storage; they are exposed to the browser build.
- Do not assume `uid` always uses one string format. The client tries alternate hexadecimal representations.
- Do not assume QR or NFC scanning works on every browser/device. The landing screen contains explicit capability checks.
- Do not assume an empty `NEXT_PUBLIC_WS_URL` means realtime is configured; the code skips the socket connection.
- Do not assume the external API response contains fields that are not used or documented here.
- Do not add a database, auth, RBAC, or deployment story to documentation unless it can be verified from another source of truth.

## Documentation Links

- [README.md](README.md) - quick start and project overview
- [ARCHITECTURE.md](ARCHITECTURE.md) - architecture and data flow
- [DEVELOPMENT.md](DEVELOPMENT.md) - local workflow and verification
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - actual folder and route map
