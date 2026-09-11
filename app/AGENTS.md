# AGENTS.md

## Scope

This file applies only to the current project folder:

```text
D:\laragon\www\360-NFC-Valet-monorepo\app
```

It does not apply to `../mobile`, the monorepo root, or any other folder.

## Task Rules

- Make the smallest safe change required by the current task.
- Do not redesign, refactor, rename, or delete unrelated files.
- Do not change application behavior unless explicitly requested.
- Do not change APIs, dependencies, configuration, native code, or generated files unless explicitly required.
- Do not modify files outside the current project folder.
- Do not touch unrelated user work.
- Preserve existing uncommitted changes.
- Never use `git reset`, `git restore`, `git checkout --`, `git clean`, or `git add .`.
- Stage only files belonging to the current task.
- Do not commit or push unrelated files.

## Documentation Rules

- If a Markdown file is requested, create or update it.
- If a README is requested, update the root `README.md` for this project.
- If documentation is requested, make it factual and based on the current source.
- Do not invent routes, features, APIs, dependencies, commands, deployment systems, or permissions.
- If something is unknown, mark it unknown or requires confirmation.
- Do not document secrets or real environment values.
- Verify requested documentation files exist and contain the requested information before completion.

## Project-Specific Rules

- This is an Expo / React Native project, not a Next.js project.
- Do not add Next.js router concepts, server actions, API routes, middleware, or database abstractions unless explicitly requested.
- The app uses React Navigation native stack and a custom `TabBar`; do not assume a tab navigator exists.
- The app uses AsyncStorage for persisted auth and notification preference data.
- The app uses `react-native-nfc-manager` for NFC flows.
- The app uses `expo-notifications` and `expo-device` for push notifications.
- The app uses `expo-image-picker` and `expo-image-manipulator` for plate scanning.
- The app uses Formik and Yup for forms.
- There is no database, ORM, schema, seed, migration, or backend service in this checkout.
- There is no test framework or test script in this checkout.
- There is no generated `android/` or `ios/` folder in this checkout.
- `app.json` references `google-services.json`, but that file is not present in this checkout.
- `EXPO_PUBLIC_API_URL` is the checked-in API base URL variable.
- `EXPO_PUBLIC_WS_URL` is referenced by socket code but is not included in `.env.example`.
- The current checkout has no `eas.json`, `metro.config.js`, or `.github/workflows/` directory.

## Before Editing

Before editing any file:

1. Check the current branch.
2. Check `git status --short`.
3. Re-read the current file from disk.
4. If the file is modified, inspect its current diff.
5. If the file has staged changes, inspect the staged diff.
6. Confirm existing content and changes are still present.
7. Make the minimal requested change.

Before editing multiple files, repeat the check for each file immediately before editing it.

## Before Committing

Before committing:

1. Review the complete TODO list.
2. Confirm every requested file exists and is verified.
3. Check the current branch.
4. Check `git status --short`.
5. Review unstaged and staged diffs.
6. Confirm only current-task files are staged.
7. Confirm no unrelated files, mobile docs, generated files, logs, or secrets are staged.
8. Run `git diff --check` if available.
9. Commit only the current task.
10. Push only the current task commit.

If any requested file is missing or any requirement is incomplete, do not commit or push.

## Verification

Use the available validation commands:

```bash
npm run typecheck
npm run doctor
```

Do not run unnecessary broad audits or unrelated test suites.

## Documentation Links

- [README.md](./README.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEVELOPMENT.md](./DEVELOPMENT.md)
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
