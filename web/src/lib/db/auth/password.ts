import { argon2id, argon2Verify } from "hash-wasm";
import { getPlatformSetting } from "../settings";

// FR-220: Argon2id, OWASP's current first-choice recommendation (over bcrypt),
// with parameters from the OWASP Password Storage Cheat Sheet's m=19MiB/t=2/p=1
// profile rather than the library's lighter defaults (m=4MiB/t=3/p=1).
// Uses hasW-wasm (pure WASM) instead of @node-rs/argon2 (native .node binary)
// so it runs on the Cloudflare Workers runtime. Encoded output format
// (`$argon2id$v=19$m=19456,t=2,p=1$...`) is byte-compatible with the previous
// implementation — existing hashes keep verifying.
const HASH_OPTIONS = {
  memorySize: 19456, // KiB (m=19456)
  iterations: 2, // t=2
  parallelism: 1, // p=1
  hashLength: 32,
  outputType: "encoded" as const,
};

const DEFAULT_MIN_PASSWORD_LENGTH = 12;

const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return argon2id({ ...HASH_OPTIONS, password, salt });
}

/** Also used for recovery-code hashing (mfa.ts) — same one-way-hash contract, no reason for a second scheme. */
export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return argon2Verify({ hash: passwordHash, password });
}

export class WeakPasswordError extends Error {
  constructor(minLength: number) {
    super(`Password must be at least ${minLength} characters.`);
    this.name = "WeakPasswordError";
  }
}

/**
 * FR-270/271 in practice, not just FR-220: the minimum length is a platform
 * setting (`security.min_password_length`), not a hardcoded constant, so it's
 * changeable without a code deploy — falls back to 12 if never configured.
 */
export async function assertPasswordStrength(password: string): Promise<void> {
  const minLength = (await getPlatformSetting<number>("security.min_password_length")) ?? DEFAULT_MIN_PASSWORD_LENGTH;
  if (password.length < minLength) throw new WeakPasswordError(minLength);
}