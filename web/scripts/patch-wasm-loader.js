#!/usr/bin/env node
/**
 * Post-build patch: Turbopack hardcodes absolute Windows filesystem paths in
 * loadWasmChunk() for import() of .wasm files. On Cloudflare Workers those
 * paths don't resolve. This script replaces loadWasmChunk with a fetch()-based
 * loader that fetches the WASM from Workers Assets.
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
const WASM_DST = path.join(ASSETS_DIR, "query_engine_bg.wasm");
let copied = false;

const ssrDir = path.join(CHUNKS_DIR, "ssr");
const knownSrc = path.join(ssrDir, "src_lib_db_generated_client_query_engine_bg_05ek5-k.wasm");
if (fs.existsSync(knownSrc)) {
  fs.copyFileSync(knownSrc, WASM_DST);
  console.log("[patch-wasm] Copied WASM -> " + WASM_DST);
  copied = true;
}
if (!copied) {
  try {
    for (const f of fs.readdirSync(ssrDir)) {
      if (f.includes("query_engine_bg") && f.endsWith(".wasm")) {
        fs.copyFileSync(path.join(ssrDir, f), WASM_DST);
        console.log("[patch-wasm] Copied WASM (" + f + ")");
        copied = true;
        break;
      }
    }
  } catch {}
}
if (!copied) {
  for (const dir of ["", "ssr"]) {
    try {
      for (const f of fs.readdirSync(path.join(CHUNKS_DIR, dir))) {
        if (f.includes("query_engine_bg") && f.endsWith(".wasm")) {
          fs.copyFileSync(path.join(CHUNKS_DIR, dir, f), WASM_DST);
          console.log("[patch-wasm] Copied WASM (from " + f + ")");
          copied = true;
          break;
        }
      }
    } catch {}
    if (copied) break;
  }
}
if (!copied) {
  console.error("[patch-wasm] FATAL: Cannot find query_engine_bg.wasm");
  process.exit(1);
}

// ---------- 2. Patch loadWasmChunk ----------
// Replacement: uses fetch() + WebAssembly.compile()
const REPLACEMENT = 'async function loadWasmChunk(chunkPath){const resp=await fetch("/query_engine_bg.wasm");if(resp.ok){const bytes=await resp.arrayBuffer();return await WebAssembly.compile(bytes)}throw new Error("loadWasmChunk: fetch failed for "+chunkPath)}';

// Fast regex: matches the ENTIRE loadWasmChunk function from signature to closing }}
// The function always has: switch(chunkPath){cases...default:throw new Error(...)}}
// No nested braces exist inside the cases, so }} always means switch-close + function-close.
const FN_REGEX = /async function loadWasmChunk\(chunkPath\)\{switch\(chunkPath\)\{(?:case"[^"]*":return\(await import\("[^"]*"\)\)\.default;)*default:throw new Error\(`[^`]*`\)\}\}/g;

let totalPatched = 0;

function patchFile(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, "utf8"); } catch { return; }
  if (!content.includes("loadWasmChunk")) return;

  const basename = path.basename(filePath);
  const before = content.length;
  const updated = content.replace(FN_REGEX, REPLACEMENT);

  if (updated !== content) {
    const count = (content.match(FN_REGEX) || []).length;
    fs.writeFileSync(filePath, updated, "utf8");
    console.log("[patch-wasm] Patched " + basename + " (" + count + "x)");
    totalPatched += count;
  }
}

// Patch handler.mjs (the esbuild bundle - this is what actually deploys)
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
