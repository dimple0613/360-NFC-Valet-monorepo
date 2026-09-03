import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../client";

describe("createClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends the Authorization: Bearer header and hits baseUrl + path", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      return new Response(JSON.stringify({ id: "org_1", name: "Real Org", slug: "real-org", status: "ACTIVE", createdAt: "2026-01-01" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createClient({ baseUrl: "https://example.test/api/v1", apiKey: "sk_test_123" });
    const { data, error, response } = await client.GET("/organization", {});

    expect(response.status).toBe(200);
    expect(error).toBeUndefined();
    expect(data?.name).toBe("Real Org");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledRequest = fetchMock.mock.calls[0]![0] as Request;
    expect(calledRequest.url).toBe("https://example.test/api/v1/organization");
    expect(calledRequest.headers.get("authorization")).toBe("Bearer sk_test_123");
  });

  it("surfaces a non-2xx response as `error`, not a thrown exception", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "Missing required scope: core.roles.manage" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

    const client = createClient({ baseUrl: "https://example.test/api/v1", apiKey: "sk_test_123" });
    const { data, error, response } = await client.GET("/roles", {});

    expect(response.status).toBe(403);
    expect(data).toBeUndefined();
    expect(error).toBeDefined();
  });

  it("PUT /settings/{key} sends the path param and JSON body correctly", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      new Response(JSON.stringify({ category: "ui", key: "theme", value: "dark", isSensitive: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createClient({ baseUrl: "https://example.test/api/v1", apiKey: "sk_test_123" });
    await client.PUT("/settings/{key}", {
      params: { path: { key: "theme" } },
      body: { category: "ui", value: "dark" },
    });

    const calledRequest = fetchMock.mock.calls[0]![0] as Request;
    expect(calledRequest.url).toBe("https://example.test/api/v1/settings/theme");
    expect(calledRequest.method).toBe("PUT");
    const body = await calledRequest.clone().json();
    expect(body).toEqual({ category: "ui", value: "dark" });
  });

  it("GET /sessions?userId= builds the query string and types the response for real (not `never`)", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      new Response(
        JSON.stringify({ sessions: [{ id: "sess_1", userId: "user_1", ipAddress: null, userAgent: null, createdAt: "2026-01-01T00:00:00Z", lastUsedAt: "2026-01-01T00:00:00Z", expiresAt: "2026-02-01T00:00:00Z" }], nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createClient({ baseUrl: "https://example.test/api/v1", apiKey: "sk_test_123" });
    const { data } = await client.GET("/sessions", { params: { query: { userId: "user_1" } } });

    // This only compiles because the generated schema now carries a real
    // `SessionInfo` response shape — before this round's openapi.yaml
    // additions, an unlisted path here would be a type error, and a
    // prose-only response (round 1's original bug class) would type this
    // field as `never`.
    expect(data?.sessions[0]?.id).toBe("sess_1");

    const calledRequest = fetchMock.mock.calls[0]![0] as Request;
    expect(calledRequest.url).toBe("https://example.test/api/v1/sessions?userId=user_1");
  });

  it("GET /billing/usage and GET /features type their real response shapes (not `never`)", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = (input as Request).url;
      if (url.endsWith("/billing/usage")) {
        return new Response(
          JSON.stringify({ usage: [{ resourceTypeKey: "core.seats", unit: "seats", used: 1, limit: 5, overagePolicy: "BLOCK" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ enabled: ["some.feature"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;

    const client = createClient({ baseUrl: "https://example.test/api/v1", apiKey: "sk_test_123" });

    const usage = await client.GET("/billing/usage", {});
    expect(usage.data?.usage[0]?.resourceTypeKey).toBe("core.seats");

    const features = await client.GET("/features", {});
    expect(features.data?.enabled).toContain("some.feature");
  });

  it("GET /audit-logs types the real AuditLogEntry response shape (not `never`)", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ auditLogs: [{ id: "log_1", actorUserId: null, module: "core", action: "org.invite_sent", resourceType: null, resourceId: null, createdAt: "2026-01-01T00:00:00Z" }], nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const client = createClient({ baseUrl: "https://example.test/api/v1", apiKey: "sk_test_123" });
    const { data } = await client.GET("/audit-logs", {});
    expect(data?.auditLogs[0]?.action).toBe("org.invite_sent");
  });
});
