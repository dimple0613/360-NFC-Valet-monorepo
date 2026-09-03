import { describe, expect, it } from "vitest";
import { extractBearerToken } from "../resolve-tenant";

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Authorization header", () => {
    const headers = new Headers({ Authorization: "Bearer sk_abc123" });
    expect(extractBearerToken(headers)).toBe("sk_abc123");
  });

  it("is case-insensitive to the Bearer scheme", () => {
    const headers = new Headers({ Authorization: "bearer sk_abc123" });
    expect(extractBearerToken(headers)).toBe("sk_abc123");
  });

  it("returns null when the header is absent", () => {
    expect(extractBearerToken(new Headers())).toBeNull();
  });

  it("returns null when the header doesn't use the Bearer scheme", () => {
    const headers = new Headers({ Authorization: "Basic dXNlcjpwYXNz" });
    expect(extractBearerToken(headers)).toBeNull();
  });

  it("returns null for a bare 'Bearer' with no token", () => {
    const headers = new Headers({ Authorization: "Bearer" });
    expect(extractBearerToken(headers)).toBeNull();
  });
});
