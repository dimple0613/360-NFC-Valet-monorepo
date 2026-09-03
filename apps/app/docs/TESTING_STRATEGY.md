# TESTING_STRATEGY.md

## Current State

**No tests exist.** No test framework, no test scripts, no CI. The only verification is `npm run typecheck` (tsc) and `npm run doctor` (Expo project health).

## Target (per PROJECT.md)

- Unit tests for business logic
- Integration tests for API client behavior
- Component tests for screens
- End-to-end tests for critical user flows

**Status: Pending Definition** — framework and coverage targets pending.

## Proposed Stack

| Layer | Tool | Purpose |
|---|---|---|
| Test runner | `jest-expo` | Unit + component tests |
| Component | React Native Testing Library | Screen/component tests |
| Coverage | Jest coverage | Coverage reports |
| E2E | Detox / Maestro | Critical user flows |

## Suggested scripts

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## Test plan map

### Unit tests

- `src/utils/index.ts` — `isValidEmail`, `isValidValetId`, `sleep`.
- `src/services/storage.ts` — `get`/`set`/`remove` round-trip (AsyncStorage mock).
- `src/api/client.ts` — URL prefixing, body serialization, non-2xx throws, timeout abort.

### Component tests

- `DriverLogin` — renders fields; validation errors; login button calls API (mocked) and shows loading.

### Integration / E2E

- Login → shift → vehicles happy path.
- Forgot password flow.
- Token refresh + logout on 401.

## CI note

Wire `typecheck` + `test` into a GitHub Actions workflow (see `docs/DEPLOYMENT.md`).
