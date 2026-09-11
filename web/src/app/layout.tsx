import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { BrandFavicon } from "@/components/brand-favicon";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The bundled favicon is the server-rendered default (can't import the DB into
// the root layout without dragging node-only deps into the client graph). The
// client-side <BrandFavicon> takes over when Settings > Branding has an
// uploaded favicon: it removes this link and injects the configured one.
export const metadata: Metadata = {
  title: {
    default: "360 Valet · SaaSclude",
    template: "%s · 360 Valet · SaaSclude",
  },
  description: "Multi-tenant SaaS platform core running 360 Valet.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <BrandFavicon />
        <Toaster />
      </body>
    </html>
  );
}
