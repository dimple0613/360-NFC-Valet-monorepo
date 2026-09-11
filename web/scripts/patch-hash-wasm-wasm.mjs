/**
 * Makes hash-wasm's argon2/blake2b wasm loaders use statically-imported,
 * bundler-compiled `WebAssembly.Module` instances instead of compiling the
 * embedded base64 at runtime.
 *
 * hash-wasm ships its wasm as base64 embedded in JS and lazily compiles it on
 * first use:
 *   WebAssembly.compile(decodedBase64Bytes)
 * workerd disallows runtime wasm compilation ("Wasm code generation disallowed
 * by embedder") — exactly like Prisma's query compiler
 * (see scripts/patch-prisma-compiler-wasm.mjs). POST /login trips it in
 * argon2Verify() while checking the password.
 *
 * This script:
 *  1. extracts the two unique base64 payloads (argon2, blake2b) from the
 *     bundled handler and writes them as real .wasm files,
 *  2. injects static imports so wrangler/esbuild compiles them at build time,
 *  3. swaps each `WebAssembly.compile(bytes)` call for a resolver that returns
 *     the statically-imported module, falling back to the original compile
 *     only when the module name is unknown (never for argon2/blake2b).
 *
 * Idempotent. Run after opennextjs-cloudflare build.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = path.join(repoRoot, ".open-next/server-functions/default");
const handlerPath = path.join(serverRoot, "handler.mjs");

const RESOLVER = "__hashWasmModuleResolver";

const WASM_MODULES = {
  argon2: {
    importName: "argon2HashWasmModule",
    regex: /name:"argon2",data:"([A-Za-z0-9+/=]+)"/g,
  },
  blake2b: {
    importName: "blake2bHashWasmModule",
    regex: /name:"blake2b",data:"([A-Za-z0-9+/=]+)"/g,
  },
};

// Original loader bodies (verified in the bundle, two copies — hash path and
// verify path). Each is replaced with a resolver-first variant.
const loaderSwapPairs = [
  [
    'q.has(a2.name)){let b3=o(a2.data),c3=WebAssembly.compile(b3);q.set(a2.name,c3)}',
    'q.has(a2.name)){let b3=o(a2.data);let c3=__hashWasmModuleResolver(a2.name)??WebAssembly.compile(b3);q.set(a2.name,c3)}',
  ],
  [
    'g.has(e2.name)){let t3=p(e2.data),i3=WebAssembly.compile(t3);g.set(e2.name,i3)}',
    'g.has(e2.name)){let t3=p(e2.data);let i3=__hashWasmModuleResolver(e2.name)??WebAssembly.compile(t3);g.set(e2.name,i3)}',
  ],
];

let handler = await readFile(handlerPath, "utf8");
const bom = handler.startsWith("\uFEFF");
if (bom) handler = handler.slice(1);

if (handler.includes(RESOLVER)) {
  console.log("[patch-hash-wasm-wasm] handler already patched; skipping");
} else {
  const wasmDir = path.join(serverRoot, "node_modules/hash-wasm");
  await mkdir(wasmDir, { recursive: true });

  const sizes = {};
  for (const [name, cfg] of Object.entries(WASM_MODULES)) {
    const matches = [...handler.matchAll(cfg.regex)];
    if (matches.length === 0) throw new Error(`[patch-hash-wasm-wasm] no embedded "${name}" payload found`);
    const distinct = [...new Set(matches.map((m) => m[1]))];
    if (distinct.length !== 1) {
      throw new Error(`[patch-hash-wasm-wasm] expected one unique "${name}" payload, found ${distinct.length}`);
    }
    const bytes = Buffer.from(distinct[0], "base64");
    await writeFile(path.join(wasmDir, `${name}.wasm`), bytes);
    sizes[name] = bytes.length;
    console.log(`[patch-hash-wasm-wasm] wrote ${name}.wasm (${bytes.length} bytes)`);
  }

  const imports = Object.entries(WASM_MODULES)
    .map(([name, cfg]) => `import ${cfg.importName} from "./node_modules/hash-wasm/${name}.wasm";`)
    .join("\n");
  const resolver = `function ${RESOLVER}(name){${
    Object.entries(WASM_MODULES)
      .map(([name, cfg]) => `if(name==="${name}")return ${cfg.importName};`)
      .join("")
  }return undefined;}`;

  handler = `${imports}\n${resolver}\n${handler}`;

  let swapped = 0;
  for (const [from, to] of loaderSwapPairs) {
    if (!handler.includes(from)) {
      console.warn(`[patch-hash-wasm-wasm] loader body not found: ${from.slice(0, 60)}…`);
      continue;
    }
    handler = handler.split(from).join(to);
    swapped += 1;
  }
  if (swapped === 0 && (handler.match(/WebAssembly\.compile\(/g)?.length ?? 0) > 0) {
    throw new Error("[patch-hash-wasm-wasm] no agent loader bodies matched — bundle changed, update pairs");
  }

  if (bom) handler = "\uFEFF" + handler;
  await writeFile(handlerPath, handler, "utf8");
  console.log(`[patch-hash-wasm-wasm] swapped ${swapped} loader body copies; resolver ${RESOLVER} prepended`);
}