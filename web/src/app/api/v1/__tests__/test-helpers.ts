import { NextRequest } from "next/server";
import { createApiKey, prismaWithoutTenantScoping } from "@saasclaude/db";

/** Real DB org, no membership/user needed — REST routes authenticate via API key alone. */
export async function seedOrganization(name: string) {
  const slug = `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  return prismaWithoutTenantScoping.organization.create({ data: { name, slug } });
}

export async function seedApiKey(organizationId: string, scopes: string[], name = "test key") {
  return createApiKey({ organizationId, name, scopes });
}

export interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

/** Builds a real NextRequest, the same object type withApiTenantContext's handlers receive in production. */
export function apiRequest(path: string, opts: RequestOptions = {}): NextRequest {
  const headers = new Headers();
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  const init: { method: string; headers: Headers; body?: string } = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(opts.body);
  }
  return new NextRequest(new URL(path, "http://localhost/api/v1"), init);
}

/** Route context for a dynamic [id] segment — Next 15's params are an async-resolvable object. */
export function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export async function jsonOf(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}
