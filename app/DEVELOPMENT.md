# Development

## Project Type

This is an Expo / React Native project. It is not a Next.js project.

There is no App Router, Pages Router, server action, API route, middleware, or database layer.

## Prerequisites

- Node.js and npm
- Expo CLI support for this project's Expo version
- Android Studio and an Android emulator/device for Android development
- Xcode and an iOS simulator/device for iOS development on macOS
- NFC-capable Android hardware for NFC read/write testing
- Camera permission when testing plate scanning

The exact Node.js version is not pinned in this checkout. Follow the Expo 57 requirements for your local setup.

## Installation

From the project root:

```bash
npm install
```

Copy the environment example:

```bash
cp .env.example .env
```

The checked-in environment example contains:

```env
EXPO_PUBLIC_API_URL=https://360-nfc-valet.dimple-49d.workers.dev/api
```

The source also reads `EXPO_PUBLIC_WS_URL` for the WebSocket endpoint, but it is not included in `.env.example`. If the WebSocket endpoint is needed, set it locally without committing real credentials or secrets.

## Development Commands

Start Expo:

```bash
npm start
```

Alias for starting Expo:

```bash
npm run serve
```

Open Android:

```bash
npm run android
```

Open iOS:

```bash
npm run ios
```

Open the web target:

```bash
npm run web
```

Run TypeScript checking:

```bash
npm run typecheck
```

Run Expo doctor:

```bash
npm run doctor
```

Generate native iOS and Android folders:

```bash
npm run prebuild
```

Build and run Android:

```bash
npm run build:android
```

Build and run iOS:

```bash
npm run build:ios
```

## Environment Setup

The primary environment variable is:

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL for HTTP requests | `https://three60-nfc-valet-admin.onrender.com/api` |
| `EXPO_PUBLIC_WS_URL` | Socket.IO endpoint used by `SocketContext` | Empty string when unset |

`EXPO_PUBLIC_API_URL` is defined in `src/config.ts`.

`EXPO_PUBLIC_WS_URL` is read in `src/context/SocketContext.tsx`.

Do not add real API keys, tokens, passwords, or production secrets to environment files.

## Android Development

Android configuration is declared in `app.json`:

- Package: `com.valet.threesixtynfc`
- NFC permission: `android.permission.NFC`
- Cleartext traffic: enabled
- Adaptive icon: configured
- Splash image: configured

The app currently has no generated `android/` folder. Run `npm run prebuild` first if native Android files are required.

The Android configuration references `google-services.json`, but that file is not present in this checkout.

## iOS Development

iOS configuration is declared in `app.json`:

- Tablet support: enabled
- Icon: configured

There is no generated `ios/` folder in this checkout. Run `npm run prebuild` first if native iOS files are required.

No iOS bundle identifier, Info.plist configuration, or Podfile is present in this checkout.

## Web Development

The project includes `react-native-web` and `react-dom`, and `expo start --web` is available.

There is no Next.js web application and no `next.config.*` file.

## Forms and Validation

Forms use Formik and Yup.

Examples:

- Driver login: `src/screens/DriverLogin/index.tsx`
- Forgot password: `src/screens/DriverForgotPassword/index.tsx`
- Reset password: `src/screens/DriverResetPassword/index.tsx`
- Card activation parking fields: `src/screens/DriverCardActivated/index.tsx`
- Parking update: `src/screens/DriverUpdateParking/index.tsx`

## API Changes

Change endpoint strings in `src/api/endpoints.ts`.

Change request behavior in `src/api/client.ts`.

The HTTP client:

- Adds a JSON content type
- Adds a bearer token when one is stored
- Uses a 15-second timeout
- Removes auth data and triggers logout handling on HTTP 401
- Throws an error for non-success responses

## Socket Changes

Change the endpoint in `src/context/SocketContext.tsx`.

Change socket event handling there or in the screen that consumes the event.

The current socket connection includes `role: "driver"` and subscribes to the driver property when a property ID is available.

## NFC Changes

NFC logic is centralized in `src/hooks/useNfc.ts`.

- `readTag` attempts NDEF, IsoDep, and NfcA technology requests
- `writeCard` writes an NDEF text record
- `readTagWithDelay` waits briefly when no tag is returned

Screens using NFC are:

- `src/screens/DriverNfcTap/index.tsx`
- `src/screens/DriverWriteCard/index.tsx`

## Camera and Plate Scan Changes

Plate scanning is implemented in `src/screens/DriverCarDetails/index.tsx`.

It uses:

- `expo-image-picker`
- `expo-image-manipulator`

The captured image is resized, compressed to JPEG, converted to base64, and sent to `POST /driver/scan-plate`.

## Notifications

Notification registration and listeners are in `src/utils/notifications.ts`.

`SocketContext` calls `registerForPushNotifications` when a driver is present and sends the returned token to `POST /driver/push-token`.

The notification preference is stored in AsyncStorage under `StorageKeys.notificationsOn`.

## Build Process

The build scripts are:

```bash
npm run prebuild
npm run build:android
npm run build:ios
```

There is no EAS configuration file (`eas.json`) in this checkout.

There is no `metro.config.js` in this checkout.

### Creating an APK

`npm run build:android` builds and runs on a connected device/emulator but does NOT produce a standalone APK. To create an APK explicitly:

```bash
npm run prebuild
cd android && ./gradlew assembleRelease
```

The APK is generated at `android/app/build/outputs/apk/release/app-release.apk`. APK creation is manual and does not happen automatically when running the app.

## Testing

There is no test script in `package.json`.

There are no unit, component, or E2E tests in this checkout.

Available validation commands:

```bash
npm run typecheck
npm run doctor
```

## Linting and Formatting

There are no lint or formatting scripts in `package.json`.

Use the project's existing TypeScript and Expo tooling as the available validation baseline.

## Troubleshooting

### Expo will not start

Run:

```bash
npm run doctor
```

Check that dependencies are installed and that the environment variables are valid.

### Android build fails

Confirm that native Android folders exist after running:

```bash
npm run prebuild
```

Check Android SDK, Java, emulator/device availability, and the Android package configuration in `app.json`.

### iOS build fails

Confirm that native iOS folders exist after running:

```bash
npm run prebuild
```

Check Xcode, simulator/device availability, and iOS configuration in `app.json`.

### NFC flow does not work

Use an NFC-capable Android device. Confirm that the device has NFC enabled and that the card is held flat against the back of the phone.

### Camera scan does not work

Confirm camera permission is granted. The app requests permission before launching the camera.

### API requests fail

Check `EXPO_PUBLIC_API_URL` and the external API availability. The API client uses that variable as the base URL for every HTTP request.

### WebSocket is not connecting

Check `EXPO_PUBLIC_WS_URL`. The socket context returns early when the variable is unset.

## Documentation Links

- [Architecture](./ARCHITECTURE.md)
- [Project Structure](./PROJECT_STRUCTURE.md)
- [Agent Rules](./AGENTS.md)
