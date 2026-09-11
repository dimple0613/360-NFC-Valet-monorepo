import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  getOrganizationSetting,
  getPlatformSetting,
  getUserSetting,
  listOrganizationSettings,
  listPlatformSettings,
  listUserSettings,
  resolveSetting,
  setOrganizationSetting,
  setPlatformSetting,
  setUserSetting,
} from "../settings";
import { decrypt, encrypt } from "../encryption";

const runId = Date.now().toString(36);
const key = `test.setting.${runId}`;

describe("settings service", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let user: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Settings Org A", slug: `settings-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Settings Org B", slug: `settings-org-b-${runId}` },
    });
    user = await prismaWithoutTenantScoping.user.create({
      data: { email: `settings-user-${runId}@example.com` },
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.userSetting.deleteMany({ where: { userId: user.id } });
    await prismaWithoutTenantScoping.organizationSetting.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.platformSetting.deleteMany({ where: { key } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: user.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  it("encryption round-trips and produces different ciphertext each time (random IV)", () => {
    const a = encrypt("secret-value");
    const b = encrypt("secret-value");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("secret-value");
    expect(decrypt(b)).toBe("secret-value");
  });

  it("platform get/set round-trips a JSON value", async () => {
    await setPlatformSetting({ category: "general", key, value: { theme: "dark" } });
    await expect(getPlatformSetting(key)).resolves.toEqual({ theme: "dark" });
  });

  it("organization settings are isolated per org", async () => {
    await setOrganizationSetting(orgA.id, { category: "branding", key, value: "org-a-value" });
    await setOrganizationSetting(orgB.id, { category: "branding", key, value: "org-b-value" });

    await expect(getOrganizationSetting(orgA.id, key)).resolves.toBe("org-a-value");
    await expect(getOrganizationSetting(orgB.id, key)).resolves.toBe("org-b-value");
  });

  it("setOrganizationSetting upserts in place rather than duplicating rows", async () => {
    await setOrganizationSetting(orgA.id, { category: "branding", key, value: "updated-value" });
    const rows = await prismaWithoutTenantScoping.organizationSetting.findMany({
      where: { organizationId: orgA.id, key },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(JSON.stringify("updated-value"));
  });

  it("user settings round-trip and are keyed per user", async () => {
    await setUserSetting(user.id, { category: "appearance", key, value: "user-value" });
    await expect(getUserSetting(user.id, key)).resolves.toBe("user-value");
  });

  it("sensitive values are stored encrypted (not plaintext) but still round-trip through the getter", async () => {
    await setOrganizationSetting(orgA.id, {
      category: "integrations",
      key: `${key}.secret`,
      value: "super-secret-api-key",
      isSensitive: true,
    });

    const row = await prismaWithoutTenantScoping.organizationSetting.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: orgA.id, key: `${key}.secret` } },
    });
    expect(row.value).not.toContain("super-secret-api-key");
    expect(row.isSensitive).toBe(true);

    await expect(getOrganizationSetting(orgA.id, `${key}.secret`)).resolves.toBe("super-secret-api-key");
  });

  it("listing settings redacts sensitive values instead of decrypting them", async () => {
    const summaries = await listOrganizationSettings(orgA.id);
    const secretSummary = summaries.find((s) => s.key === `${key}.secret`);
    expect(secretSummary?.value).toBe("[REDACTED]");
  });

  it("resolveSetting prefers user, then organization, then platform", async () => {
    const resolveKey = `resolve.${key}`;

    await setPlatformSetting({ category: "general", key: resolveKey, value: "platform-default" });
    await expect(
      resolveSetting({ key: resolveKey, organizationId: orgA.id, userId: user.id }),
    ).resolves.toEqual({ value: "platform-default", source: "platform" });

    await setOrganizationSetting(orgA.id, { category: "general", key: resolveKey, value: "org-override" });
    await expect(
      resolveSetting({ key: resolveKey, organizationId: orgA.id, userId: user.id }),
    ).resolves.toEqual({ value: "org-override", source: "organization" });

    // A different org still only sees the platform default.
    await expect(
      resolveSetting({ key: resolveKey, organizationId: orgB.id }),
    ).resolves.toEqual({ value: "platform-default", source: "platform" });

    await setUserSetting(user.id, { category: "general", key: resolveKey, value: "user-override" });
    await expect(
      resolveSetting({ key: resolveKey, organizationId: orgA.id, userId: user.id }),
    ).resolves.toEqual({ value: "user-override", source: "user" });

    await prismaWithoutTenantScoping.platformSetting.deleteMany({ where: { key: resolveKey } });
    await prismaWithoutTenantScoping.organizationSetting.deleteMany({ where: { key: resolveKey } });
    await prismaWithoutTenantScoping.userSetting.deleteMany({ where: { key: resolveKey } });
  });

  it("resolveSetting returns undefined when nothing is set at any scope", async () => {
    await expect(resolveSetting({ key: `nothing.${key}` })).resolves.toBeUndefined();
  });

  it("listPlatformSettings and listUserSettings expose the same category/key shape", async () => {
    const platformSummaries = await listPlatformSettings();
    expect(platformSummaries.some((s) => s.key === key)).toBe(true);

    const userSummaries = await listUserSettings(user.id);
    expect(userSummaries.some((s) => s.key === key)).toBe(true);
  });
});
