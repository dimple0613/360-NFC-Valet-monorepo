import path from "node:path";
import { config as loadEnv } from "dotenv";

// The valet data layer (app/tenant-admin/_lib/db.ts) creates its pg pool from
// `process.env.DATABASE_URL` at import time. The super-admin Prisma client
// self-loads web/.env, so web tests that touch Prisma tables work without
// this — but tests that import the valet `pg` pool need DATABASE_URL in the
// process explicitly. Mirror next.config.ts: load web/.env (single source of
// truth for the merged DB), letting any real inherited env win (dotenv
// doesn't override existing vars).
loadEnv({ path: path.resolve(__dirname, "./.env") });