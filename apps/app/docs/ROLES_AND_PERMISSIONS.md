# ROLES_AND_PERMISSIONS.md

## Current State

`UserRole` (`src/types/index.ts`) defines two roles:

| Role | Purpose |
|---|---|
| `driver` | Valet driver — login, shift, vehicles |
| `admin` | Administrative access |

Authorization is **client-side only** at this stage (the login screen is not wired to the API). Enforcement must eventually live server-side — the app must never trust client-side role checks alone.

## How authorization is intended to work

- Login returns `LoginResponse` with `user.role`.
- Screens gate features on the cached `User` role from `src/services/storage.ts`.
- The backend enforces role-based access on every endpoint (`ApiEndpoints`), re-deriving the caller's role from the session — never from the client.

## Planned

- Server-side RBAC for `/valet/*` endpoints (driver-only).
- Admin endpoints for shift/vehicle management.
- Permission keys (e.g. `shift.view`, `shift.manage`, `vehicles.manage`) mirroring the driver/admin split.
