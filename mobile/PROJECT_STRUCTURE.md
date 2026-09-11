# Project Structure

This document records the actual important structure of the `mobile` folder. `node_modules`, `.next`, `out`, and `build` are generated or installed directories and are not part of the source architecture.

## Source Tree

```text
mobile/
├── .env.local                       # local runtime values; ignored
├── .gitignore
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
├── jsconfig.json
├── package.json
├── package-lock.json
├── README.md
├── ARCHITECTURE.md
├── AGENTS.md
├── DEVELOPMENT.md
└── PROJECT_STRUCTURE.md
```

## Routes

| Route | File | Behavior |
| --- | --- | --- |
| `/` | `pages/index.js` | Renders `TapApp`; landing view when no card identifier is supplied |
| `/?uid=<uid>` | `pages/index.js` | Loads a card directly using the `uid` query parameter |
| `/?id=<uid>` | `pages/index.js` | Loads a card using the fallback `id` query parameter |
| `/<slug>/<uid>` | `pages/[slug]/[uid].js` | Renders `TapApp` for a card-specific route |
| Unmatched route | `pages/404.js` | Custom not-found page |

`TapApp` reads `router.query.uid` and falls back to `router.query.id`. It also reads `slug` for property/card mismatch feedback. The route files do not implement card behavior themselves.

## Feature Locations

### Main application controller

`components/TapApp.js` contains:

- Landing screen and card discovery
- NFC scanning using `NDEFReader`
- QR scanning using `BarcodeDetector` and camera access
- UID normalization and alternate UID lookup
- Card loading and polling
- Socket.IO connection and cleanup
- Home view and property/card/order rendering
- ETA bottom sheet and ETA request submission
- Car status/ETA countdown view
- Ready-state and visit-completion flow
- Offer category listing and offer detail view
- Staff-code validation forms
- Local navigation between home, list, detail, and status views

The file is currently monolithic. It defines both stateful views and small presentational components together.

### Browser API client

`lib/client.js` contains:

- `adminUrl(path)`, which prepends the configured API base URL
- `api(path, options)`, which sends JSON requests, parses JSON, and throws an error with `status` for non-OK responses

Known requests are:

```text
GET  /public/tap/{uid}
POST /public/tap/{uid} with { minutes }
POST /public/offer/validate with property/offer ID, code, and cardUid
```

### Global styling

`styles/globals.css` contains all application styling:

- Design tokens and colors
- Page and card layout
- Landing/NFC/QR states
- Home and offer cards
- ETA sheet and countdown controls
- Car status and ready states
- Offer listing and detail views
- Validation forms and error states
- Responsive breakpoints

There are no component-scoped styles, CSS modules, Tailwind setup, or styled-component files in this folder.

### Route and document files

- `pages/_app.js`: imports `styles/globals.css` and wraps the page component.
- `pages/_document.js`: document-level HTML, language, theme color, favicon, telephone detection, and Google Fonts links.
- `pages/index.js`: thin entry point for `/`.
- `pages/[slug]/[uid].js`: thin entry point for `/{slug}/{uid}`.
- `pages/404.js`: custom 404 page.

### Static assets

- `public/favicon.svg`: favicon referenced by `_document.js`.

No other public assets are present.

### Configuration

- `package.json`: Next.js/React dependencies and scripts.
- `package-lock.json`: locked dependency versions.
- `jsconfig.json`: `@/*` alias to the project root.
- `.gitignore`: ignores generated directories, local environment files, dependencies, and selected generated documentation names.

## What Is Not Present

The following are not present in this folder:

- `app/` directory (App Router)
- `pages/api/` directory (internal API routes)
- `middleware.*`
- `next.config.*`
- `tsconfig.json` or TypeScript source files
- `db/`, `prisma/`, `database/`, `models/`, or migration/seed directories
- Authentication, session, role, permission, or RBAC modules
- `services/`, `hooks/`, `context/`, or central state/store directories
- Test files, test scripts, or test framework configuration
- Docker, CI, or deployment configuration

The external admin API and realtime server are runtime dependencies, but their implementation and schema are not part of this folder.

## Generated and Ignored Files

`.gitignore` ignores:

```text
.next/
out/
build/
dev.log
.env*.local
node_modules/
.DS_Store
npm-debug.log*
.playwright-mcp/
admin-cards.md
page-*.md
```

The current source tree does not contain `admin-cards.md` or `page-*.md`; they are listed as ignored generated documentation names.

## Documentation Index

- [README.md](README.md) - overview, setup, commands, and references
- [ARCHITECTURE.md](ARCHITECTURE.md) - application and data flow
- [AGENTS.md](AGENTS.md) - coding-agent rules and boundaries
- [DEVELOPMENT.md](DEVELOPMENT.md) - local development and verification
