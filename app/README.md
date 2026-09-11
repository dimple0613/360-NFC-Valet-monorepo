# 360 NFC Valet

360 NFC Valet is an Expo / React Native driver console for managing vehicle drop-off and retrieval workflows. It is not a Next.js application: there is no App Router, Pages Router, server action, API route, middleware, or database layer in this project.

The app lets a driver:

- Sign in and recover a session
- Select the property where the driver is working
- Start and end a shift
- Tap or manually enter an NFC card number
- Create a vehicle order and activate a card
- Record parking location
- Review live pickup requests
- Accept and complete vehicle retrieval requests
- Review completed order history
- Update driver profile information

## Technology Stack

- **Expo:** `^57.0.21`
- **React Native:** `0.81.5`
- **React:** `19.1.0`
- **Navigation:** `@react-navigation/native` and `@react-navigation/native-stack`
- **State and data:** React Context, React state, and a small local `useAsyncData` hook
- **Forms and validation:** Formik and Yup
- **API communication:** `fetch` through `src/api/client.ts`
- **Realtime updates:** Socket.IO client
- **Storage:** AsyncStorage under the `@360nfc` key prefix
- **NFC:** `react-native-nfc-manager`
- **Camera / plate capture:** `expo-image-picker` and `expo-image-manipulator`
- **Push notifications:** `expo-notifications` and `expo-device`
- **UI:** React Native components, SVG icons, gradients, and a custom font aliasing layer

## Requirements

- Node.js and npm
- A device or simulator with Expo support
- Android or iOS development setup if building native apps
- NFC-capable Android hardware for NFC read/write flows
- Camera permission on devices that use plate scanning

The exact Node.js version is not pinned in this checkout; follow the Expo 57 requirements for your local setup.

## Installation

From the project root:

```bash
npm install
```

Optional environment setup:

```bash
cp .env.example .env
```

The checked-in `.env.example` defines:

```env
EXPO_PUBLIC_API_URL=https://360-nfc-valet.dimple-49d.workers.dev/api
```

The source also reads `EXPO_PUBLIC_WS_URL` for the Socket.IO endpoint, but it is not present in `.env.example`. Its value is optional in code and defaults to an empty string.

Do not commit real credentials, tokens, or production secrets.

## Development Commands

```bash
npm start
```

Start Expo in the default development mode.

```bash
npm run serve
```

Alias for `expo start`.

```bash
npm run android
```

Open the Android development target.

```bash
npm run ios
```

Open the iOS development target.

```bash
npm run web
```

Open the Expo web target. Web support is configured through `react-native-web` and `react-dom`, but this checkout does not contain a Next.js app.

```bash
npm run typecheck
```

Run TypeScript checking with `tsc --noEmit`.

```bash
npm run doctor
```

Run `expo-doctor`.

```bash
npm run prebuild
```

Generate native iOS and Android project folders with Expo Prebuild. Those folders are not present in the current checkout.

```bash
npm run build:android
```

Build and run the Android target on a connected device/emulator. Note: this does NOT produce a standalone APK file.

### Creating an APK

To create a standalone APK, you must run the native Gradle build explicitly after prebuild:

```bash
npm run prebuild
cd android && ./gradlew assembleRelease
```

The APK is then generated at `android/app/build/outputs/apk/release/app-release.apk`. APK creation is a manual step and is not automatic when running the app.

## Testing

There is no test script in `package.json`, and no test, unit-test, component-test, or E2E test files are present in this checkout.

The available validation commands are:

```bash
npm run typecheck
npm run doctor
```

## Project Structure

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for the complete source tree and folder responsibilities.

Key areas:

- `App.tsx` - app composition and root providers
- `src/screens/` - driver-facing screens
- `src/navigation/` - React Navigation stack and route parameter types
- `src/api/` - HTTP client and endpoint constants
- `src/context/` - authentication and socket contexts
- `src/hooks/` - shared hooks
- `src/services/` - persistent storage wrapper
- `src/utils/` - toast and notification helpers
- `src/components/` - shared UI and navigation bar
- `src/theme/` - custom `Text` and `TextInput` components
- `src/constants/` - colors, spacing, and typography
- `assets/` - app icons, splash image, and font files

## Architecture Notes

- The app uses a single native stack navigator.
- `AuthContext` decides whether the driver is signed in and controls session restoration.
- `SocketContext` connects to the configured WebSocket endpoint and registers push notification tokens.
- Screens fetch data directly through `src/api/client.ts`.
- There is no central server-side API, database, ORM, or model layer in this repository.
- Authorization is represented by driver state and the `driver` socket role. There is no separate RBAC implementation in the client.
- The app.json Android configuration references `google-services.json`, but that file is not present in this checkout.

## Documentation Links

- [Architecture](./ARCHITECTURE.md)
- [Development](./DEVELOPMENT.md)
- [Project Structure](./PROJECT_STRUCTURE.md)
- [Agent Rules](./AGENTS.md)
