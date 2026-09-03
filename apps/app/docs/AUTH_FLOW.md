# AUTH_FLOW.md - Authentication Flows

## Current State

**Planned, not wired.** The login screen is UI-only. The API client, typed models, and storage service are ready to support the flow described below.

## Intended Flow

1. Driver enters Valet ID or email + password on `DriverLogin`.
2. Screen validates input with `isValidValetId` / `isValidEmail` from `src/utils`.
3. Screen calls `http.post<LoginResponse>(ApiEndpoints.auth.login, { identifier, password })`.
4. On success, tokens + user are persisted via `src/services/storage.ts` (`StorageKeys.accessToken`, `refreshToken`, `user`).
5. An authenticated API client attaches `Authorization: Bearer <accessToken>` on subsequent requests.
6. Expired access tokens are refreshed via `/auth/refresh`; refresh failure triggers logout.

## Sessions

- `AuthTokens` (`accessToken` / `refreshToken`) are stored as JSON in AsyncStorage under the `@360nfc` prefix.
- `storage.get<T>` / `storage.set` / `storage.remove` are typed helpers in `src/services/storage.ts`.

## Forgot Password

- The `DriverLogin` screen includes a "Forgot Password?" link (UI only, no handler yet).
- Planned endpoint: `POST /auth/forgot-password` → email reset link.

## Security Notes (planned)

- Passwords sent over HTTPS only.
- Access tokens short-lived; refresh token rotation on `/auth/refresh`.
- Tokens stored in AsyncStorage (in plaintext there is no OS keychain on web; native builds should use `expo-secure-store`).

## Planned

- Wire the login button to `ApiEndpoints.auth.login`.
- Add authenticated request wrapper with automatic token refresh.
- Secure token storage via `expo-secure-store`.
- Forgot password flow.
