import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// General-purpose encryption-at-rest primitive. AES-256-GCM with a per-value
// random IV; output is base64(iv || authTag || ciphertext), a single opaque
// string that fits in a plain text column. Used for settings marked
// isSensitive (FR-271) and for auth secrets — MFA TOTP secrets, recovery
// codes (FR-222) — that must never sit in the DB as plaintext.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "ENCRYPTION_KEY is not set. It must be a base64-encoded 32-byte key " +
        "(e.g. `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`).",
    );
    this.name = "MissingEncryptionKeyError";
  }
}

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new MissingEncryptionKeyError();
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key).");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
