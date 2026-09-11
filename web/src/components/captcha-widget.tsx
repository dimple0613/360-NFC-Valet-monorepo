"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CaptchaProvider } from "../lib/db";

export interface CaptchaWidgetHandle {
  /**
   * Returns a verification token for the submitted form. reCAPTCHA v3 is
   * invisible, so this re-executes to produce a fresh token right before the
   * submit; checkbox providers (reCAPTCHA v2 / hCaptcha) return the token the
   * user earned by ticking the box. Null when nothing is configured or not ready.
   */
  getToken: () => Promise<string | null>;
  /** Clears the current token and re-arms the widget (use after a failed submit). */
  reset: () => void;
}

export interface CaptchaWidgetProps {
  provider: CaptchaProvider;
  /** Live site key. Ignored when provider is "none". */
  siteKey: string | null;
  /** reCAPTCHA v3 action label describing the form being protected. */
  action?: string;
}

// Module-level script cache so visiting /login then /signup doesn't inject the
// provider script twice (the provider wouldn't render a second copy anyway).
const SCRIPT_CACHE = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = SCRIPT_CACHE.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => {
      SCRIPT_CACHE.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(el);
  });
  SCRIPT_CACHE.set(src, promise);
  return promise;
}

async function waitFor<T>(get: () => T | undefined, timeoutMs = 10_000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = get();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        elem: HTMLElement | string,
        opts: { sitekey: string; size?: string; callback?: (token: string) => void; "expired-callback"?: () => void },
      ) => number;
      reset: (widgetId?: number) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
      ready?: (callback: () => void) => void;
    };
    hcaptcha?: {
      render: (
        elem: HTMLElement | string,
        opts: { sitekey: string; size?: string; callback?: (token: string) => void; "expired-callback"?: () => void },
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

/**
 * Renders the configured CAPTCHA widget on auth forms.
 *
 * - recaptcha_v2 / hcaptcha: a visible checkbox rendered into a host div via
 *   the provider's explicit-render API.
 * - recaptcha_v3: invisible — the provider script injects its own badge, the
 *   token is fetched on demand by the form's submit handler through the handle.
 * - none (or provider set without a site key): renders nothing.
 */
export const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(function CaptchaWidget(
  { provider, siteKey, action = "submit" },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const mounted = useRef(false);
  const [status, setStatus] = useState<"idle" | "ready" | "failed">("idle");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (provider === "none" || !siteKey) return;
    let cancelled = false;

    (async () => {
      try {
        if (provider === "recaptcha_v2" || provider === "recaptcha_v3") {
          await loadScript(
            provider === "recaptcha_v2"
              ? "https://www.google.com/recaptcha/api.js?render=explicit"
              : `https://www.google.com/recaptcha/api.js?render=${siteKey}`,
          );
          // api.js's script-load event fires when Google's *loader stub* is
          // ready; the full grecaptcha (render/execute) only appears once the
          // inner recaptcha__en.js has loaded. Wait for the function we need,
          // not just the object.
          const g = await waitFor(() =>
            provider === "recaptcha_v2"
              ? typeof window.grecaptcha?.render === "function"
                ? window.grecaptcha
                : undefined
              : typeof window.grecaptcha?.execute === "function"
                ? window.grecaptcha
                : undefined,
          );
          if (cancelled || !g) return;
          if (provider === "recaptcha_v2") {
            if (!hostRef.current) return;
            const widgetId = g.render(hostRef.current, {
              sitekey: siteKey,
              size: "normal",
              callback: (token) => {
                tokenRef.current = token;
              },
              "expired-callback": () => {
                tokenRef.current = null;
              },
            });
            widgetIdRef.current = widgetId;
          } else {
            const run = async () => {
              if (!mounted.current) return;
              const token = await g.execute(siteKey, { action });
              if (mounted.current) tokenRef.current = token;
            };
            g.ready?.(() => void run());
            void run();
          }
        } else if (provider === "hcaptcha") {
          await loadScript("https://hcaptcha.com/1/api.js");
          // Same stub-then-full upgrade pattern as reCAPTCHA.
          const h = await waitFor(() => (typeof window.hcaptcha?.render === "function" ? window.hcaptcha : undefined));
          if (cancelled || !h || !hostRef.current) return;
          const widgetId = h.render(hostRef.current, {
            sitekey: siteKey,
            size: "normal",
            callback: (token) => {
              tokenRef.current = token;
            },
            "expired-callback": () => {
              tokenRef.current = null;
            },
          });
          widgetIdRef.current = widgetId;
        }
        if (!cancelled) setStatus("ready");
      } catch (error) {
        console.error(`CaptchaWidget ${provider} init failed:`, error);
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider, siteKey, action]);

  useImperativeHandle(
    ref,
    () => ({
      getToken: async () => {
        if (provider === "none" || !siteKey) return null;
        if (provider === "recaptcha_v3" && window.grecaptcha) {
          const token = await window.grecaptcha.execute(siteKey, { action });
          tokenRef.current = token;
          return token;
        }
        return tokenRef.current;
      },
      reset: () => {
        tokenRef.current = null;
        if (provider === "recaptcha_v2" && window.grecaptcha && widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
        }
        if (provider === "hcaptcha" && window.hcaptcha && widgetIdRef.current !== null) {
          window.hcaptcha.reset(widgetIdRef.current);
        }
      },
    }),
    [provider, siteKey, action],
  );

  if (provider === "none" || !siteKey) return null;

  if (status === "failed") {
    return (
      <p className="rounded-md border border-dashed border-[#e2c8c0] bg-[#fdf3f0] px-3 py-2 text-xs text-[#b3402a]" role="alert">
        Couldn&apos;t load the security check. Please try again.
      </p>
    );
  }

  if (provider === "recaptcha_v3") return null;

  // The host div must stay visible for the whole render: Google's explicit
  // render API throws when the target element is display:none at render time.
  return (
    <div className="captcha-widget mt-1 flex justify-start" aria-label="Security check">
      <div ref={hostRef} className="min-h-[78px] w-[304px]" />
    </div>
  );
});