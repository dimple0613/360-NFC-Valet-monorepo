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
    const channel = createEmailChannel();
    await expect(channel.isConfigured()).resolves.toBe(false);
  });

  it("send() skips (does not throw) when not configured", async () => {
    const channel = createEmailChannel();
    const result = await channel.send({ kind: "test.kind", email: "to@example.com", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
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
});
