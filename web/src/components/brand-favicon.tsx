"use client";

import { useEffect } from "react";
import { usePublicPlatformContent } from "@/lib/public-content";

// Injects the favicon configured in Settings > Branding into every page. The
// stored value is an inline data URL (file upload) or an absolute http(s) URL —
// either way it points at something that serves reliably in production. Falls
// back to the bundled favicon when nothing is configured.
//
// The root layout already serves the configured favicon as the metadata icon,
// so on navigation the brand icon is in <head> from first paint. This client
// pass exists to keep it authoritative when the setting changes without a full
// reload: it removes any competing icon links (the bundled /favicon.svg,
// app/favicon.ico) so the browser can only pick the brand one.
export function BrandFavicon() {
  const { faviconUrl } = usePublicPlatformContent();

  useEffect(() => {
    if (!faviconUrl) return;
    const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-brand]');
    if (existing) {
      existing.href = faviconUrl;
      return;
    }
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"]')
      .forEach((el) => {
        const href = el.getAttribute("href") ?? "";
        if (el.dataset.brand) return;
        // Keep other injected data-URL icons (same brand set by a prior render)
        // but drop every static-file link (server metadata + app/favicon.ico).
        if (href.startsWith("data:")) return;
        el.remove();
      });
    const el = document.createElement("link");
    el.rel = "icon";
    el.href = faviconUrl;
    el.dataset.brand = "1";
    document.head.appendChild(el);
  }, [faviconUrl]);

  return null;
}