"use client";

import { useEffect } from "react";
import { usePublicPlatformContent } from "@/lib/public-content";

// Injects the favicon configured in Settings > Branding into every page. The
// stored value is an inline data URL (file upload) or an absolute http(s) URL —
// either way it points at something that serves reliably in production. Falls
// back to the bundled favicon when nothing is configured.
export function BrandFavicon() {
  const { faviconUrl } = usePublicPlatformContent();

  useEffect(() => {
    if (!faviconUrl) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-brand]');
    if (link) {
      link.href = faviconUrl;
    } else {
      const el = document.createElement("link");
      el.rel = "icon";
      el.href = faviconUrl;
      el.dataset.brand = "1";
      document.head.appendChild(el);
    }
  }, [faviconUrl]);

  return null;
}