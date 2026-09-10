import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { assertPasswordStrength, hashPassword, verifyPassword, WeakPasswordError } from "../auth/password";
import { setPlatformSetting } from "../settings";

describe("password hashing", () => {
  it("hash/verify round-trips and rejects the wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword(hash, "correct-horse-battery-staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("assertPasswordStrength", () => {
  const settingKey = `security.min_password_length`;

  afterAll(async () => {
    await prismaWithoutTenantScoping.platformSetting.deleteMany({ where: { key: settingKey } });
  });

  it("rejects a password shorter than the default minimum (12)", async () => {
    await expect(assertPasswordStrength("short1")).rejects.toThrow(WeakPasswordError);
  });

  it("accepts a password at/above the default minimum", async () => {
    await expect(assertPasswordStrength("twelve-chars")).resolves.toBeUndefined();
  });

  it("honors a configured minimum length platform setting", async () => {
    await setPlatformSetting({ category: "security", key: settingKey, value: 20 });
    await expect(assertPasswordStrength("fifteen-chars-x")).rejects.toThrow(WeakPasswordError);
    await expect(assertPasswordStrength("this-is-twenty-chars")).resolves.toBeUndefined();
  });
});
