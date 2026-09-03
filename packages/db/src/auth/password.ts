import { hash, verify } from "@node-rs/argon2";
import { getPlatformSetting } from "../settings";

// FR-220: Argon2id, OWASP's current first-choice recommendation (over bcrypt),
// with parameters from the OWASP Password Storage Cheat Sheet's m=19MiB/t=2/p=1
// profile rather than the library's lighter defaults (m=4MiB/t=3/p=1).
// `algorithm: 2` is Argon2id — @node-rs/argon2's Algorithm is an ambient
// `const enum`, which `isolatedModules` (this repo's tsconfig) can't import
// across module boundaries, so the numeric value is used directly.
const HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const DEFAULT_MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

/** Also used for recovery-code hashing (mfa.ts) — same one-way-hash contract, no reason for a second scheme. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
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
