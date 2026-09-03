import { createHash, randomBytes } from "node:crypto";
import { prismaWithoutTenantScoping } from "../client";

// Shared shape behind both email verification and password reset (FR-220):
// generate a random token, store only its hash, email the raw token
// (placeholder — see email-sender.ts), consume it exactly once. Only the hash
// is ever persisted, so a DB leak alone can't let someone claim a still-valid
// link.

const TOKEN_BYTES = 32;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export class InvalidOrExpiredTokenError extends Error {
  constructor(purpose: string) {
    super(`This ${purpose.replace(/_/g, " ")} link is invalid or has expired.`);
    this.name = "InvalidOrExpiredTokenError";
  }
}

export async function createVerificationToken(params: {
  userId: string;
  purpose: string;
  expiresInMs: number;
}): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  await prismaWithoutTenantScoping.verificationToken.create({
    data: {
      userId: params.userId,
      purpose: params.purpose,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + params.expiresInMs),
    },
  });
  return rawToken;
}

/** Verifies and consumes a token in one step (marks it used); throws if invalid, expired, or already used. */
export async function consumeVerificationToken(params: { rawToken: string; purpose: string }): Promise<{
  userId: string;
}> {
  const tokenHash = hashToken(params.rawToken);
  const record = await prismaWithoutTenantScoping.verificationToken.findUnique({ where: { tokenHash } });
  if (
    !record ||
    record.purpose !== params.purpose ||
    record.usedAt !== null ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw new InvalidOrExpiredTokenError(params.purpose);
  }
  await prismaWithoutTenantScoping.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return { userId: record.userId };
}
