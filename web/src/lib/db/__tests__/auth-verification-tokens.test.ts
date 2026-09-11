import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { consumeVerificationToken, createVerificationToken, InvalidOrExpiredTokenError } from "../auth/verification-tokens";

const runId = Date.now().toString(36);

describe("verification tokens", () => {
  let user: { id: string };

  beforeAll(async () => {
    user = await prismaWithoutTenantScoping.user.create({
      data: { email: `verification-token-${runId}@example.com` },
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.verificationToken.deleteMany({ where: { userId: user.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: user.id } });
  });

  it("a freshly created token can be consumed exactly once", async () => {
    const token = await createVerificationToken({ userId: user.id, purpose: "test_purpose", expiresInMs: 60_000 });
    const result = await consumeVerificationToken({ rawToken: token, purpose: "test_purpose" });
    expect(result.userId).toBe(user.id);

    await expect(consumeVerificationToken({ rawToken: token, purpose: "test_purpose" })).rejects.toThrow(
      InvalidOrExpiredTokenError,
    );
  });

  it("rejects an expired token", async () => {
    const token = await createVerificationToken({ userId: user.id, purpose: "test_purpose", expiresInMs: -1 });
    await expect(consumeVerificationToken({ rawToken: token, purpose: "test_purpose" })).rejects.toThrow(
      InvalidOrExpiredTokenError,
    );
  });

  it("rejects consumption under the wrong purpose", async () => {
    const token = await createVerificationToken({ userId: user.id, purpose: "purpose_a", expiresInMs: 60_000 });
    await expect(consumeVerificationToken({ rawToken: token, purpose: "purpose_b" })).rejects.toThrow(
      InvalidOrExpiredTokenError,
    );
  });

  it("rejects a garbage token", async () => {
    await expect(
      consumeVerificationToken({ rawToken: "not-a-real-token", purpose: "test_purpose" }),
    ).rejects.toThrow(InvalidOrExpiredTokenError);
  });
});
