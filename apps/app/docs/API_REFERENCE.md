# API_REFERENCE.md

All HTTP calls go through `src/api/client.ts` (`http` wrapper). The wrapper attaches `Content-Type: application/json`, serializes bodies, enforces a 15s timeout via `AbortController`, and throws `Error("API request failed with status <code>")` on non-2xx responses.

Endpoint paths are centralized in `src/api/endpoints.ts` (`ApiEndpoints`) and prefixed with `EXPO_PUBLIC_API_URL` (default `http://localhost:3000/api`) from `src/config.ts`.

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Log in with Valet ID/email + password → `LoginResponse` (`user` + `accessToken` + `refreshToken`) |
| POST | `/auth/logout` | Invalidate the current session/tokens |
| POST | `/auth/refresh` | Exchange `refreshToken` for a new `accessToken` |

## Valet

| Method | Path | Description |
|---|---|---|
| GET | `/valet/shift` | Current shift info for the logged-in driver |
| GET | `/valet/vehicles` | Vehicles assigned to the current shift |

> The valet endpoints are **planned** — no screen consumes them yet.

## Usage

```ts
import { http } from "@/api";
import { ApiEndpoints } from "@/api/endpoints";
import type { LoginResponse } from "@/types";

const login = (identifier: string, password: string) =>
  http.post<LoginResponse>(ApiEndpoints.auth.login, { identifier, password });
```

## Data models (`src/types/index.ts`)

- `UserRole` = `"driver" | "admin"`
- `User` — `id`, `valetId`, `email`, `fullName`, `role`
- `AuthTokens` — `accessToken`, `refreshToken`
- `LoginResponse` extends `AuthTokens` with `user`

## Authorization notes

- Tokens are persisted via `src/services/storage.ts` (`StorageKeys.accessToken` / `refreshToken` / `user`), ready to be attached as headers on authenticated requests.
- The current `DriverLogin` screen does **not** call the API yet — the button triggers a local alert.
