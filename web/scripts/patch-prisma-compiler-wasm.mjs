/**
 * Makes Prisma's bundled query-compiler wasm loader use a statically-imported
 * `WebAssembly.Module`, because the two built-in paths cannot work on Cloudflare
 * Workers:
 *
 * 1. The default (node-flavor) loader reads the `.wasm` from disk via
 *    `fs.readFileSync(path.join(config.dirname, "query_compiler_bg.wasm"))`.
 *    Under workerd `config.dirname` is empty and the file only exists inside the
 *    worker's virtual `/bundle` mount that `nodejs_compat` fs cannot access,
 *    failing with
 *      ENOENT: readAll '/bundle/node_modules/.prisma/client/query_compiler_bg.wasm'
 * 2. Compiling the bytes at runtime with `new WebAssembly.Module(...)` is
 *    rejected by the embedder: "Wasm code generation disallowed by embedder",
 *    and `[wasm_modules]` bindings are rejected for modules-based (ESM) workers
 *    ("Wasm bindings are not allowed in modules-based scripts").
 *
 * The platform-bundled static import (wrangler/esbuild turns
 * `import m from "./…/query_compiler_bg.wasm"` into a compiled
 * `WebAssembly.Module` for ESM workers) is the supported path. This script
 * injects that import into the built handler and swaps the loader body to
 * return it. Run after `opennextjs-cloudflare build`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const handlerPath = path.join(repoRoot, ".open-next/server-functions/default/handler.mjs");

const wasmModuleVar = "__prismaQueryCompilerWasmModule";
const wasmImport = `\nimport ${wasmModuleVar} from "./node_modules/.prisma/client/query_compiler_bg.wasm";\n`;

// The original (build-generated) fs-based loader body.
const fsLoaderCode =
  '{let queryCompilerWasmFilePath=require("path").join(config.dirname,"query_compiler_bg.wasm"),queryCompilerWasmFileBytes=require("fs").readFileSync(queryCompilerWasmFilePath);return new WebAssembly.Module(queryCompilerWasmFileBytes)}';
// Loader variants from earlier iterations of this script (skip if present).
const knownLoaderCodes = [
  '{let queryCompilerWasmModule=globalThis.__prismaQueryCompilerWasm;if(!queryCompilerWasmModule)throw new Error("QUERY_COMPILER_WASM wasm binding not initialized (see scripts/patch-prisma-compiler-wasm.mjs)");return queryCompilerWasmModule}',
  '{let queryCompilerWasmFileBytes=require("node:buffer").Buffer.from("',
];
const bindingLoaderCode = `{return ${wasmModuleVar}}`;

let handler = await readFile(handlerPath, "utf8");

if (handler.includes(bindingLoaderCode) && handler.includes(wasmModuleVar + " from")) {
  console.log("[patch-prisma-compiler-wasm] handler already uses static wasm import; skipping");
} else {
  let next = handler;
  for (const code of knownLoaderCodes) {
    const idx = code.startsWith("{let queryCompilerWasmFileBytes=require(\"node:buffer\")")
      ? next.indexOf(code)
      : next.indexOf(code);
    if (idx < 0) continue;
    if (code.startsWith("{let queryCompilerWasmFileBytes=require(\"node:buffer\")")) {
      // base64 variant: find its end marker.
      const end = ',"base64");return new WebAssembly.Module(queryCompilerWasmFileBytes)}';
      const endIdx = next.indexOf(end, idx);
      if (endIdx < 0) throw new Error("[patch-prisma-compiler-wasm] malformed base64 loader body");
      next = next.slice(0, idx) + bindingLoaderCode + next.slice(endIdx + end.length);
    } else {
      next = next.replace(code, bindingLoaderCode);
    }
    break;
  }
  if (!next.includes(bindingLoaderCode)) {
    if (next.includes(fsLoaderCode)) {
      next = next.replace(fsLoaderCode, bindingLoaderCode);
    } else {
      throw new Error("[patch-prisma-compiler-wasm] no known loader code found in handler.mjs");
    }
  }
  next = (next.startsWith("\uFEFF") ? "\uFEFF" : "") + wasmImport + (next.startsWith("\uFEFF") ? next.slice(1) : next);
  await writeFile(handlerPath, next, "utf8");
  console.log(`[patch-prisma-compiler-wasm] getQueryCompilerWasmModule -> static import ${wasmModuleVar}`);
}