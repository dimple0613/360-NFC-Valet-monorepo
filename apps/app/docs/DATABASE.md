# DATABASE.md - Data & Local Storage Reference

## Overview

- **No backend database** exists yet. This is a React Native (Expo) client app.
- All local persistence uses **AsyncStorage** (`@react-native-async-storage/async-storage`) wrapped by `src/services/storage.ts`.
- The backend contract is defined by the domain models in `src/types/index.ts` and endpoint constants in `src/api/endpoints.ts`.

## Storage keys

Prefix: `@360nfc`. Managed in `src/services/storage.ts` (`StorageKeys`).

| Key | Type | Purpose |
|---|---|---|
| `@360nfc:accessToken` | string | JWT access token |
| `@360nfc:refreshToken` | string | JWT refresh token |
| `@360nfc:user` | `User` (JSON) | Cached logged-in user |

## Models (`src/types/index.ts`)

### `User`

| Field | Type | Notes |
|---|---|---|
| `id` | string | Backend user id |
| `valetId` | string | Valet ID used for login |
| `email` | string | |
| `fullName` | string | |
| `role` | `UserRole` | `driver` / `admin` |

### `AuthTokens`

| Field | Type | Notes |
|---|---|---|
| `accessToken` | string | Short-lived JWT |
| `refreshToken` | string | Long-lived refresh token |

### `LoginResponse`

`AuthTokens` + `user: User`.

### `UserRole`

`"driver" | "admin"`.

## Planned

- Real backend (REST API) backing `ApiEndpoints`.
- `expo-secure-store` for sensitive tokens on native.
