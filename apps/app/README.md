# 360-NFC-Valet

Premium hospitality valet app built with **React Native (Expo SDK 54)**, **TypeScript**, and **React Navigation**.

## Tech Stack

| Layer        | Choice                                         |
| ------------ | ---------------------------------------------- |
| Framework    | React Native 0.81 / Expo SDK 54                |
| Language     | TypeScript (strict)                            |
| Navigation   | @react-navigation/native-stack                 |
| Styling      | StyleSheet / expo-linear-gradient              |
| Storage      | @react-native-async-storage/async-storage      |
| HTTP Client  | Native `fetch` wrapper (`src/api/client.ts`)   |

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10
- Expo Go on your device, or an Android/iOS simulator
- (Android emulator requires Android Studio / HAXM or Hyper-V)

### Install & Run

```bash
npm install                 # install dependencies
npm run serve               # start Expo dev server (Metro)
```

Then press:

- `a` — open on Android emulator / Expo Go
- `i` — open on iOS simulator
- `w` — open in web browser

> Physical device: install **Expo Go** and scan the QR code shown in the terminal. Your phone and computer must be on the same network.

### Environment

Copy the example env file and set your API base URL:

```bash
cp .env.example .env
```

Available variables:

| Variable                | Default                  | Purpose              |
| ----------------------- | ------------------------ | -------------------- |
| `EXPO_PUBLIC_API_URL`   | `http://localhost:3000/api` | Base URL for the API |

## Useful Scripts

| Script                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run serve`        | Start Expo dev server                        |
| `npm run android`      | Start on Android emulator                    |
| `npm run ios`          | Start on iOS simulator                       |
| `npm run web`          | Start in browser                             |
| `npm run typecheck`    | Run TypeScript type checking                 |
| `npm run doctor`       | Validate Expo project health                 |
| `npm run prebuild`     | Generate native android/ios projects         |

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full breakdown.

```
360-NFC-Valet/
├── App.tsx                 # Root component (NavigationContainer + RootNavigator)
├── app.json                # Expo app configuration
├── tsconfig.json           # TypeScript config (path alias @/* -> src/*)
├── .env.example            # Environment variable template
└── src/
    ├── api/                # HTTP client + endpoint constants
    ├── components/         # Reusable UI components
    ├── constants/          # Colors, spacing, typography
    ├── hooks/              # Shared React hooks
    ├── navigation/         # Navigators + param list types
    ├── screens/            # Feature screens (folder per screen)
    ├── services/           # Storage & platform services
    ├── types/              # Shared TypeScript models
    ├── utils/              # Pure helper functions
    └── config.ts           # Runtime configuration
```

## Code Conventions

- Follow strict TypeScript — no implicit `any`.
- Import shared constants from `src/constants`, never hard-code colors/spacing.
- One screen = one folder under `src/screens/<ScreenName>/index.tsx`.
- API calls go through `src/api/client.ts`; never call `fetch` directly in screens.
- Prefer functional components + hooks. Use `useAsyncData` for data fetching.

## Troubleshooting

- **"Unable to resolve module"** — run `npm install` and restart Metro with `npx expo start -c`.
- **Version mismatch with Expo Go** — run `npx expo install --fix` to align native module versions.
- **Port already in use** — `npx expo start --port 8082`.

## Documentation

- [PROJECT.md](./PROJECT.md) — project overview and implementation status
- [ARCHITECTURE.md](./ARCHITECTURE.md) — folder structure, data flow, conventions
- [AGENTS.md](./AGENTS.md) — guidance for AI coding agents working in this repo
- [docs/](./docs) — API reference, auth flow, data/storage, deployment, roles, testing, roadmap
