# Architecture

## Scope

This repository is an Expo / React Native driver console, not a Next.js app. It has no App Router, Pages Router, server actions, API routes, middleware, or database layer.

## Application Architecture

The app is a single native React Native application started from `App.tsx`.

`App.tsx` composes the root providers and the root navigator:

```text
App
 ├── SafeAreaProvider
 ├── AuthProvider
 ├── SocketProvider
 ├── ErrorBoundary
 │    └── NavigationContainer
 │         └── RootNavigator
 └── React Native Toast
```

`RootNavigator` selects either the public authentication stack or the authenticated driver stack based on `AuthContext`.

## Screen Architecture

| Screen | Navigation | Purpose | Access |
| --- | --- | --- | --- |
| `DriverLogin` | Public stack | Driver sign-in with Formik/Yup validation | Public |
| `DriverForgotPassword` | Public stack | Request a password reset link | Public |
| `DriverResetPassword` | Public stack | Reset password using a reset token | Public |
| `DriverSelectLocation` | Authenticated stack | Choose work property and start shift | Authenticated |
| `DriverHome` | Authenticated stack | Dashboard, live queue, NFC entry points | Authenticated |
| `DriverNfcTap` | Authenticated stack | Read an NFC card or enter a card number manually | Authenticated |
| `DriverWriteCard` | Authenticated stack | Encode a card number into an NFC card | Authenticated |
| `DriverCarDetails` | Authenticated stack | Enter vehicle details and create an order | Authenticated |
| `DriverCardActivated` | Authenticated stack | Record parking location and close the parked order | Authenticated |
| `DriverPickupRequests` | Authenticated stack | Review active, to-park, and completed queue items | Authenticated |
| `DriverUpdateParking` | Authenticated stack | Update zone and slot for a parked order | Authenticated |
| `DriverReturnRequest` | Authenticated stack | Bottom-sheet queue for the next return request | Authenticated |
| `DriverRetrievalDetail` | Authenticated stack | Retrieve order details, update ETA, and mark returned | Authenticated |
| `DriverHistory` | Authenticated stack | Review completed orders by today/week/month | Authenticated |
| `DriverProfile` | Authenticated stack | Driver profile, notification preference, switch location, sign out | Authenticated |

## Navigation

Navigation is handled by `@react-navigation/native-stack`.

`src/navigation/RootNavigator.tsx` creates one `NativeStackNavigator` with `headerShown: false`.

Route parameters are typed in `src/navigation/types.ts`:

- `DriverResetPassword`: `{ token: string }`
- `DriverCarDetails`: `{ cardUid: string }`
- `DriverCardActivated`: `{ orderId: number; plate: string; carDesc: string }`
- `DriverUpdateParking`: `{ orderId: number }`
- `DriverRetrievalDetail`: `{ orderId: number }`

The bottom navigation is a custom `TabBar` component in `src/components/TabBar.tsx`. It is not a React Navigation tab navigator. It manually navigates to `DriverHome`, `DriverPickupRequests`, `DriverNfcTap`, `DriverHistory`, and `DriverProfile`.

## Component Architecture

### Shared UI

- `src/components/ui/AppButton.tsx` - reusable gradient button with primary, secondary, and danger variants
- `src/components/ui/CustomToast.tsx` - custom toast presentation for success, error, and info messages
- `src/components/ui/ErrorBoundary.tsx` - class-based error boundary
- `src/components/ui/StatusBar.tsx` - small wrapper around `expo-status-bar`
- `src/components/TabBar.tsx` - fixed bottom navigation bar used by several authenticated screens

### Feature Components

Most screens are self-contained feature components. They own their local form state, loading state, and API calls.

Reusable logic is split into:

- `src/hooks/useNfc.ts` - NFC tag reading and writing
- `src/hooks/useAsyncData.ts` - lightweight async data loading and reload helper
- `src/theme/index.tsx` - custom `Text` and `TextInput` components that map React Native font weights to bundled PlusJakartaSans fonts

## Data Flow

### Authentication Flow

```text
DriverLogin
  -> AuthContext.signIn
  -> POST /auth/driver-login
  -> AsyncStorage token + user
  -> RootNavigator selects authenticated stack
```

On app start, `AuthContext` restores the token and saved driver from AsyncStorage. It then calls `GET /driver/profile`. If that refresh fails, the app signs the driver out.

### Shift Start Flow

```text
DriverSelectLocation
  -> GET /driver/properties
  -> PATCH /driver/shift with onShift: true and propertyId
  -> refreshDriver
  -> DriverHome
```

If the shift endpoint returns a new token, the token is saved again before refreshing the driver profile.

### New Arrival Flow

```text
DriverHome
  -> DriverNfcTap
  -> useNfc.readTag
  -> DriverCarDetails(cardUid)
  -> POST /driver/orders
  -> DriverCardActivated(orderId, plate, carDesc)
  -> PATCH /driver/orders/{id} with status: parked
  -> DriverHome
```

`DriverNfcTap` can read an NFC tag or accept a manually entered four-digit card number. `DriverCarDetails` can also scan a license plate using the camera and image manipulation tools.

### Retrieval Flow

```text
Socket event or polling
  -> DriverPickupRequests / DriverReturnRequest / DriverRetrievalDetail
  -> PATCH /driver/orders/{id}
  -> reload queue/profile data
```

`DriverPickupRequests` can accept a return request and mark it returned. `DriverReturnRequest` shows the next return request in a bottom sheet with a 15-second pass timer. `DriverRetrievalDetail` can add 5 or 10 minutes to the guest ETA, notify the guest of a delay, and mark the car as returned.

### History Flow

```text
DriverHistory
  -> GET /driver/history?period=day|week|month
  -> grouped history list
```

## API and Services

### HTTP Client

`src/api/client.ts` is the only HTTP client. It:

- Uses `API_URL` from `src/config.ts`
- Adds `Authorization: Bearer <token>` when a token exists
- Uses a 15-second timeout
- Removes saved auth data and calls the logout handler on HTTP 401
- Throws an error with `data.error` when the response is not OK

### Endpoint Registry

`src/api/endpoints.ts` defines endpoint constants:

- `POST /auth/driver-login`
- `POST /auth/driver/forgot-password`
- `POST /auth/driver/reset-password`
- `PATCH /auth/logout`
- `GET /driver/dashboard`
- `GET /driver/queue`
- `PATCH /driver/shift`
- `POST /driver/orders`
- `PATCH /driver/orders/{id}`
- `GET /driver/properties`
- `GET /driver/history`
- `GET /driver/profile`
- `POST /driver/scan-plate`
- `POST /driver/push-token`
- `PATCH /driver/notify-delay`

There are no local API routes in this repository. The API is external.

### WebSocket

`src/context/SocketContext.tsx` connects to `EXPO_PUBLIC_WS_URL` when present.

It sends:

```ts
auth: { token, role: "driver" }
```

It subscribes to the driver property when `driver.propertyId` is available and listens for:

- `valet.order.created`
- `valet.order.return.requested`
- `valet.order.completed`
- `valet.order.parked`
- `valet.delay.notified`

Screens subscribe to selected socket events and call their local reload functions.

### Storage

`src/services/storage.ts` wraps AsyncStorage under the `@360nfc` prefix.

Stored keys:

- `@360nfc:token`
- `@360nfc:user`
- `@360nfc:notificationsOn`

There is no SQLite, local file store, or other persistence layer.

## State Management

The app does not use Redux, Zustand, React Query, or another external state library.

State is split across:

- `AuthContext`: current driver, loading state, sign-in, sign-out, refresh
- `SocketContext`: socket instance and connected state
- `useAsyncData`: local loading/error/data state for screen fetches
- Screen-level React state: form values, selected filters, selected location, loading flags, timers, and transient UI state
- AsyncStorage: persisted auth and notification preference data

## Authentication and Authorization

Authentication is driver login with token-based session storage.

Authorization is lightweight:

- The client displays authenticated screens only after `AuthContext` has a driver.
- The socket connection includes `role: "driver"`.
- The TypeScript `UserRole` type includes `driver` and `admin`, but the client does not implement a separate RBAC system.
- There is no middleware, route guard library, or server-side authorization code in this repository.

## Device and Native Features

### NFC

`src/hooks/useNfc.ts` uses `react-native-nfc-manager`.

Used by:

- `DriverNfcTap` - reads NDEF records or tag UIDs
- `DriverWriteCard` - writes an NDEF text record containing the card number

The app requests NDEF first, then falls back to IsoDep and NfcA if needed.

### Camera and Plate Scan

`DriverCarDetails` uses:

- `expo-image-picker`
- `expo-image-manipulator`

It requests camera permission, captures an image, resizes it to 1280px, compresses it as JPEG, and sends the base64 image to `POST /driver/scan-plate`.

### Push Notifications

`src/utils/notifications.ts` uses:

- `expo-notifications`
- `expo-device`

`SocketContext` registers for push notifications and posts the token to `POST /driver/push-token`.

### Permissions and Platform Notes

Android configuration in `app.json` declares:

- `android.permission.NFC`
- Cleartext traffic enabled
- Adaptive icon
- Package name `com.valet.threesixtynfc`
- Splash image and background color

The Android configuration references `google-services.json`, but that file is not present in this checkout.

iOS configuration enables tablet support and defines an icon. There is no iOS bundle identifier or Info.plist configuration in this checkout.

No Bluetooth, GPS/location permission, file system, or biometric module is used.

## Expo and Build Configuration

`app.json` defines:

- App name: `360 NFC Valet`
- Slug: `360-nfc-valet`
- Version: `1.0.0`
- Portrait orientation
- Dark user interface style
- Android package: `com.valet.threesixtynfc`
- Web favicon
- Asset bundle pattern for all assets

There are no Expo plugins listed in `app.json`.

There is no `eas.json` in this checkout.

There is no `metro.config.js` in this checkout.

There are no generated `android/` or `ios/` folders in this checkout. `npm run prebuild` is the command used to generate them.

## Styling

The app uses React Native `StyleSheet` and inline style objects.

Shared design tokens are in `src/constants/`:

- `Colors`
- `Spacing`
- `Typography`

`src/theme/index.tsx` provides custom `Text` and `TextInput` components that map `fontWeight` to bundled PlusJakartaSans font files.

`babel-plugin-font-alias.js` rewrites imports of `Text` and `TextInput` from `react-native` to `@/theme` so the custom components are used consistently.

## Database and Backend

There is no database, ORM, schema, model, seed, migration, or backend service in this repository.

Backend behavior is assumed to live outside this checkout and is accessed through the HTTP and WebSocket endpoints listed above.

## Testing

There is no test framework or test script in `package.json`.

No test files are present in this checkout.

Use:

```bash
npm run typecheck
npm run doctor
```

for available validation.

## Important Pitfalls

- This is not a Next.js project.
- Do not add Next.js router concepts unless the project is intentionally being changed.
- Do not assume native folders exist; they are generated by Expo Prebuild.
- Do not assume `google-services.json` exists; it is referenced by `app.json` but absent here.
- Do not assume there is a database layer; all data is external API data.
- Do not assume there are tests; there is no test command.
- Do not commit `.env` or real credentials.
