#!/usr/bin/env node
/**
 * Post-build patch: Turbopack hardcodes absolute Windows filesystem paths in
 * loadWasmChunk() for import() of .wasm files. On Cloudflare Workers those
 * paths don't resolve.
 *
 * Strategy: embed the WASM binary as base64 directly in the bundle and
 * decode + compile it at runtime. This avoids:
 *   - import() with absolute Windows paths (doesn't work on Workers)
 *   - fetch() (OpenNext intercepts globalThis.fetch and wraps it in
 *     CustomRequest, which throws)
 *   - fs.readFileSync (no filesystem on Workers)
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const OPENNEXT = path.join(ROOT, ".open-next");
const SERVER_FN = path.join(OPENNEXT, "server-functions/default");
const CHUNKS_DIR = path.join(SERVER_FN, ".next/server/chunks");
const ASSETS_DIR = path.join(OPENNEXT, "assets");

// ---------- 1. Read WASM binary and encode as base64 ----------
fs.mkdirSync(ASSETS_DIR, { recursive: true });
const WASM_PATH = path.join(ASSETS_DIR, "query_engine_bg.wasm");
let wasmFound = false;

const ssrDir = path.join(CHUNKS_DIR, "ssr");
const knownSrc = path.join(ssrDir, "src_lib_db_generated_client_query_engine_bg_05ek5-k.wasm");
if (fs.existsSync(knownSrc)) {
  fs.copyFileSync(knownSrc, WASM_PATH);
  wasmFound = true;
}
if (!wasmFound) {
  try {
    for (const f of fs.readdirSync(ssrDir)) {
      if (f.includes("query_engine_bg") && f.endsWith(".wasm")) {
        fs.copyFileSync(path.join(ssrDir, f), WASM_PATH);
        wasmFound = true;
        break;
      }
    }
  } catch {}
}
if (!wasmFound) {
  for (const dir of ["", "ssr"]) {
    try {
      for (const f of fs.readdirSync(path.join(CHUNKS_DIR, dir))) {
        if (f.includes("query_engine_bg") && f.endsWith(".wasm")) {
          fs.copyFileSync(path.join(CHUNKS_DIR, dir, f), WASM_PATH);
          wasmFound = true;
          break;
        }
      }
    } catch {}
    if (wasmFound) break;
  }
}
if (!wasmFound) {
  console.error("[patch-wasm] FATAL: Cannot find query_engine_bg.wasm");
  process.exit(1);
}

const wasmBuffer = fs.readFileSync(WASM_PATH);
const wasmBase64 = wasmBuffer.toString("base64");
console.log("[patch-wasm] WASM: " + wasmBuffer.length + " bytes, base64: " + wasmBase64.length + " chars");

// ---------- 2. Build the replacement function ----------
// Decode base64 -> Uint8Array -> WebAssembly.compile (no fetch, no fs, no import)
const replacement =
  'async function loadWasmChunk(chunkPath){var b64="' + wasmBase64 + '";var bin=atob(b64);var bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return await WebAssembly.compile(bytes)}';

// ---------- 3. Patch loadWasmChunk in handler.mjs ----------
// The function appears as a single minified line with a switch statement.
// Regex matches from "async function loadWasmChunk(chunkPath){" through
// the closing "}}" of the switch+function.
const FN_REGEX = /async function loadWasmChunk\(chunkPath\)\{switch\(chunkPath\)\{(?:case"[^"]*":return\(await import\("[^"]*"\)\)\.default;)*default:throw new Error\(`[^`]*`\)\}\}/g;

let totalPatched = 0;

function patchFile(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, "utf8"); } catch { return; }
  if (!content.includes("loadWasmChunk")) return;

  const basename = path.basename(filePath);
  const updated = content.replace(FN_REGEX, replacement);

  if (updated !== content) {
    const count = (content.match(FN_REGEX) || []).length;
    fs.writeFileSync(filePath, updated, "utf8");
    console.log("[patch-wasm] Patched " + basename + " (" + count + "x)");
    totalPatched += count;
  }
}

// Patch handler.mjs (the esbuild bundle — this is what deploys)
patchFile(path.join(SERVER_FN, "handler.mjs"));

// Patch any separate chunk files too
function walkSync(dir) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkSync(full);
      else if (e.name.endsWith(".js")) patchFile(full);
    }
  } catch {}
}
walkSync(CHUNKS_DIR);

if (totalPatched === 0) {
  console.error("[patch-wasm] WARNING: Nothing patched!");
  process.exit(1);
}
console.log("[patch-wasm] Done. " + totalPatched + " function(s) patched.");
