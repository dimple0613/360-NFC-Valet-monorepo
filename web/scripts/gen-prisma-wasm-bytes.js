const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "src", "lib", "db", "generated", "client");
const wasmPath = path.join(dir, "query_engine_bg.wasm");
const wasmJsPath = path.join(dir, "wasm.js");
const bytesPath = path.join(dir, "wasm-bytes.mjs");

const b64 = fs.readFileSync(wasmPath).toString("base64");

// Self-contained base64 decoder (no atob/Buffer dependency at load wiring).
const mod = `/* Generated helper: embeds query_engine_bg.wasm as decoded bytes so the
   Workers bundle never depends on the bundler's WASM handling. Regenerate
   with scripts/gen-prisma-wasm-bytes.js after \`prisma generate\`. */
const B64 = ${JSON.stringify(b64)};
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

function decode(s) {
  let out = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 61) break; // '='
    buffer = (buffer << 6) | LOOKUP[c];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export const wasmBytes = decode(B64);
`;
fs.writeFileSync(bytesPath, mod, "utf8");
const wasmJs = fs.readFileSync(wasmJsPath, "utf8");

const target = `config.engineWasm = {
  getRuntime: async () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const loader = (await import('#wasm-engine-loader')).default
    const engine = (await loader).default
    return engine
  }
}`;

const replacement = `config.engineWasm = {
  getRuntime: async () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const { wasmBytes } = await import('./wasm-bytes.mjs')
    return WebAssembly.compile(wasmBytes)
  }
}`;

if (!wasmJs.includes(target)) {
  if (!wasmJs.includes("wasm-bytes.mjs")) {
    console.error("PATCH TARGET NOT FOUND — wasm.js changed shape; manual check required.");
    process.exit(1);
  }
  console.log("wasm.js already patched.");
} else {
  const patched = wasmJs.replace(target, replacement);
  fs.writeFileSync(wasmJsPath, patched, "utf8");
  console.log("Patched wasm.js to use wasm-bytes.mjs + WebAssembly.compile.");
}
const check = fs.readFileSync(wasmJsPath, "utf8");
console.log("verify:", check.includes("wasm-bytes.mjs") ? "OK" : "MISSING");
console.log("bytes module:", fs.statSync(bytesPath).size, "bytes");