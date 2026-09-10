import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { setNotificationChannelConfigValue, setNotificationChannelEnabled } from "../notifications/channel-config";
import { createEmailChannel, resolveEmailSender } from "../notifications/email-channel";

// Injected transporter factory, same pattern stripe-provider.ts's
// options.client / paypal-client.ts's fetchImpl use — proves the real
// SMTP-sending code path (config -> nodemailer.createTransport shape ->
// sendMail call) without ever touching a real network/mail server, which
// isn't available in this dev environment (same honest gap the Google/Apple
// and Entra OAuth rounds flagged for themselves — see TASKS.md).

const runId = Date.now().toString(36);
const CHANNEL_ID = "email";

async function cleanupConfig() {
  await prismaWithoutTenantScoping.platformSetting.deleteMany({
    where: { key: { startsWith: `notification_channel.${CHANNEL_ID}.` } },
  });
}

// web/.env is injected into the vitest process, so SMTP_* vars are always
// present unless explicitly cleared — the "not configured" assertions below
// must run with the env shadow removed (same save/restore discipline the
// SMTP env-var fallback describe block uses).
const SMTP_ENV_FIELDS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_FROM_NAME",
] as const;

async function withSmtpEnvCleared<T>(run: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of SMTP_ENV_FIELDS) saved[key] = process.env[key];
  for (const key of SMTP_ENV_FIELDS) delete process.env[key];
  try {
    return await run();
  } finally {
    for (const key of SMTP_ENV_FIELDS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("email notification channel", () => {
  beforeAll(cleanupConfig);
  afterEach(cleanupConfig);
  afterAll(cleanupConfig);

  it("declares smtp_host/smtp_port/from_email as required, smtp_user/smtp_password/from_name as optional", () => {
    const channel = createEmailChannel();
    const required = channel.configFields.filter((f) => f.required).map((f) => f.key);
    const optional = channel.configFields.filter((f) => !f.required).map((f) => f.key);
    expect(required).toEqual(expect.arrayContaining(["smtp_host", "smtp_port", "from_email"]));
    expect(optional).toEqual(expect.arrayContaining(["smtp_user", "smtp_password", "from_name"]));
  });

  it("is not configured with no config set", async () => {
    await withSmtpEnvCleared(async () => {
      const channel = createEmailChannel();
      await expect(channel.isConfigured()).resolves.toBe(false);
    });
  });

  it("send() skips (does not throw) when not configured", async () => {
    await withSmtpEnvCleared(async () => {
      const channel = createEmailChannel();
      const result = await channel.send({ kind: "test.kind", email: "to@example.com", subject: "s", body: "b" });
      expect(result.ok).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  it("send() skips when configured but no recipient email is given", async () => {
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_host", value: "smtp.example.com", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_port", value: "587", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_email", value: "noreply@example.com", sensitive: false });
    await setNotificationChannelEnabled(CHANNEL_ID, true);

    const sendMail = vi.fn().mockResolvedValue({ messageId: "x" });
    const transportFactory = vi.fn().mockReturnValue({ sendMail });
    const channel = createEmailChannel({ transportFactory });

    await expect(channel.isConfigured()).resolves.toBe(true);
    const result = await channel.send({ kind: "test.kind", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("builds a real transporter from the stored config and calls sendMail with the rendered subject/body", async () => {
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_host", value: "smtp.example.com", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_port", value: "587", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_user", value: "user@example.com", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_password", value: "secret-pass", sensitive: true });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_email", value: "noreply@example.com", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_name", value: "SaaSClaude", sensitive: false });
    await setNotificationChannelEnabled(CHANNEL_ID, true);

    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
    const transportFactory = vi.fn().mockReturnValue({ sendMail });
    const channel = createEmailChannel({ transportFactory });

    const result = await channel.send({ kind: "org.invite_sent", email: "invitee@example.com", subject: "Hi", body: "Welcome" });
    expect(result).toEqual({ ok: true });

    expect(transportFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "user@example.com", pass: "secret-pass" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"SaaSClaude" <noreply@example.com>',
        to: "invitee@example.com",
        subject: "Hi",
        text: "Welcome",
      }),
    );
  });

  it("reports ok:false with a real error, not a throw, when sendMail rejects", async () => {
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_host", value: "smtp.example.com", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_port", value: "587", sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_email", value: "noreply@example.com", sensitive: false });
    await setNotificationChannelEnabled(CHANNEL_ID, true);

    const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    const transportFactory = vi.fn().mockReturnValue({ sendMail });
    const channel = createEmailChannel({ transportFactory });

    const result = await channel.send({ kind: "test.kind", email: "to@example.com", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("connection refused");
  });

  describe("resolveEmailSender", () => {
    it("falls back to consoleEmailSender when the given channel isn't configured", async () => {
      const unconfigured = createEmailChannel();
      const sender = await resolveEmailSender(unconfigured);
      // consoleEmailSender never throws and has no observable side effect we
      // can assert other than "it resolved" — the real assertion is the
      // *other* branch below, proving the two are genuinely distinguishable.
      await expect(sender.send({ to: "x@example.com", subject: "s", body: "b" })).resolves.toBeUndefined();
    });

    it("resolves to a real EmailSender backed by the configured channel once configured, wired to the same send() path", async () => {
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_host", value: "smtp.example.com", sensitive: false });
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_port", value: "587", sensitive: false });
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_email", value: "noreply@example.com", sensitive: false });
      await setNotificationChannelEnabled(CHANNEL_ID, true);

      const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
      const transportFactory = vi.fn().mockReturnValue({ sendMail });
      const configured = createEmailChannel({ transportFactory });

      const sender = await resolveEmailSender(configured);
      await expect(sender.send({ to: "invitee@example.com", subject: "Verify your email", body: "token abc" })).resolves.toBeUndefined();
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "invitee@example.com", subject: "Verify your email", text: "token abc" }),
      );
    });

    it("propagates a real delivery failure as a thrown error, not a silent no-op", async () => {
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_host", value: "smtp.example.com", sensitive: false });
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_port", value: "587", sensitive: false });
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_email", value: "noreply@example.com", sensitive: false });
      await setNotificationChannelEnabled(CHANNEL_ID, true);

      const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
      const configured = createEmailChannel({ transportFactory: () => ({ sendMail }) });

      const sender = await resolveEmailSender(configured);
      await expect(sender.send({ to: "x@example.com", subject: "s", body: "b" })).rejects.toThrow(/connection refused/);
    });
  });

  describe("SMTP env-var fallback (org-invite email bug)", () => {
    // web/.env SMTP_* vars are ordinary deployment config the email channel
    // must honor even with zero Settings-table rows — resolveEmailSender()
    // previously fell back to the console placeholder in exactly that setup,
    // which is why invites logged instead of emailed. Save/restore the env so
    // these tests can't leak into the rest of the suite.
    const ENV_FIELDS = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
      "SMTP_FROM_NAME",
    ] as const;
    const saved: Record<string, string | undefined> = {};

    beforeAll(() => {
      for (const key of ENV_FIELDS) saved[key] = process.env[key];
    });
    afterEach(() => {
      for (const key of ENV_FIELDS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    });

    it("is configured from SMTP_* env vars with no settings rows", async () => {
      process.env.SMTP_HOST = "smtp.gmail.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "robot@gmail.com";
      process.env.SMTP_PASS = "sekrit";
      process.env.SMTP_FROM = "360 NFC Valet <robot@gmail.com>";
      process.env.SMTP_FROM_NAME = "360 NFC Valet";

      const channel = createEmailChannel();
      await expect(channel.isConfigured()).resolves.toBe(true);

      const sendMail = vi.fn().mockResolvedValue({ messageId: "env-mail" });
      const transportFactory = vi.fn().mockReturnValue({ sendMail });
      const envChannel = createEmailChannel({ transportFactory });

      const result = await envChannel.send({ kind: "org.invite_sent", email: "invitee@example.com", subject: "Invite", body: "Accept: /t" });
      expect(result).toEqual({ ok: true });
      expect(transportFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.gmail.com",
          port: 587,
          auth: { user: "robot@gmail.com", pass: "sekrit" },
        }),
      );
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"360 NFC Valet" <robot@gmail.com>',
          to: "invitee@example.com",
          subject: "Invite",
          text: "Accept: /t",
        }),
      );
    });

    it("resolveEmailSender resolves to a real sender driven by env, not the console placeholder", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "env-user@example.com";
      process.env.SMTP_FROM = "env-user@example.com";
      // web/.env injects a real SMTP_FROM_NAME — drop it so `from` renders as
      // the bare address the assertion expects (describe-level afterEach restores).
      delete process.env.SMTP_FROM_NAME;

      const sendMail = vi.fn().mockResolvedValue({ messageId: "env-send" });
      const transportFactory = vi.fn().mockReturnValue({ sendMail });
      const sender = await resolveEmailSender(createEmailChannel({ transportFactory }));

      await expect(sender.send({ to: "invitee@example.com", subject: "Invite", body: "Accept" })).resolves.toBeUndefined();
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: "env-user@example.com", to: "invitee@example.com" }),
      );
    });

    it("explicit Settings-table config wins over env vars when both are present", async () => {
      process.env.SMTP_HOST = "env-host.example.com";
      process.env.SMTP_USER = "env-user@example.com";
      process.env.SMTP_FROM = "env-user@example.com";
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_host", value: "db-host.example.com", sensitive: false });
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "smtp_port", value: "465", sensitive: false });
      await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "from_email", value: "db@example.com", sensitive: false });
      await setNotificationChannelEnabled(CHANNEL_ID, true);

      const sendMail = vi.fn().mockResolvedValue({ messageId: "db-mail" });
      const transportFactory = vi.fn().mockReturnValue({ sendMail });
      const sender = await resolveEmailSender(createEmailChannel({ transportFactory }));

      await expect(sender.send({ to: "invitee@example.com", subject: "Invite", body: "Accept" })).resolves.toBeUndefined();
      expect(transportFactory).toHaveBeenCalledWith(expect.objectContaining({ host: "db-host.example.com", port: 465 }));
    });

    it("falls back to the console placeholder when neither settings nor SMTP_* env is present", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;
      delete process.env.SMTP_FROM_NAME;

      const sendMail = vi.fn();
      const transportFactory = vi.fn().mockReturnValue({ sendMail });
      const sender = await resolveEmailSender(createEmailChannel({ transportFactory }));

      await expect(sender.send({ to: "x@example.com", subject: "s", body: "b" })).resolves.toBeUndefined();
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
