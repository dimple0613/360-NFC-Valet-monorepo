const NAVY_GRADIENT = "linear-gradient(150deg, #16213a, #1c2b46 55%, #2a3c61)";
const SUNSET_GRADIENT = "linear-gradient(135deg, #F4531F, #FF8A50)";

function LogoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a7 7 0 0 1 0 8" />
      <path d="M9.5 5.5a11 11 0 0 1 0 13" />
      <path d="M13 3a15 15 0 0 1 0 18" />
    </svg>
  );
}

// The public maintenance screen shown whenever the Super Admin has toggled
// maintenance mode ON. Mirrors the brand shell used by the auth/error pages.
export function MaintenanceShell({ message }: { message: string | null }) {
  const body =
    message?.trim() ??
    "We're doing some maintenance right now. The platform will be back shortly — please try again soon.";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div
        style={{
          flex: 1.1,
          background: NAVY_GRADIENT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 52px",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              background: SUNSET_GRADIENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoIcon size={22} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
            360 NFC Valet
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-1px",
              lineHeight: 1.2,
              maxWidth: 420,
            }}
          >
            The platform is briefly offline.
          </div>
          <div
            style={{
              fontSize: 14.5,
              color: "#9fb0cc",
              fontWeight: 500,
              marginTop: 16,
              lineHeight: 1.7,
              maxWidth: 420,
            }}
          >
            System updates are in progress. Your data is safe — we&apos;ll be
            back online shortly.
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "#5e6f8f", fontWeight: 600 }}>
          © 2026 We Want 360 · Dubai, UAE
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          background: "#fff",
        }}
      >
        <div style={{ width: 380, maxWidth: "100%", textAlign: "center" }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
              background: SUNSET_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            503
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>
            Maintenance in progress
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#6C7A93",
              fontWeight: 500,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
