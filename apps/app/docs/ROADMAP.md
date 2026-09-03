# ROADMAP.md

Planned work to bring the codebase in line with `PROJECT.md`. Ordered by dependency and impact. Items marked ✅ are complete.

## Phase 1 — Foundation

- ✅ **1. Project scaffold** — Expo SDK 54 + TypeScript strict, layered `src/` structure, path alias `@/*`.
- ✅ **2. Navigation shell** — `RootNavigator` (native stack, `headerShown: false`) + typed `RootStackParamList`.
- ✅ **3. API client** — `http` wrapper (`src/api/client.ts`) with JSON, timeout, typed methods; centralized endpoints (`src/api/endpoints.ts`).
- ✅ **4. Data layer** — `User` / `AuthTokens` / `LoginResponse` models, AsyncStorage wrapper (`src/services/storage.ts`).

## Phase 2 — Auth

- ✅ **5. Driver login screen** — branded UI with Valet ID/password fields.
- ❌ **6. Wire login to API** — call `ApiEndpoints.auth.login`, persist tokens, surface errors.
- ❌ **7. Authenticated requests** — attach bearer token; auto-refresh via `/auth/refresh`.
- ❌ **8. Forgot password flow** — link + `POST /auth/forgot-password`.
- ❌ **9. Secure token storage** — switch to `expo-secure-store` on native.

## Phase 3 — Shift & vehicle features

- ❌ **10. Shift screen** — `GET /valet/shift`.
- ❌ **11. Vehicles screen** — `GET /valet/vehicles`.
- ❌ **12. NFC interaction flow** — core valet NFC workflows (pending definition).

## Phase 4 — Admin & hardening

- ❌ **13. Admin role gating** — server-side RBAC + permission keys.
- ❌ **14. Error/empty/loading states** everywhere (via `useAsyncData`).

## Phase 5 — Testing & CI/CD

- ❌ **15. jest-expo + RN Testing Library** — unit + component tests (see `docs/TESTING_STRATEGY.md`).
- ❌ **16. E2E tests** (Detox/Maestro) for auth + valet flows.
- ❌ **17. GitHub Actions** — typecheck + test (see `docs/DEPLOYMENT.md`).

## Phase 6 — Production

- ❌ **18. EAS build + submit** (App Store / Play Store).
- ❌ **19. Monitoring/logging strategy.**

## Immediate next steps

1. Wire the `DriverLogin` button to `ApiEndpoints.auth.login` and persist the returned tokens.
2. Add an authenticated client with token refresh.
3. Build the shift + vehicles screens against the valet endpoints.
