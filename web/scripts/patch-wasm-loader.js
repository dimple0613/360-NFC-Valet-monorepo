#!/usr/bin/env node
/**
 * Post-build patch: Turbopack hardcodes absolute Windows filesystem paths in
 * `loadWasmChunk()` for `import()` of `.wasm` files. On Cloudflare Workers
 * (Linux, no FS) those paths don't resolve -> Prisma engine fails to load.
 *
 * This script:
 *  1. Copies query_engine_bg.wasm into .open-next/assets/ so Workers Assets
 *     serves it at the origin URL.
 *  2. Rewrites loadWasmChunk() in every Turbopack server chunk that defines
 *     it, replacing the broken `import(absWindowsPath)` with `fetch()` +
 *     `WebAssembly.compile()`.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const OPENNEXT = path.join(ROOT, ".open-next");
const SERVER_FN = path.join(OPENNEXT, "server-functions/default");
const CHUNKS_DIR = path.join(SERVER_FN, ".next/server/chunks");
const ASSETS_DIR = path.join(OPENNEXT, "assets");

// ---------- 1. Copy WASM binary into Workers Assets ----------
fs.mkdirSync(ASSETS_DIR, { recursive: true });

const ssrDir = path.join(SERVER_FN, ".next/server/chunks/ssr");
const WASM_DST = path.join(ASSETS_DIR, "query_engine_bg.wasm");
let copied = false;

// Try the known filename first
const knownSrc = path.join(ssrDir, "src_lib_db_generated_client_query_engine_bg_05ek5-k.wasm");
if (fs.existsSync(knownSrc)) {
  fs.copyFileSync(knownSrc, WASM_DST);
  console.log("[patch-wasm] Copied WASM (known path) -> " + WASM_DST);
  copied = true;
}

// If not found, search the ssr directory
if (!copied) {
  try {
    for (const f of fs.readdirSync(ssrDir)) {
      if (f.includes("query_engine_bg") && f.endsWith(".wasm")) {
        fs.copyFileSync(path.join(ssrDir, f), WASM_DST);
        console.log("[patch-wasm] Copied WASM (" + f + ") -> " + WASM_DST);
        copied = true;
        break;
      }
    }
  } catch { /* ssr dir might not exist */ }
}

// Last resort: search all chunks dirs
if (!copied) {
  for (const dir of ["", "ssr"]) {
    try {
      const searchDir = path.join(CHUNKS_DIR, dir);
      for (const f of fs.readdirSync(searchDir)) {
        if (f.includes("query_engine_bg") && f.endsWith(".wasm")) {
          fs.copyFileSync(path.join(searchDir, f), WASM_DST);
          console.log("[patch-wasm] Copied WASM (from " + (dir || "chunks") + "/" + f + ") -> " + WASM_DST);
          copied = true;
          break;
        }
      }
    } catch { /* ignore */ }
    if (copied) break;
  }
}

if (!copied) {
  console.error("[patch-wasm] FATAL: Cannot locate query_engine_bg.wasm in build output.");
  process.exit(1);
}

// ---------- 2. Patch loadWasmChunk in Turbopack chunks ----------

// The replacement uses fetch() + WebAssembly.compile() instead of import()
// with absolute Windows paths. fetch() to the same origin goes through the
// OpenNext asset resolver which serves files from .open-next/assets/.
const REPLACEMENT = [
  "async function loadWasmChunk(chunkPath) {",
  '    if (typeof chunkPath === "string" && chunkPath.endsWith(".wasm")) {',
  '      const resp = await fetch("/" + chunkPath.split("/").pop());',
  "      if (resp.ok) {",
  "        const bytes = await resp.arrayBuffer();",
  "        return await WebAssembly.compile(bytes);",
  "      }",
  "    }",
  '    throw new Error("loadWasmChunk: unsupported chunk on Workers: " + chunkPath);',
  "  }",
].join("\n");

let patched = 0;

function patchFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch { return false; }

  if (!content.includes("async function loadWasmChunk")) return false;

  // Replace the entire loadWasmChunk function block.
  // The regex matches from "async function loadWasmChunk(chunkPath) {" through
  // the matching closing "  }" (indented with exactly 2 spaces + closing brace).
  const updated = content.replace(
    /async function loadWasmChunk\(chunkPath\) \{[\s\S]*?^  \}/m,
    REPLACEMENT
  );

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, "utf8");
    console.log("[patch-wasm] Patched " + path.basename(filePath));
    return true;
  }
  return false;
}

// Search all chunk files for loadWasmChunk
function searchAndPatch(dir) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchAndPatch(full);
      } else if (entry.name.endsWith(".js")) {
        if (patchFile(full)) patched++;
      }
    }
  } catch { /* dir might not exist */ }
}

searchAndPatch(CHUNKS_DIR);

// Also check handler.mjs in case loadWasmChunk was inlined there
try {
  if (patchFile(path.join(SERVER_FN, "handler.mjs"))) patched++;
} catch { /* ignore */ }

if (patched === 0) {
  console.error("[patch-wasm] WARNING: No files patched - loadWasmChunk not found in any chunk.");
  process.exit(1);
} else {
  console.log("[patch-wasm] Done. Patched " + patched + " file(s).");
}
