// Thin PayPal REST client (OAuth2 client-credentials token + a generic
// `request` helper) — deliberately not a full SDK. No PayPal SDK dependency
// exists in this package (checked packages/db/package.json/web/package.json
// before writing this), and PayPal's REST API is plain HTTP/JSON, so `fetch`
// (global since Node 18, this repo targets Node >=20 per root package.json)
// is enough — matches CLAUDE.md's "only add a dependency if genuinely
// necessary". `fetchImpl` is injectable purely for tests (mirrors
// stripe-provider.ts's `options.client` injection) so paypal-provider.ts's
// suite never makes a real network call.

export interface PayPalRuntimeConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  environment: "sandbox" | "live";
}

export interface PayPalClientOptions {
  fetchImpl?: typeof fetch;
}

export class PayPalApiError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    body: string,
  ) {
    super(`PayPal API request to ${path} failed (${status}): ${body}`);
    this.name = "PayPalApiError";
  }
}

export function paypalApiBaseUrl(environment: "sandbox" | "live"): string {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export interface PayPalClient {
  readonly baseUrl: string;
  getAccessToken(): Promise<string>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

/**
 * One client per call in this codebase (paypal-provider.ts builds a fresh
 * one from the current Settings-resolved config on every adapter method
 * call, same "no long-lived cached credentials" posture
 * oauth-microsoft-entra-id.ts's loadConfig()/createClient() takes) — the
 * short-lived in-memory token cache below only helps within a single
 * request's lifetime (createCheckoutSession makes 3 PayPal calls: product,
 * plan, subscription), not across requests.
 */
export function createPayPalClient(config: PayPalRuntimeConfig, options: PayPalClientOptions = {}): PayPalClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = paypalApiBaseUrl(config.environment);
  let cachedToken: { token: string; expiresAt: number } | null = null;

  async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const res = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new PayPalApiError("/v1/oauth2/token", res.status, await res.text().catch(() => ""));

    const data = (await res.json()) as { access_token: string; expires_in: number };
    // 60s safety margin so a token never expires mid-request.
    cachedToken = { token: data.access_token, expiresAt: Date.now() + Math.max(data.expires_in - 60, 0) * 1000 };
    return cachedToken.token;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new PayPalApiError(path, res.status, await res.text().catch(() => ""));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return { baseUrl, getAccessToken, request };
}
