import { afterEach, describe, expect, it } from "vitest";
import {
  getOAuthAdapter,
  listOAuthAdapters,
  registerOAuthAdapter,
  unregisterOAuthAdapter,
} from "../auth/oauth-registry";
import type { OAuthAdapter } from "../auth/oauth-adapter";

// Pure registry logic — no DB involved, unlike almost everything else in
// this package's test suite. Uses a dummy adapter (not the real Microsoft
// adapter) so this file's assertions don't depend on oauth-microsoft-entra-id.ts
// at all, keeping the registry's own contract independently verified.

function dummyAdapter(id: string): OAuthAdapter {
  return {
    id,
    displayName: `Dummy ${id}`,
    configFields: [],
    isConfigured: async () => true,
    beginAuth: async () => ({ url: `https://example.com/authorize?adapter=${id}`, state: "s" }),
    completeAuth: async () => ({ provider: id, providerUserId: "sub", email: "x@example.com", emailVerified: true }),
  };
}

describe("oauth adapter registry", () => {
  afterEach(() => {
    unregisterOAuthAdapter("dummy-a");
    unregisterOAuthAdapter("dummy-b");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getOAuthAdapter("dummy-a")).toBeUndefined();
  });

  it("registers an adapter and makes it retrievable by id", () => {
    const adapter = dummyAdapter("dummy-a");
    registerOAuthAdapter(adapter);
    expect(getOAuthAdapter("dummy-a")).toBe(adapter);
  });

  it("lists every registered adapter", () => {
    registerOAuthAdapter(dummyAdapter("dummy-a"));
    registerOAuthAdapter(dummyAdapter("dummy-b"));
    const ids = listOAuthAdapters().map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["dummy-a", "dummy-b"]));
  });

  it("re-registering the same id overwrites rather than duplicating", () => {
    registerOAuthAdapter(dummyAdapter("dummy-a"));
    const replacement = dummyAdapter("dummy-a");
    registerOAuthAdapter(replacement);
    expect(getOAuthAdapter("dummy-a")).toBe(replacement);
    expect(listOAuthAdapters().filter((a) => a.id === "dummy-a")).toHaveLength(1);
  });

  it("unregistering removes the adapter", () => {
    registerOAuthAdapter(dummyAdapter("dummy-a"));
    unregisterOAuthAdapter("dummy-a");
    expect(getOAuthAdapter("dummy-a")).toBeUndefined();
  });
});
