# DEPLOYMENT.md

## Current State

- Local development with the Expo dev server (`npm run serve`).
- Testing on device via **Expo Go**, or on an Android/iOS simulator.
- **No production deployment configured** (no EAS project, no app store builds).

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the backend API (default `http://localhost:3000/api`) |

Copy `.env.example` to `.env` and set your API base URL.

## Local development

```bash
npm install
npm run serve
```

Then press `a` (Android), `i` (iOS), or `w` (web). For physical devices, install Expo Go and scan the QR code (phone and computer on the same network).

## Target: Production via EAS

1. Install EAS CLI: `npm install -g eas-cli`.
2. Login: `eas login` (and `eas init`).
3. Configure build credentials: `eas build:configure`.
4. Build for the store:
   - Android: `eas build --platform android`
   - iOS: `eas build --platform ios`
5. Submit: `eas submit --platform all`.

## Suggested CI/CD (GitHub Actions)

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run doctor
```

## Pending decisions

- Deployment platform / EAS vs manual builds.
- Backend hosting.
- Monitoring and logging strategy.
- Release channels (staging/production).
