import Link from "next/link";

function NotFound() {
  return (
    <div className="page">
      <main className="page-content" style={{ display: "flex", alignItems: "center" }}>
        <div className="state-wrap">
          <div className="state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v5m0 4h.01M10.3 3.9 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="state-title">404 — Page not found</div>
          <div className="state-sub">
            This link doesn&apos;t match a card page. Open this page from a tagged NFC card to load your hotel page, or go back to the start.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <Link href="/" className="btn-dark" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>
              Go to start
            </Link>
            <Link href="/t/7001" className="btn-ghost" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>
              Open sample card
            </Link>
          </div>
        </div>
      </main>
      <footer className="footer">
        <b>360 NFC Valet</b> · Tap your card, skip the curb
      </footer>
    </div>
  );
}

export default NotFound;
