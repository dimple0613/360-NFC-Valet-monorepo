# Architecture

This document describes the architecture that is present in the `mobile` folder. It is based on the checked-in source, not on assumptions about the external valet backend.

## Application Architecture

The project is a Next.js Pages Router web application. The route files are intentionally thin: both supported card routes render the same client component, `components/TapApp.js`.

```text
Browser
  -> Next.js Pages Router
       /                         pages/index.js
       /{slug}/{uid}             pages/[slug]/[uid].js
       built-in 404              pages/404.js
  -> TapApp client component
       - card discovery
       - API polling
       - Socket.IO subscription
       - home/status/offer state
       - ETA and validation forms
  -> lib/client.js
       - JSON API request helper
  -> external admin API
  -> external realtime server
```

There is no server component, server action, API route, database layer, authentication provider, or authorization provider in this folder. The application is therefore client-heavy: the browser owns card state, timers, form state, route navigation, and realtime connection management.

## Request and Data Flow

### Card load

```text
Browser opens / or /{slug}/{uid}
  -> TapApp reads query uid/id and optional slug
  -> GET /public/tap/{uid}
  -> external admin API returns card/property/order/offer data
  -> TapApp stores the response and selects the home view
```

The client accepts either `uid` or `id` as the card identifier. For hexadecimal-looking UIDs it also tries colon-separated and uppercase forms. A failed lookup is retried against the alternate forms before the error state is shown.

### Live status

After a card has loaded, `TapApp` starts a 15-second interval that repeats:

```text
GET /public/tap/{uid}
  -> compare the returned order status with the previous status
  -> update order/property data and ETA state
```

When the response contains a property ID, the client also opens a Socket.IO connection and sends `subscribe:property` with that ID. The following event names are handled:

- `valet.order.parked`
- `valet.order.return.requested`
- `valet.order.completed`
- `valet.delay.notified`

A matching event displays a temporary banner and increments the polling key so that the card data is fetched again. The connection is disconnected when the component unmounts.

### ETA request

```text
User chooses an ETA in the bottom sheet
  -> POST /public/tap/{uid}
  -> request body: { minutes }
  -> external admin API creates/updates the return request
  -> TapApp displays the returned request state
```

The ETA sheet accepts 5, 10, 15, 20, or 30 minute choices and also allows stepped values between 5 and 30.

### Staff-code validation

The client exposes a four-digit code field for properties/offers that indicate valet validation is available. The request body is assembled as:

```text
{
  propertyId or offerId,
  code,
  cardUid
}
```

The property path and offer path use the same `/public/offer/validate` endpoint with different identity fields. A successful response changes the local validation state; an API error is displayed in the form.

### Offer menu links

If an offer has a `menuUrl` beginning with `data:`, the client rewrites it to:

```text
/public/offer/{offer.id}/menu
```

using the admin API base URL. Other `menuUrl` values are opened directly in a new tab with `noopener noreferrer`.

## Folder Responsibilities

### `pages/`

The Pages Router entry points.

- `index.js`: renders `TapApp` for the landing/home route.
- `[slug]/[uid].js`: renders `TapApp` for a card-specific route.
- `_app.js`: imports the global stylesheet and supplies the normal Next.js app wrapper.
- `_document.js`: defines document-level HTML, language, theme color, favicon, telephone detection setting, and Google Fonts links.
- `404.js`: custom not-found page with a link back to the start and a sample card link.

### `components/`

- `TapApp.js`: the main client component and application controller. It contains the landing screen, home view, ETA sheet, car status view, offer listing/detail views, validation UI, polling, Socket.IO handling, and navigation between local views.

The component is currently monolithic. Smaller functions and presentational components are defined in the same file rather than in separate component modules.

### `lib/`

- `client.js`: browser API client. It provides `adminUrl(path)` and `api(path, options)`. Requests use JSON content type, parse JSON responses, and throw an error with the API message and HTTP status for non-2xx responses.

### `styles/`

- `globals.css`: global design tokens, page layout, controls, card states, ETA/status views, offer views, NFC/QR landing view, and responsive rules. There are no component-scoped styles or a CSS framework in this folder.

### `public/`

- `favicon.svg`: favicon used by `_document.js`.

### Root configuration

- `package.json`: project metadata, scripts, and dependencies.
- `package-lock.json`: locked dependency versions.
- `jsconfig.json`: JavaScript path alias `@/*` -> project root.
- `.gitignore`: generated directories, local environment files, dependency folders, and selected generated documentation names.
- `.env.local`: local runtime configuration; ignored and not part of source control.

## Component Architecture

`TapApp` is the only application component module. Its internal organization is:

- Helpers: formatting, ETA countdown, card-name construction, offer percentage calculation, time-window checks, and UID normalization.
- Small presentational components: `ClockIcon`, `CountdownPill`, `Hero`, `C1Banner`, `CarStrip`, `CategoryGrid`, `OfferImgCard`, `StatusHero`, `EtaSheet`, `RequestState`, `ReadyState`, `Listing`, `OfferDetail`, `NfcScanIcon`, and `ErrorState`.
- Stateful views: `Landing`, `Home`, and the main `TapApp` state machine.

Shared UI is currently expressed through shared CSS classes in `styles/globals.css`. There is no separate component library, context store, hook directory, or feature directory.

## Data Model Used by the Client

The external response schema is not defined in this repository. The following fields are inferred from `TapApp.js` usage and should be treated as client-side expectations, not as a formal contract.

### Property

Used fields include:

- `id`
- `slug`
- `name`
- `area`
- `city`
- `imageUrl`
- `phone`
- `validatesValet`
- `hasCode`

### Card

Used fields include:

- `uid`

The UI displays only the final four characters for privacy in several places.

### Order

Used fields include:

- `id`
- `propertyId`
- `status`
- `guestEta`
- `carColor`
- `carMake`
- `carModel`
- `plate`
- `zone`
- `driver.name`
- `driver.initials`
- `driver.color`

Observed status values used by the UI are `active`, `parked`, `returning`, `retrieving`, and `returned`.

### Offer

Used fields include:

- `id`
- `category`
- `title`
- `price`
- `wasPrice`
- `dealTag`
- `featured`
- `imageUrl`
- `menuUrl`
- `validatesValet`
- `hasCode`
- `rating`
- `reviews`
- `opensAt`
- `closesAt`
- `desc`
- `level`

## Database Architecture

No database or ORM is present in this folder. There is no Prisma schema, model, migration, seed script, database client, or database configuration. The external admin API is the only data boundary visible here; its database and persistence model are unknown / require confirmation.

## Authentication Architecture

No authentication implementation is present in this folder. There are no login routes, session providers, JWT/cookie handlers, user models, or authentication middleware. The card UID is used as the primary client-side identifier, but the client does not establish or validate an authenticated session.

## Authorization and RBAC Architecture

No authorization or RBAC implementation is present in this folder. There are no role checks, permission guards, protected route groups, or server-side authorization checks. Whether the external admin API enforces authorization is outside this repository and requires confirmation.

## API Architecture

There are no local API routes. All API communication is initiated from the browser through `lib/client.js` against the external admin API base URL.

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| GET | `/public/tap/{uid}` | Load card, property, order, and offers | None |
| POST | `/public/tap/{uid}` | Submit an ETA request | `{ minutes }` |
| POST | `/public/offer/validate` | Validate a property or offer with a staff code | `{ propertyId | offerId, code, cardUid }` |

The API response envelope and error format beyond `error` and `status` are not documented in this repository.

## Configuration and Runtime Behavior

- `NEXT_PUBLIC_ADMIN_API` controls the API base URL and uses the built-in localhost API base when unset.
- `NEXT_PUBLIC_WS_URL` controls the Socket.IO URL. If it is absent, no realtime connection is opened.
- `NEXT_PUBLIC_*` values are bundled into the browser build. Do not put secrets in these variables.
- The app uses browser APIs for NFC and QR scanning. NFC requires a secure context; QR scanning requires browser camera and `BarcodeDetector` support.
- The app uses a fixed 15-second polling interval and a fixed set of ETA increments.
- No `next.config.*`, middleware, image configuration, analytics configuration, or deployment configuration is present.

## Operational Boundaries

This folder can build and serve the browser application, but it cannot by itself establish the external API, realtime server, database, or deployment environment. Those concerns require confirmation from the adjacent backend/hosting repositories or deployment owner.

See [README.md](README.md), [AGENTS.md](AGENTS.md), [DEVELOPMENT.md](DEVELOPMENT.md), and [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for related guidance.
