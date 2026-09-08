import { describe, expect, it } from "vitest";
import { generateCardQr, guestCardUrl } from "../card-qr";

describe("guestCardUrl", () => {
  it("falls back to a relative segment when no guest base is configured", () => {
    expect(guestCardUrl("MQZ-001", undefined)).toBe("/t/MQZ-001");
  });

  it("builds an absolute URL against the guest app base", () => {
    expect(guestCardUrl("MQZ-001", "http://localhost:3001")).toBe("http://localhost:3001/t/MQZ-001");
  });

  it("URL-encodes the card uid", () => {
    expect(guestCardUrl("MQZ A/1", "http://localhost:3001")).toBe(
      "http://localhost:3001/t/MQZ%20A%2F1",
    );
  });
});

describe("generateCardQr", () => {
  it("resolves to a PNG data URL encoding the guest card URL", async () => {
    const uri = await generateCardQr("MQZ-007", "http://localhost:3001");
    expect(uri.startsWith("data:image/png;base64,")).toBe(true);
    const png = Buffer.from(uri.split(",")[1], "base64");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.length).toBeGreaterThan(1000);
  });
});