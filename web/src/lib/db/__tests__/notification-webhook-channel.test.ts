import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  setNotificationChannelConfigValue,
  setNotificationChannelEnabled,
} from "../notifications/channel-config";
import { webhookNotificationChannel, WEBHOOK_SIGNATURE_HEADER } from "../notifications/webhook-channel";

// Real end-to-end round trip, no mocks: a genuine local HTTP listener
// receives a genuine POST from the channel's own `send()` (global fetch, no
// injected client) — proving the full send path works for real, per the
// brief's explicit instruction for the webhook channel specifically (it
// needs no external account, unlike email/Slack/SMS).

const runId = Date.now().toString(36);
const CHANNEL_ID = "webhook";
const SECRET = `test-webhook-secret-${runId}`;

let server: Server;
let baseUrl: string;
let received: { body: string; headers: Record<string, string | string[] | undefined>; method?: string }[] = [];
let nextStatus = 200;

async function cleanupConfig() {
  await prismaWithoutTenantScoping.platformSetting.deleteMany({
    where: { key: { startsWith: `notification_channel.${CHANNEL_ID}.` } },
  });
}

describe("webhook notification channel", () => {
  beforeAll(async () => {
    await cleanupConfig();
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        received.push({ body: raw, headers: req.headers, method: req.method });
        res.writeHead(nextStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address && typeof address === "object") {
      baseUrl = `http://127.0.0.1:${address.port}/hook`;
    }
  });

  afterEach(() => {
    received = [];
    nextStatus = 200;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupConfig();
  });

  it("declares url + secret as required config fields", () => {
    const keys = webhookNotificationChannel.configFields.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["url", "secret"]));
    expect(webhookNotificationChannel.configFields.every((f) => f.required)).toBe(true);
  });

  it("is not configured with no config set", async () => {
    await expect(webhookNotificationChannel.isConfigured()).resolves.toBe(false);
  });

  it("send() skips (does not throw, does not POST) when not configured", async () => {
    const result = await webhookNotificationChannel.send({ kind: "test.kind", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(received).toHaveLength(0);
  });

  it("POSTs a real signed JSON payload to the configured URL once enabled+configured, and reports ok:true on a 200", async () => {
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "url", value: baseUrl, sensitive: false });
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "secret", value: SECRET, sensitive: true });
    await setNotificationChannelEnabled(CHANNEL_ID, true);
    await expect(webhookNotificationChannel.isConfigured()).resolves.toBe(true);

    const message = {
      kind: "org.invite_sent",
      organizationId: "org_123",
      userId: "user_456",
      subject: "You've been invited",
      body: "Join now",
      metadata: { inviteId: "inv_789" },
    };
    const result = await webhookNotificationChannel.send(message);
    expect(result).toEqual({ ok: true });

    expect(received).toHaveLength(1);
    const delivery = received[0]!;
    expect(delivery.method).toBe("POST");
    expect(delivery.headers["content-type"]).toContain("application/json");

    const payload = JSON.parse(delivery.body);
    expect(payload.kind).toBe("org.invite_sent");
    expect(payload.organizationId).toBe("org_123");
    expect(payload.subject).toBe("You've been invited");
    expect(payload.metadata).toEqual({ inviteId: "inv_789" });

    // Verifiable: recompute the HMAC-SHA256 signature independently, exactly
    // as a real webhook consumer would, and confirm it matches the header.
    const expectedSignature = `sha256=${createHmac("sha256", SECRET).update(delivery.body).digest("hex")}`;
    const signatureHeader = delivery.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()];
    expect(signatureHeader).toBe(expectedSignature);
  });

  it("reports ok:false with a real error, not a throw, when the target responds with a non-2xx status", async () => {
    nextStatus = 500;
    const result = await webhookNotificationChannel.send({ kind: "test.kind", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("reports ok:false with a real error, not a throw, when the target is unreachable", async () => {
    await setNotificationChannelConfigValue({ channelId: CHANNEL_ID, field: "url", value: "http://127.0.0.1:1", sensitive: false });
    const result = await webhookNotificationChannel.send({ kind: "test.kind", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
