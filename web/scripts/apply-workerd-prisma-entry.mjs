/**
 * Applies the workerd-condition transform to the Prisma client entry points in
 * the OpenNext build output.
 *
 * OpenNext is supposed to rewrite `.prisma/client/package.json` in the build
 * output so that only the `workerd` condition survives in its exports/imports
 * maps (the same `transformPackageJson` logic lives in
 * `@opennextjs/cloudflare/dist/cli/build/utils/workerd.js`). That rewrite is
 * what makes workerd resolve `#main-entry-point` -> `wasm.js` (the engine-less
 * client) instead of the `node` entry `index.js` (which tries to read
 * `query_compiler_bg.wasm` from disk via fs and fails in the Worker runtime).
 *
 * Under Next 16 Turbopack tracing the traced node_modules directories get
 * renamed (`@prisma/client-<hash>`), so OpenNext's `copyWorkerdPackages`
 * silently skips `.prisma/client` and the transform never runs. This script
 * applies the identical transform directly to the built output after
 * `opennextjs-cloudflare build`.
 *
 * Only levels that actually contain a `workerd` condition are pruned; branches
 * without one are left untouched, so unrelated entries can never be emptied.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientPkgPath = path.join(
  repoRoot,
  ".open-next/server-functions/default/node_modules/.prisma/client/package.json"
);

/**
 * Keeps only the `workerd` condition at any map level that contains one.
 * String targets and levels without a `workerd` condition pass through as-is.
 * @returns {{ value: unknown, hasWorkerd: boolean }}
 */
function keepWorkerdBranches(node) {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return { value: node, hasWorkerd: false };
  }
  if ("workerd" in node) {
    return { value: { workerd: node.workerd }, hasWorkerd: true };
  }
  const out = {};
  let hasWorkerd = false;
  for (const [key, child] of Object.entries(node)) {
    const { value, hasWorkerd: childHasWorkerd } = keepWorkerdBranches(child);
    if (childHasWorkerd) hasWorkerd = true;
    if (value !== undefined) out[key] = value;
  }
  return { value: hasWorkerd ? out : node, hasWorkerd };
}

const pkg = JSON.parse(await readFile(clientPkgPath, "utf8"));
const prunedImports = keepWorkerdBranches(pkg.imports ?? {});
const prunedExports = keepWorkerdBranches(pkg.exports ?? {});

const main = prunedImports.value?.["#main-entry-point"];
const requireTarget = main?.require?.workerd;
const importTarget = main?.import?.workerd;
if (requireTarget !== "./wasm.js" || importTarget !== "./wasm.js") {
  throw new Error(
    `[apply-workerd-prisma-entry] transform produced unexpected "#main-entry-point": ` +
      `require -> ${JSON.stringify(requireTarget)}, import -> ${JSON.stringify(importTarget)}`
  );
}

const transformed = { ...pkg, imports: prunedImports.value, exports: prunedExports.value };
await writeFile(clientPkgPath, JSON.stringify(transformed, null, 2) + "\n");
console.log(
  "[apply-workerd-prisma-entry] patched .prisma/client exports/imports to workerd-only; " +
    `#main-entry-point -> ${requireTarget}`
);