import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy 360-NFC-Valet admin subtree (plain-JS pages router, pre-existing
    // style, not governed by the core's strict TS lint rules).
    "src/pages/**",
    "valet/**",
  ]),
]);

export default eslintConfig;
