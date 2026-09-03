import type { Metadata } from "next";
import { AuthLeftPanel, AuthLeftProvider } from "./auth-left";

export const metadata: Metadata = {
  title: "360 NFC Valet",
};

// Pixel-parity with the console (/console/login): the SAME navy brand panel +
// white form panel, same class names (.login / .login-left / .login-right /
// .login-form) as valet/styles/globals.css. One layout for every auth route —
// the left panel text is page-driven (via <AuthLeftContent>), the right renders
// `children`.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthLeftProvider>
      <div className="login-login">
        <div className="login">
          <AuthLeftPanel />
          <div className="login-right">
            {children}
            {/* Kept in the DOM (hidden) so it can be toggled without removing —
                /login still matches the console which shows no such line. */}
            <p className="hidden text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </AuthLeftProvider>
  );
}
