# Project Structure

This document describes the actual structure in the current Expo / React Native project.

```text
project/
├── .env.example
├── .gitignore
├── App.tsx
├── app.json
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── fonts/
│   │   ├── PlusJakartaSans-Bold.ttf
│   │   ├── PlusJakartaSans-ExtraBold.ttf
│   │   ├── PlusJakartaSans-Medium.ttf
│   │   ├── PlusJakartaSans-Regular.ttf
│   │   └── PlusJakartaSans-SemiBold.ttf
│   ├── icon.png
│   └── splash.png
├── babel.config.js
├── babel-plugin-font-alias.js
├── docs/
├── node_modules/
├── package-lock.json
├── package.json
├── src/
│   ├── api/
│   │   ├── client.ts
│   │   ├── endpoints.ts
│   │   └── index.ts
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── index.ts
│   │   └── ui/
│   │       ├── AppButton.tsx
│   │       ├── CustomToast.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── StatusBar.tsx
│   │       └── index.ts
│   ├── config.ts
│   ├── constants/
│   │   ├── colors.ts
│   │   ├── index.ts
│   │   ├── spacing.ts
│   │   └── typography.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── SocketContext.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useAsyncData.ts
│   │   └── useNfc.ts
│   ├── index.ts
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── index.ts
│   │   └── types.ts
│   ├── screens/
│   │   ├── DriverCardActivated/
│   │   ├── DriverCarDetails/
│   │   ├── DriverForgotPassword/
│   │   ├── DriverHistory/
│   │   ├── DriverHome/
│   │   ├── DriverLogin/
│   │   ├── DriverNfcTap/
│   │   ├── DriverPickupRequests/
│   │   ├── DriverProfile/
│   │   ├── DriverResetPassword/
│   │   ├── DriverRetrievalDetail/
│   │   ├── DriverReturnRequest/
│   │   ├── DriverSelectLocation/
│   │   ├── DriverUpdateParking/
│   │   └── DriverWriteCard/
│   ├── services/
│   │   ├── index.ts
│   │   └── storage.ts
│   ├── theme/
│   │   └── index.tsx
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── index.ts
│       ├── notifications.ts
│       └── toast.ts
└── tsconfig.json
```

## Root Files

### `App.tsx`

Root application composition. Loads bundled fonts, wraps the app in `SafeAreaProvider`, `AuthProvider`, `SocketProvider`, and `ErrorBoundary`, and mounts `NavigationContainer` with `RootNavigator`.

### `app.json`

Expo configuration for app name, slug, version, orientation, icons, splash, Android package and permissions, iOS tablet support, web favicon, and asset bundling.

### `package.json`

Expo project metadata and scripts. Available scripts include:

- `start`
- `serve`
- `android`
- `ios`
- `web`
- `typecheck`
- `doctor`
- `prebuild`
- `build:android`
- `build:ios`

There is no test, lint, or format script.

### `tsconfig.json`

Extends `expo/tsconfig.base` with strict TypeScript checking and the `@/*` alias to `src/*`.

### `babel.config.js`

Uses `babel-preset-expo`.

### `babel-plugin-font-alias.js`

Custom Babel plugin that redirects imports of `Text` and `TextInput` from `react-native` to `@/theme`.

### `.env.example`

Contains the checked-in API URL example. Do not commit the real `.env` file.

## Source Folders

### `src/api/`

HTTP communication layer.

- `client.ts` - fetch wrapper, timeout, bearer token, 401 logout handling, error parsing
- `endpoints.ts` - endpoint constants
- `index.ts` - exports the HTTP client and endpoint registry

### `src/components/`

Shared UI and bottom navigation.

- `TabBar.tsx` - custom fixed bottom navigation with Home, Requests, NFC, History, and Profile actions
- `ui/` - reusable UI components including buttons, toast presentation, error boundary, and status bar wrapper

### `src/constants/`

Design tokens.

- `colors.ts` - shared color palette
- `spacing.ts` - shared spacing values
- `typography.ts` - bundled font names, font-size scale, and font-weight mapping

### `src/context/`

Global application contexts.

- `AuthContext.tsx` - driver session, sign-in, sign-out, profile refresh, persisted auth state
- `SocketContext.tsx` - Socket.IO connection, push notification registration, socket event handling
- `index.ts` - exports authentication context symbols

### `src/hooks/`

Reusable React hooks.

- `useNfc.ts` - NFC support detection, tag reading, and card writing
- `useAsyncData.ts` - local async loading/error/data state
- `index.ts` - exports shared hooks

### `src/navigation/`

React Navigation stack.

- `RootNavigator.tsx` - selects public authentication screens or authenticated driver screens
- `types.ts` - route names and route parameter types
- `index.ts` - exports navigator and types

### `src/screens/`

Feature-specific screens. Each screen is in its own folder with an `index.tsx` entry point.

#### Public Screens

- `DriverLogin` - driver sign-in
- `DriverForgotPassword` - password reset email request
- `DriverResetPassword` - password reset using a token

#### Authenticated Screens

- `DriverSelectLocation` - property selection and shift start
- `DriverHome` - dashboard, stats, live queue, NFC entry points
- `DriverNfcTap` - NFC card scan and manual card number entry
- `DriverWriteCard` - NFC card encoding
- `DriverCarDetails` - vehicle details, plate scan, order creation
- `DriverCardActivated` - parking location entry and order close
- `DriverPickupRequests` - queue filters, accept retrieval, mark returned
- `DriverUpdateParking` - zone and slot update
- `DriverReturnRequest` - bottom-sheet return request queue
- `DriverRetrievalDetail` - retrieval details, ETA updates, delay notification
- `DriverHistory` - completed order history filters
- `DriverProfile` - profile, notification preference, switch location, sign out

### `src/services/`

Persistence wrapper.

- `storage.ts` - AsyncStorage get/set/remove wrapper using `@360nfc` keys
- `index.ts` - exports storage symbols

### `src/theme/`

Custom React Native text components.

- `index.tsx` - maps `fontWeight` to PlusJakartaSans fonts and provides `Text` and `TextInput`

### `src/types/`

Shared TypeScript domain types.

- `Driver`
- `DriverLoginResponse`
- `Property`
- `DashboardStats`
- `QueueItem`
- `HistoryItem`
- `DriverProfile`
- `UserRole`

### `src/utils/`

Small shared utilities.

- `toast.ts` - toast message helper
- `notifications.ts` - push notification registration and listeners
- `index.ts` - miscellaneous validation and sleep helpers

## Assets

- `assets/fonts/` - bundled PlusJakartaSans font files
- `assets/icon.png` - app icon
- `assets/adaptive-icon.png` - Android adaptive icon
- `assets/splash.png` - splash screen image
- `assets/favicon.png` - web favicon

## Folders Not Present

The current checkout does not contain:

- `android/`
- `ios/`
- `tests/`
- `__tests__/`
- `metro.config.js`
- `eas.json`
- `google-services.json`
- `.github/workflows/`

These can be generated or added later, but they are not part of the current source tree.

## Documentation

The `docs/` directory exists but is empty. The requested project documentation lives at the project root:

- `README.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT.md`
- `PROJECT_STRUCTURE.md`
- `AGENTS.md`
