import createOpenApiClient from "openapi-fetch";
import type { paths } from "./schema";

export interface CreateClientOptions {
  /** e.g. "https://your-deployment.example.com/api/v1" or "/api/v1" for same-origin. */
  baseUrl: string;
  /** The raw API key (sk_...) — sent as `Authorization: Bearer <apiKey>` on every request. */
  apiKey: string;
}

/**
 * Thin wrapper around openapi-fetch, typed against the generated schema
 * (regenerate via `pnpm run generate` after editing web/openapi.yaml). Every
 * method is path/method/response typed — see openapi-fetch's own docs for
 * the client shape (`client.GET("/roles", ...)`, etc.).
 */
export function createClient({ baseUrl, apiKey }: CreateClientOptions) {
  return createOpenApiClient<paths>({
    baseUrl,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
