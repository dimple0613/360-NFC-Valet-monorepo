/**
 * Preview deployments each get their own unique URL — a fixed APP_URL would
 * send every preview's links back to production instead. Vercel auto-injects
 * VERCEL_URL (this exact deployment's host, no config needed) for every
 * build; prefer it outside of Production, where APP_URL's stable custom
 * domain is what we actually want links to carry.
 */
export function resolveBaseUrl(): string {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.APP_URL ?? "http://localhost:3000";
}
