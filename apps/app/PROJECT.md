# PROJECT.md - Project Overview

## Project Overview

360 NFC Valet is a premium hospitality valet mobile application. It provides a secure, NFC-enabled workflow for valet staff and drivers, with a clean, layered React Native codebase designed for rapid feature growth.

**Status: Pending Definition** - Specific features and scope are not yet fully defined.

## Project Goals

- Build a modern, scalable mobile app for premium hospitality valet services.
- Provide secure driver and valet authentication flows.
- Support NFC-based interactions for valet operations.
- Deliver a clean, responsive user interface matching the premium brand.

**Status: Pending Definition** - Detailed goals require further definition.

## Target Users

- Valet drivers
- Valet administrators
- Hospitality property operators
- End users (guests) receiving valet services

**Status: Pending Definition** - User personas and detailed requirements pending.

## Core Features

- **Driver Login** - Log in to a shift using Valet ID or email (current)
- **Authentication** - JWT-based session with access/refresh tokens
- **NFC-Based Valet Flow** - Pending definition
- **Shift Management** - Pending definition

**Status: Pending Definition** - Feature priorities and detailed specifications pending.

## Functional Requirements

**Status: Pending Definition**

## Application Structure

The app follows a **layered, feature-first architecture**:

```
Screens (UI) → Components → Hooks → Services/API → Types
```

- **Screens** compose UI and orchestrate state.
- **API** is the only place that talks to the backend.
- **Constants** hold the design system (colors, spacing, typography).
- **Types** are shared across layers to keep contracts consistent.

### Directory Layout

```
src/
├── api/
│   ├── client.ts          # fetch wrapper (get/post/put/patch/delete + timeout)
│   ├── endpoints.ts       # central endpoint constants
│   └── index.ts           # public barrel
├── components/
│   └── ui/                # reusable primitives (AppButton, ...)
├── constants/
│   ├── colors.ts          # palette
│   ├── spacing.ts         # spacing scale
│   ├── typography.ts      # font sizes/weights
│   └── index.ts
├── hooks/
│   ├── useAsyncData.ts    # loading/data/error state machine for fetches
│   └── index.ts
├── navigation/
│   ├── types.ts           # RootStackParamList + screen prop types
│   ├── RootNavigator.tsx  # stack navigator
│   └── index.ts
├── screens/
│   └── DriverLogin/       # one folder per screen
│       └── index.tsx
├── services/
│   ├── storage.ts         # AsyncStorage wrapper (typed get/set/remove)
│   └── index.ts
├── types/
│   └── index.ts           # shared domain models (User, AuthTokens, ...)
├── utils/
│   └── index.ts           # pure helpers (validation, sleep)
├── config.ts              # runtime config read from env
└── index.ts               # root barrel
```

## Authentication Requirements

- Valet ID or email + password login (primary)
- JWT access/refresh token flow
- Forgot password flow
- Persistent session via AsyncStorage

**Status: Pending Definition** - Detailed auth flows require further definition.

## Roles and Permissions

Default roles:

- **Driver** - Valet driver access
- **Admin** - Administrative access

**Status: Pending Definition** - Detailed permissions pending.

## UI Requirements

- Premium hospitality brand styling (dark gradient login screen)
- Responsive layout for mobile devices
- Loading, empty, and error states
- Safe-area aware screens
- Reusable UI primitives

## Security Requirements

- Data encrypted in transit (HTTPS)
- Secure token storage
- Centralized API client with timeout and typed endpoints
- Input validation on all user inputs

**Status: Pending Definition** - Detailed security requirements pending.

## Testing Requirements

- Unit tests for business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows

**Status: Pending Definition** - Testing framework and coverage targets pending.

## Deployment Requirements

- Local development with Expo dev server
- Expo Go for physical device testing
- Production deployment via Expo EAS or similar

**Status: Pending Definition** - Deployment pipeline and infrastructure pending.

## Decisions Required

- Specific valet features and workflows
- NFC flow design
- Backend API contract
- Payment processing integration
- Deployment platform selection
- Monitoring and logging strategy

---

## Related Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — folder structure, data flow, conventions
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) — endpoint catalog
- [docs/AUTH_FLOW.md](./docs/AUTH_FLOW.md) — authentication flows
- [docs/DATABASE.md](./docs/DATABASE.md) — models & local storage
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — local dev + EAS/CI
- [docs/ROLES_AND_PERMISSIONS.md](./docs/ROLES_AND_PERMISSIONS.md) — driver/admin roles
- [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) — test plan
- [docs/ROADMAP.md](./docs/ROADMAP.md) — planned work

## Implementation Status (Current State)

> This section tracks how far the codebase matches the specification above.

### Legend

- ✅ **Done** — implemented and functional
- ⚠️ **Partial** — partially implemented
- ❌ **Missing** — not implemented / deviates from spec

### Application Structure

| Requirement | Status | Notes |
|---|---|---|
| Layered feature-first structure | ✅ | `src/` with api/components/constants/hooks/navigation/screens/services/types/utils |
| One screen = one folder | ✅ | `src/screens/DriverLogin/index.tsx` |
| Root barrel exports | ✅ | `src/index.ts` |
| Typed navigation | ✅ | `RootStackParamList` in `src/navigation/types.ts` |

### Screens

| Requirement | Status | Notes |
|---|---|---|
| Driver login screen | ✅ | `DriverLogin` registered in `RootNavigator` |
| Login wiring to API | ❌ | Button currently shows an alert only; no API call |
| Additional screens | ❌ | Pending definition |

### API

| Requirement | Status | Notes |
|---|---|---|
| Fetch wrapper with timeout | ✅ | `http` in `src/api/client.ts` |
| Central endpoint constants | ✅ | `src/api/endpoints.ts` |
| No direct fetch in screens | ✅ | Per convention |

### Auth & Types

| Requirement | Status | Notes |
|---|---|---|
| `User` / `AuthTokens` / `LoginResponse` models | ✅ | `src/types/index.ts` |
| Token persistence | ⚠️ | `src/services/storage.ts` exists; not yet consumed by login |
| `useAsyncData` fetch hook | ✅ | `src/hooks/useAsyncData.ts` |

### UI

| Requirement | Status |
|---|---|
| Premium branded login UI | ✅ |
| Design system constants | ✅ `src/constants` |
| Loading/empty/error states | ❌ |
| Reusable UI primitives | ⚠️ `AppButton` only |

### Testing

| Requirement | Status |
|---|---|
| Unit tests | ❌ |
| Integration tests | ❌ |
| E2E tests | ❌ |

### Deployment

| Requirement | Status |
|---|---|
| Local Expo dev server | ✅ `npm run serve` |
| Type checking | ✅ `npm run typecheck` |
| Expo health check | ✅ `npm run doctor` |
| Production build | ❌ |

### NFC / Valet Core Features

| Requirement | Status |
|---|---|
| Driver Login | ⚠️ UI only |
| NFC-based valet flow | ❌ Pending Definition |
| Shift Management | ❌ Pending Definition |
| Guest Vehicle Tracking | ❌ Pending Definition |

## Known Deviations

1. **Login not wired:** The login button on the DriverLogin screen currently triggers a local `alert` and does not call the API yet. The `http` client, types, and storage service are ready to support it.
2. **Hard-coded design values:** The DriverLogin screen uses inline hex colors instead of importing from `src/constants`, which deviates from the documented design-system convention.
3. **Route structure:** Only a `DriverLogin` screen is registered; the navigation stack is minimal until more screens are defined.
