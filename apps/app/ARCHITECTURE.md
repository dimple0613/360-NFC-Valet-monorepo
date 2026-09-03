# Architecture

This document describes the high-level architecture of the **360 NFC Valet** mobile app.

## Overview

The app follows a **layered, feature-first architecture**:

```
Screens (UI) → Components → Hooks → Services/API → Types
```

- **Screens** compose UI and orchestrate state.
- **API** is the only place that talks to the backend.
- **Constants** hold the design system (colors, spacing, typography).
- **Types** are shared across layers to keep contracts consistent.

Everything lives under `src/`, and the root `App.tsx` only sets up providers
and the navigation container.

## Directory Layout

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

## Design Rules

1. **No magic numbers.** Colors, spacing, and font sizes come from
   `src/constants`. Screens should not hard-code hex values.
2. **One screen = one folder.** Feature-specific code (subcomponents,
   hooks, styles) goes next to the screen it belongs to.
3. **Screens stay thin.** Data fetching and business logic live in hooks
   and services, not inside JSX.
4. **Centralized API access.** Never call `fetch` from a screen; use
   `http` from `src/api/client.ts`.
5. **Typed navigation.** New routes must be added to
   `RootStackParamList` in `src/navigation/types.ts`.
6. **Path alias.** Use `@/` to import from `src/` (e.g. `@/constants`).

## Data Flow

```
┌──────────┐   fetch    ┌────────────┐   JSON   ┌──────────────┐
│  Screen   │ ────────▶ │ api/client │ ───────▶ │   Backend    │
└──────────┘            └────────────┘          └──────────────┘
      ▲                       │
      │  state                │ tokens persist
      ▼                       ▼
┌──────────┐            ┌────────────┐
│   hooks   │◀──────────│  storage   │
└──────────┘            └────────────┘
```

1. A hook (e.g. `useAsyncData`) calls a service/API function.
2. `http` attaches headers and enforces a timeout.
3. On success, the hook updates `{ data, loading, error }`.
4. Auth tokens are persisted via `src/services/storage.ts`.

## Navigation

- `App.tsx` mounts `NavigationContainer` + `RootNavigator`.
- `RootNavigator` is a native stack with `headerShown: false`.
- Screens receive fully typed props via `RootStackScreenProps<T>`.

### Adding a new screen

1. Create `src/screens/<ScreenName>/index.tsx`.
2. Add the route name to `RootStackParamList` in `src/navigation/types.ts`.
3. Register it in `src/navigation/RootNavigator.tsx`.

## Error Handling Strategy

- API errors surface as `Error` from `http`.
- Hooks expose `{ data, loading, error }` so screens can render
  loading / empty / error states.
- Validation helpers in `src/utils` guard user input before requests.

## Related Docs

- [PROJECT.md](./PROJECT.md) — project overview and implementation status
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) — endpoint catalog
- [docs/AUTH_FLOW.md](./docs/AUTH_FLOW.md) — authentication flows
- [docs/DATABASE.md](./docs/DATABASE.md) — models & local storage
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — local dev + EAS/CI
- [docs/ROLES_AND_PERMISSIONS.md](./docs/ROLES_AND_PERMISSIONS.md) — driver/admin roles
- [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) — test plan
- [docs/ROADMAP.md](./docs/ROADMAP.md) — planned work

## Scaling Notes

- **State:** for global auth/user state, introduce a context provider
  under `src/context/` or a dedicated state library (Zustand/Redux) —
  not needed yet at this scale.
- **Theming:** extend `src/constants` when adding new design tokens.
- **Testing:** add `jest-expo` + React Native Testing Library when the
  first testable business logic appears.
