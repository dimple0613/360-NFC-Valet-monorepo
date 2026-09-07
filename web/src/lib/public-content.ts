"use client";

import { useEffect, useState } from "react";

// Client-side fetch of the public platform identity + error copy. Used by the
// client-only 500 handler and the root layout's favicon injector, which are the
// two surfaces that can't read settings on the server.
export interface PublicPlatformContent {
  brandName: string;
  copyright: string;
  supportEmail: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  error404: { title: string; body: string };
  error403: { title: string; body: string };
  error401: { title: string; body: string };
  error500: { title: string; body: string };
}

const EMPTY: PublicPlatformContent = {
  brandName: "360 NFC Valet",
  copyright: "",
  supportEmail: null,
  logoLightUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  error404: { title: "", body: "" },
  error403: { title: "", body: "" },
  error401: { title: "", body: "" },
  error500: { title: "", body: "" },
};

export function usePublicPlatformContent(): PublicPlatformContent {
  const [content, setContent] = useState<PublicPlatformContent>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/pages/content", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!cancelled) setContent(data as PublicPlatformContent);
      })
      .catch(() => {
        // Leave defaults in place — branding is a nice-to-have on error pages.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return content;
}