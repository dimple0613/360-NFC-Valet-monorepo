# AGENTS.md

Guidance for AI coding agents working in this repository.

## Commands

```bash
npm run serve        # start Expo dev server
npm run typecheck    # TypeScript type check (RUN AFTER EVERY CODE CHANGE)
npm run doctor       # validate Expo project health
```

## Conventions

- **TypeScript strict** — never introduce `any` or implicit `any`.
- **Never hard-code design values** — use `@/constants` (colors, spacing, typography).
- **One screen = one folder** under `src/screens/<ScreenName>/index.tsx`.
- **No direct `fetch` in screens** — always go through `@/api/client` (`http`).
- **Add new routes** to `RootStackParamList` in `src/navigation/types.ts` before using them.
- **Path alias** `@/*` maps to `src/*` — prefer it over long relative imports.
- Follow the existing component style: functional components, inline `StyleSheet`/style objects, explicit types.
- Do not add comments to code unless asked.

## Workflow

1. Explore the relevant folders first (`src/screens`, `src/components`, etc.).
2. Implement the change following the conventions above.
3. Run `npm run typecheck` and fix any errors.
4. Run `npm run doctor` if native module versions were touched.
5. Commit and push the change:

   ```bash
   git add -A
   git commit -m "describe the change"
   git push
   ```

   After finishing a task, commit and push to GitHub automatically (remote `origin`, branch `main`) unless the user says otherwise.

6. When a task changes features or behavior, update the relevant docs (`.md` files such as `README.md` or `docs/*.md`) to stay in sync, and include those doc updates in the same commit.
