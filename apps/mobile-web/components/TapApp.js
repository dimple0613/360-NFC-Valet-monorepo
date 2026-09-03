import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";
import { api } from "@/lib/client";

const ETA_CHIPS = [5, 10, 15, 20, 30];

const CATEGORIES = [
  { label: "Dining", filter: "Dining", icon: "M5 3v7a2 2 0 0 0 2 2v9M9 3v5M5 3v5M9 3a4 4 0 0 1-4 5M17 3c-1.7 0-3 2-3 5s1.3 5 3 5v8" },
  { label: "Spa", filter: "Spa", icon: "M12 3c-2 3-6 4.5-6 9a6 6 0 0 0 12 0c0-4.5-4-6-6-9ZM9 14a3 3 0 0 0 3 3" },
  { label: "Gym", filter: "Gym", icon: "M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" },
  { label: "Fun", filter: "Entertainment", icon: "M4 20 20 4M6 4l2.5 2.5M4 6l2.5 2.5M4 4l4 4M15.5 15.5 20 20M17.5 13.5l3 3M13.5 17.5l3 3" },
  { label: "Stay", filter: "Stay", icon: "M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" },
  { label: "Deals", filter: "Deals", icon: "M20.6 13.4 11 3H4v7l9.6 10.4a2 2 0 0 0 2.9 0l4.1-4.1a2 2 0 0 0 0-2.9ZM8 7h.01" },
];

const OFFER_GRADIENT = {
  Dining: "linear-gradient(135deg,#E4572E,#F6A5C0)",
  Spa: "linear-gradient(135deg,#2E7D6B,#7FD1B9)",
  Gym: "linear-gradient(135deg,#33507E,#8FB3E8)",
  Entertainment: "linear-gradient(135deg,#6B3FA0,#C9A8F5)",
  Stay: "linear-gradient(135deg,#B97B17,#F2CE6B)",
  Deals: "linear-gradient(135deg,#C0392B,#F19A8A)",
};

function formatClock(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function carName(order) {
  if (!order) return "";
  return [order.carColor, order.carMake, order.carModel].filter(Boolean).join(" ").trim();
}

function savePercent(offer) {
  if (!offer?.wasPrice) return null;
  const pct = Math.round((1 - offer.price / offer.wasPrice) * 100);
  return pct > 0 ? pct : null;
}

function hoursText(offer) {
  if (offer?.opensAt && offer?.closesAt) return `Open till ${offer.closesAt}`;
  return "24 hours";
}

function openNow(offer, now) {
  if (!offer?.opensAt || !offer?.closesAt) return true;
  const t = new Date(now);
  const cur = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  if (offer.opensAt <= offer.closesAt) return cur >= offer.opensAt && cur <= offer.closesAt;
  return cur >= offer.opensAt || cur <= offer.closesAt;
}

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function mmss(ms) {
  const left = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
}

function ClockIcon({ size = 13, color = "#B97B17" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CountdownPill({ leftMs, onClick, glass }) {
  return (
    <button type="button" className={glass ? "pill-eta-glass" : "pill-eta"} onClick={onClick}>
      <ClockIcon />
      <span>{mmss(leftMs)}</span>
    </button>
  );
}

function Hero({ property, card }) {
  return (
    <header className="hero">
      <div className="hero-brand">360 NFC Valet</div>
      <div className="hero-property">{property?.name}</div>
      <div className="hero-area">{property?.area ? `${property.area} · ${property.city || ""}` : property?.city}</div>
      {card?.uid && (
        <div className="hero-cardchip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 8a7 7 0 0 1 0 8M9.5 5.5a11 11 0 0 1 0 13M13 3a15 15 0 0 1 0 18" />
          </svg>
          Card ····{card.uid.slice(-4)}
        </div>
      )}
    </header>
  );
}

function C1Banner({ property }) {
  return (
    <div className="c1-banner">
      <div className="c1-banner-tag">
        <b>{property?.name}</b>
        <span>Welcome. Your car is in good hands.</span>
      </div>
    </div>
  );
}

function CarStrip({ order, card }) {
  const car = carName(order);
  const statusOk = ["active", "parked", "returning"].includes(order?.status);
  return (
    <div className="car-strip">
      <div className="car-strip-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C7A93" strokeWidth="2" strokeLinecap="round">
          <rect x="4" y="2.5" width="16" height="19" rx="3" />
          <path d="M9.5 9.5a4.2 4.2 0 0 1 5 0" />
        </svg>
        <span>
          Card {card?.uid?.slice(-4)} · {order?.plate ? `${order.plate} · ` : ""}{car}
          {order?.zone ? ` · Zone ${order.zone}` : ""}
        </span>
      </div>
      <span className="car-strip-status">{statusOk ? "PARKED ✓" : String(order?.status || "NO CAR").toUpperCase()}</span>
    </div>
  );
}

function CategoryGrid({ active, onSelect }) {
  return (
    <div className="cat-grid">
      {CATEGORIES.map((c) => (
        <button key={c.label} type="button" className={`cat-tile${active === c.filter ? " active" : ""}`} onClick={() => onSelect(c)}>
          <span className="cat-tile-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={c.icon} />
            </svg>
          </span>
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

function OfferImgCard({ offer, onOpen }) {
  const grad = OFFER_GRADIENT[offer.category] || "linear-gradient(135deg,#2A3C61,#6C7A93)";
  const pct = savePercent(offer);
  const badge = pct ? `-${pct}%` : offer.category.toUpperCase();
  const darkBadge = !pct;
  return (
    <button type="button" className="offer-img-card" onClick={() => onOpen?.(offer)}>
      <div className="offer-img" style={offer.imageUrl ? { backgroundImage: `url(${offer.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: grad }}>
        <span className={`offer-img-badge${darkBadge ? " dark" : ""}`}>{badge}</span>
      </div>
      <div className="offer-img-body">
        <div className="offer-img-title">{offer.title}</div>
        <div className="offer-img-sub">
          AED {offer.price}
          {offer.validatesValet ? " · validates valet" : ""}
        </div>
      </div>
    </button>
  );
}

function StatusHero({ order, leftMs, onViewStatus }) {
  const car = carName(order);
  return (
    <button type="button" className="status-hero" onClick={onViewStatus}>
      <span className="bring-hero-icon">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
          <rect x="3" y="11" width="18" height="6" rx="2" />
          <circle cx="7.5" cy="17.5" r="1.6" />
          <circle cx="16.5" cy="17.5" r="1.6" />
        </svg>
      </span>
      <span className="bring-hero-text">
        <span className="bring-hero-title">Car on the way</span>
        <span className="bring-hero-sub">
          {car || "Your car"} is heading to the curb — tap for live status
        </span>
      </span>
      <span className="status-count">{mmss(leftMs)}</span>
    </button>
  );
}

function Home({ data, onOpenEta, onBrowse, onReload, onViewStatus, leftMs }) {
  const featured = (data.offers || []).filter((o) => o.featured).slice(0, 2);
  const hasRequest = leftMs != null;
  const orderActive = data.order && data.order.status !== "returned";
  const orderReturned = data.order && data.order.status === "returned";
  return (
    <div className="home">
      <div className="url-pill">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C7A93" strokeWidth="2.4" strokeLinecap="round">
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <span>tap.360valet.ae/{data.property?.slug}</span>
      </div>
      <C1Banner property={data.property} />
      {hasRequest ? (
        <StatusHero order={data.order} leftMs={leftMs} onViewStatus={onViewStatus} />
      ) : orderActive && data.order ? (
        <>
          <button type="button" className="bring-hero" onClick={onOpenEta}>
            <span className="bring-hero-icon">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
                <rect x="3" y="11" width="18" height="6" rx="2" />
                <circle cx="7.5" cy="17.5" r="1.6" />
                <circle cx="16.5" cy="17.5" r="1.6" />
              </svg>
            </span>
            <span className="bring-hero-text">
              <span className="bring-hero-title">Bring my car</span>
              <span className="bring-hero-sub">
                Set when you&apos;ll reach the valet — we&apos;ll have it ready
              </span>
            </span>
            <svg className="bring-hero-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <CarStrip order={data.order} card={data.card} />
        </>
      ) : orderReturned ? (
        <div className="no-car-panel">
          <span className="no-car-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5 9.5 18 20 6.5" />
            </svg>
          </span>
          <b>Visit complete</b>
          <span>Your car was returned. Thanks for using valet — tap offers below while you stay with us.</span>
          <div className="no-car-actions">
            <button type="button" className="btn-eta" onClick={onReload}>Reload page</button>
            <button type="button" className="btn-ghost" onClick={() => document.getElementById("offers-row")?.scrollIntoView({ behavior: "smooth" })}>
              Browse offers
            </button>
          </div>
        </div>
      ) : (
        <div className="no-car-panel">
          <span className="no-car-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
              <rect x="3" y="11" width="18" height="6" rx="2" />
              <circle cx="7.5" cy="17.5" r="1.6" />
              <circle cx="16.5" cy="17.5" r="1.6" />
            </svg>
          </span>
          <b>No parked car found for this card</b>
          <span>
            This card isn&apos;t linked to a parked car right now. Ask the valet desk to pair it, then reload this page.
          </span>
          <div className="no-car-actions">
            <button type="button" className="btn-eta" onClick={onReload}>Reload page</button>
            <button type="button" className="btn-ghost" onClick={() => document.getElementById("offers-row")?.scrollIntoView({ behavior: "smooth" })}>
              Browse offers
            </button>
          </div>
        </div>
      )}
      <CategoryGrid active={null} onSelect={(c) => onBrowse(c.filter, c.label)} />
      <div className="feat-row" id="offers-row">
        <span className="feat-title">Featured for you</span>
        <button type="button" className="feat-all" onClick={() => onBrowse("All", "All deals")}>
          All deals
        </button>
      </div>
      <div className="feat-grid">
        {featured.map((o) => (
          <OfferImgCard key={o.id} offer={o} onOpen={(off) => onBrowse(null, null, off)} />
        ))}
        {featured.length === 0 && (
          <div className="feat-empty">
            No featured offers right now.
          </div>
        )}
      </div>
    </div>
  );
}

function EtaSheet({ open, onClose, onSubmit, busy, order, card, error }) {
  const [minutes, setMinutes] = useState(10);
  const car = carName(order);
  useEffect(() => {
    if (open) setMinutes(10);
  }, [open]);
  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-title">When will you reach the valet?</div>
        <div className="sheet-sub">
          {car
            ? `We'll start bringing your ${car} (card ${card?.uid?.slice(-4)}) so it's waiting — not you.`
            : "We'll start bringing your car so it's waiting — not you."}
        </div>
        <div className="stepper">
          <button type="button" className="step-btn" onClick={() => setMinutes((m) => Math.max(5, m - 5))} aria-label="Decrease">
            −
          </button>
          <div className="step-value">
            <b>{minutes}</b>
            <span>minutes</span>
          </div>
          <button type="button" className="step-btn plus" onClick={() => setMinutes((m) => Math.min(30, m + 5))} aria-label="Increase">
            +
          </button>
        </div>
        <div className="chip-row">
          {ETA_CHIPS.map((m) => (
            <button key={m} type="button" className={`chip-btn${minutes === m ? " active" : ""}`} onClick={() => setMinutes(m)}>
              {m}
            </button>
          ))}
        </div>
        {error && <div className="field-error">{error}</div>}
        <button className="btn-eta" type="button" disabled={busy} onClick={() => onSubmit(minutes)}>
          {busy ? "Sending…" : `Bring my car in ${minutes} min`}
        </button>
        <div className="sheet-note">A valet driver is notified instantly. You can keep browsing offers.</div>
      </div>
    </div>
  );
}

function RequestState({ order, request, leftMs, onBack, onDone }) {
  const total = Math.max(1, request.minutes * 60);
  const left = Math.max(0, Math.ceil(leftMs / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const R = 102;
  const CIRC = 2 * Math.PI * R;
  const frac = left / total;
  const car = carName(order);
  const driver = order?.driver;
  const driverFirst = driver?.name?.split(" ")[0] || "Valet";
  const requestedAt = request.eta ? new Date(new Date(request.eta).getTime() - request.minutes * 60000) : null;
  const steps = [
    { label: "Request received", time: requestedAt ? formatClock(requestedAt.toISOString()) : "now", state: "done" },
    { label: driver ? `Driver assigned — ${driver.name}` : "Driver assigned", time: requestedAt ? formatClock(requestedAt.toISOString()) : "now", state: driver ? "done" : "pending" },
    { label: "Car on the move", time: "now", state: "now" },
    { label: "Ready at valet curb", time: request.eta ? `~${formatClock(request.eta)}` : "", state: "pending" },
  ];
  return (
    <div className="c3">
      <div className="c3-head">
        <button type="button" className="back-btn" onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="c3-title">Your car</div>
        <div className="head-spacer" />
      </div>
      <div className="c3-ring-wrap">
        <div className="c3-ring">
          <svg width="230" height="230" viewBox="0 0 230 230">
            <circle cx="115" cy="115" r="102" fill="none" stroke="#F1F3F6" strokeWidth="14" />
            <circle
              cx="115"
              cy="115"
              r="102"
              fill="none"
              stroke="#F4531F"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - frac)}
              transform="rotate(-90 115 115)"
            />
          </svg>
          <div className="c3-ring-time">
            <b>{mm}:{ss}</b>
            <span>{left === 0 ? "driver arriving any moment" : "until your car is out"}</span>
          </div>
        </div>
        <div className="driver-chip">
          <div className="driver-chip-avatar" style={{ background: driver?.color || "#F4531F" }}>
            {driver?.initials || "V"}
          </div>
          <span>
            {driverFirst} is bringing your {order?.carModel || "car"}
            {order?.zone ? ` from Zone ${order.zone}` : ""}
          </span>
        </div>
      </div>
      <div className="steps">
        {steps.map((s) => (
          <div key={s.label} className="step-row">
            <div className={`step-dot ${s.state}`}>
              {s.state === "done" && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
              )}
              {s.state === "now" && <div className="step-now-dot" />}
            </div>
            <div className={`step-label${s.state === "pending" ? " pending" : ""}`}>{s.label}</div>
            <div className={`step-time${s.state === "pending" ? " pending" : ""}`}>{s.time}</div>
          </div>
        ))}
      </div>
      <div className="c3-validate">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C9D61" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5 9.5 18 20 6.5" />
        </svg>
        <span>Valet validated — parking is on the house</span>
      </div>
    </div>
  );
}

function ReadyState({ order, onDone }) {
  const car = carName(order);
  const loc = [order?.zone, order?.slot].filter(Boolean).join(" · ") || "Valet curb";
  return (
    <div className="ready-green">
      <div className="ready-green-icon">
        <div className="ready-green-icon-inner">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </div>
      </div>
      <div className="ready-green-title">Your car is ready</div>
      <div className="ready-green-sub">
        {car || "Your car"}
        {order?.plate ? ` · ${order.plate}` : ""}
        <br />
        Waiting at the valet curb.
      </div>
      <div className="ready-green-loc">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
        <span>{loc}</span>
      </div>
      <button type="button" className="ready-green-btn" onClick={onDone}>
        I&apos;m on my way
      </button>
      <div className="ready-green-note">Hand your card to the valet team — that closes your visit.</div>
    </div>
  );
}

function Listing({ category, label, offers, onBack, onOpen, leftMs, onViewStatus, now }) {
  const [filter, setFilter] = useState("all");
  const base = category === "All" ? offers : offers.filter((o) => o.category === category);
  const counts = {
    all: base.length,
    offers: base.filter((o) => o.wasPrice || o.dealTag).length,
    open: base.filter((o) => openNow(o, now)).length,
  };
  const list =
    filter === "offers"
      ? base.filter((o) => o.wasPrice || o.dealTag)
      : filter === "open"
      ? base.filter((o) => openNow(o, now))
      : base;
  return (
    <div className="list">
      <div className="list-head">
        <button type="button" className="back-btn" onClick={onBack} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="list-title">{label}</div>
        {leftMs != null ? <CountdownPill leftMs={leftMs} onClick={onViewStatus} /> : <div className="head-spacer" />}
      </div>
      <div className="list-chips">
        <button type="button" className={`list-chip${filter === "all" ? " active" : " idle"}`} onClick={() => setFilter("all")}>
          All · {counts.all}
        </button>
        <button type="button" className={`list-chip${filter === "offers" ? " active" : " idle"}`} onClick={() => setFilter("offers")}>
          Offers only
        </button>
        <button type="button" className={`list-chip${filter === "open" ? " active" : " idle"}`} onClick={() => setFilter("open")}>
          Open now
        </button>
      </div>
      <div className="list-items">
        {list.map((o) => {
          const pct = savePercent(o);
          const badge = pct ? `${pct}% OFF` : o.dealTag || o.category;
          const parts = [o.desc, o.level, hoursText(o)].filter(Boolean);
          return (
            <button key={o.id} type="button" className="list-card" onClick={() => onOpen(o)}>
              <div className="list-card-img" style={o.imageUrl ? { backgroundImage: `url(${o.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: OFFER_GRADIENT[o.category] || "linear-gradient(135deg,#2A3C61,#6C7A93)" }}>
                <span className="list-card-badge">{badge}</span>
              </div>
              <div className="list-card-body">
                <div className="list-card-title-row">
                  <div className="list-card-title">{o.title}</div>
                  <div className="rating-star">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#E9A23B">
                      <path d="M12 2l2.9 6.3 6.6.7-4.9 4.6 1.3 6.6L12 16.9 6.1 20.2l1.3-6.6L2.5 9l6.6-.7Z" />
                    </svg>
                    <span className="rating-value">{o.rating ? o.rating.toFixed(1) : "—"}</span>
                  </div>
                </div>
                <div className="list-card-sub">{parts.join(" · ")}</div>
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="list-empty">
            Nothing here yet — check back soon.
          </div>
        )}
      </div>
    </div>
  );
}

function OfferDetail({ offer, property, onBack, leftMs, onViewStatus, apiCall }) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [err, setErr] = useState("");
  const grad = OFFER_GRADIENT[offer.category] || "linear-gradient(135deg,#2A3C61,#6C7A93)";
  const pct = savePercent(offer);
  const meta = [offer.level, offer.opensAt && offer.closesAt ? `${offer.opensAt} – ${offer.closesAt}` : "24 hours"].filter(Boolean);

  const doValidate = async () => {
    setValidating(true);
    setErr("");
    try {
      await apiCall({ offerId: offer.id, code: code.trim() });
      setValidated(true);
    } catch (e) {
      setErr(e.message || "Could not validate");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div>
      <div className="detail-hero" style={offer.imageUrl ? { backgroundImage: `url(${offer.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: grad }}>
        <div className="detail-top">
          <button type="button" className="back-btn" onClick={onBack} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          {leftMs != null ? <CountdownPill leftMs={leftMs} onClick={onViewStatus} glass /> : <div className="head-spacer" />}
        </div>
      </div>
      <div className="detail-body">
        <span className="detail-badge">
          {offer.category.toUpperCase()}
          {offer.dealTag ? ` · ${offer.dealTag}` : ""}
        </span>
        <div className="detail-title">{offer.title}</div>
        <div className="detail-meta">
          <span className="rating-star">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#E9A23B">
              <path d="M12 2l2.9 6.3 6.6.7-4.9 4.6 1.3 6.6L12 16.9 6.1 20.2l1.3-6.6L2.5 9l6.6-.7Z" />
            </svg>
            <span className="rating-value">{offer.rating ? offer.rating.toFixed(1) : "—"}</span>
            {offer.reviews > 0 && <span className="rating-count">({offer.reviews.toLocaleString()})</span>}
          </span>
          {meta.length > 0 && <span>{meta.join(" · ")}</span>}
        </div>
        <div className="price-row">
          <span className="price-now">AED {offer.price}</span>
          {offer.wasPrice != null && <span className="price-was">AED {offer.wasPrice}</span>}
          {pct != null && <span className="price-save">SAVE {pct}%</span>}
        </div>
        {offer.desc && <div className="detail-desc">{offer.desc}</div>}
        {offer.menuUrl && (
          <a
            className="reserve-wrap"
            href={offer.menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", textDecoration: "none", marginBottom: 12 }}
          >
            <span className="reserve-btn" style={{ background: "#1C2B46", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
              </svg>
              View menu
            </span>
          </a>
        )}
          {offer.validatesValet && (
          <>
            <div className="validate-box">
              <div className="validate-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
                  <rect x="3" y="11" width="18" height="6" rx="2" />
                  <circle cx="7.5" cy="17.5" r="1.6" />
                  <circle cx="16.5" cy="17.5" r="1.6" />
                </svg>
              </div>
              <div className="validate-text">
                <div className="validate-title">Dine here — valet parking free</div>
                <div className="validate-sub">Ask your server to validate. They enter a staff code below.</div>
              </div>
            </div>
            {validated ? (
              <div className="validate-ok">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C9D61" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
                <span>Valet validated — parking is on the house</span>
              </div>
            ) : (
              <>
                <div className="code-row">
                  <div className="code-input-wrap">
                    <span className="code-input-label" style={{ width: "40%" }}>Staff validation code</span>
                    <input
                      className="code-input"
                      style={{ width: "60%" }}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="• • • •"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                    />
                  </div>
                  <button type="button" className="validate-btn" disabled={validating || code.length < 4} onClick={doValidate}>
                    {validating ? "…" : "Validate"}
                  </button>
                </div>
                {err && <div className="validate-err">{err}</div>}
              </>
            )}
          </>
        )}
        <div className="reserve-wrap">
          <a className="reserve-btn" href={`tel:${(property?.phone || "").replace(/\s+/g, "")}`}>
            Call to reserve · {property?.phone || "Hotel"}
          </a>
        </div>
      </div>
    </div>
  );
}

function NfcScanIcon({ scanning }) {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={scanning ? "#f4531f" : "#1C2B46"} strokeWidth="1.9" strokeLinecap="round" style={{ animation: scanning ? "nfc-pulse 1.2s ease-in-out infinite" : "none" }}>
      <path d="M6 8a7 7 0 0 1 0 8" />
      <path d="M9.5 5.5a11 11 0 0 1 0 13" />
      <path d="M13 3a15 15 0 0 1 0 18" />
      <path d="M16 6c-1.1 1.1-1.1 2.9 0 4" />
      <path d="M19 3c-2.8 2.8-2.8 7.2 0 10" />
    </svg>
  );
}

function normalizeSerial(serial) {
  const clean = String(serial || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (!/^[0-9A-F]{4,16}$/.test(clean)) return null;
  return (clean.match(/.{1,2}/g) || []).join(":");
}

function Landing({ onNavigate }) {
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [manualUid, setManualUid] = useState("");
  const [nfcError, setNfcError] = useState("");
  const ndefRef = useRef(null);
  const nfcAbortRef = useRef(null);

  useEffect(() => {
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  const stopNfcScan = () => {
    if (nfcAbortRef.current) {
      nfcAbortRef.current.abort();
      nfcAbortRef.current = null;
    }
    ndefRef.current = null;
    setNfcScanning(false);
  };

  const startNfcScan = async () => {
    if (!("NDEFReader" in window)) {
      setNfcError("Web NFC is only supported on Android Chrome. Use manual entry below.");
      return;
    }
    if (typeof window.isSecureContext !== "undefined" && !window.isSecureContext) {
      setNfcError("NFC needs a secure (HTTPS) connection. Use manual entry below.");
      return;
    }
    setNfcError("");
    setNfcScanning(true);
    const controller = new AbortController();
    nfcAbortRef.current = controller;
    try {
      const ndef = new window.NDEFReader();
      ndefRef.current = ndef;
      ndef.addEventListener("reading", ({ serialNumber, message }) => {
        let uid = null;
        for (const rec of message?.records || []) {
          if (rec.recordType !== "text") continue;
          const text = (rec.text !== undefined && rec.text !== null ? rec.text : rec.data ? new TextDecoder().decode(rec.data) : "").trim();
          const m = text.match(/\d{4,6}/);
          if (m) { uid = m[0]; break; }
        }
        if (!uid) {
          const digits = String(serialNumber || "").replace(/[^0-9]/g, "");
          if (/^\d{4,6}$/.test(digits)) uid = digits;
        }
        stopNfcScan();
        if (uid) {
          onNavigate(uid);
          return;
        }
        const serial = normalizeSerial(serialNumber);
        if (serial) onNavigate(serial);
        else setNfcError("Could not read this card. Enter the card number below.");
      });
      ndef.addEventListener("readingerror", () => {
        stopNfcScan();
        setNfcError("Could not read NFC tag. Hold your phone steady against the card.");
      });
      await ndef.scan({ signal: controller.signal });
    } catch (e) {
      nfcAbortRef.current = null;
      setNfcScanning(false);
      if (e && e.name === "AbortError") return;
      setNfcError(
        e && e.name === "NotAllowedError"
          ? "NFC permission denied. Please allow NFC access and try again."
          : "NFC not available. Use manual entry below."
      );
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    const val = manualUid.replace(/[^0-9]/g, "").trim();
    if (val.length >= 4) onNavigate(val);
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-brand">
          <div className="hero-brand-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a7 7 0 0 1 0 8"></path>
              <path d="M9.5 5.5a11 11 0 0 1 0 13"></path>
              <path d="M13 3a15 15 0 0 1 0 18"></path>
            </svg>
          </div>
          360 NFC Valet
        </div>
        <div className="hero-property">Tap your card to begin</div>
        <div className="hero-area">Scan your valet card or enter the card number below.</div>
      </header>
      <main className="page-content">
        <div className="panel" style={{ padding: "24px 20px", marginTop: 16 }}>
          <div className="nfc-scan-area">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <NfcScanIcon scanning={nfcScanning} />
            </div>
            {nfcSupported && (
              <button
                type="button"
                className={nfcScanning ? "btn-nfc-active" : "btn-dark"}
                style={{ width: "100%", marginBottom: 12 }}
                onClick={nfcScanning ? stopNfcScan : startNfcScan}
              >
                {nfcScanning ? "Scanning… tap your card" : "Scan NFC Card"}
              </button>
            )}
            {!nfcSupported && (
              <div className="nfc-unavail">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                <span>NFC not available on this device — enter card number below</span>
              </div>
            )}
            {nfcError && <div className="nfc-err">{nfcError}</div>}
            <div className="nfc-divider"><span>or</span></div>
            <form onSubmit={submitManual}>
              <label className="nfc-label">Card number</label>
              <input
                className="nfc-input"
                inputMode="numeric"
                placeholder="e.g. 7001"
                value={manualUid}
                onChange={(e) => setManualUid(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
              />
              <button type="submit" className="btn-dark" style={{ width: "100%" }} disabled={manualUid.replace(/[^0-9]/g, "").length < 4}>
                Look up card
              </button>
            </form>
          </div>
        </div>
      </main>
      <footer className="footer">
        <b>360 NFC Valet</b> · Tap your card, skip the curb
      </footer>
    </div>
  );
}

function ErrorState({ message, retry }) {
  return (
    <div className="state-wrap">
      <div className="state-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M12 9v4m0 4h.01M10.3 3.9l-8 13.9A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z" />
        </svg>
      </div>
      <div className="state-title">Card not recognised</div>
      <div className="state-sub">{message}</div>
      <button className="btn-dark" type="button" onClick={retry}>Try again</button>
    </div>
  );
}

function TapApp() {
  const router = useRouter();
  const uid = String(router.query.uid || router.query.id || "").trim();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState(uid ? "loading" : "landing");
  const [error, setError] = useState("");
  const [view, setView] = useState({ type: "home" });
  const [etaOpen, setEtaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [etaError, setEtaError] = useState("");
  const [request, setRequest] = useState(null);
  const [ready, setReady] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [resolvedUid, setResolvedUid] = useState(null);
  const [wsBanner, setWsBanner] = useState(null);
  const mounted = useRef(false);
  const statusRef = useRef(null);
  const now = useNow(true);
  const target = request?.eta ? new Date(request.eta).getTime() : 0;
  const leftMs = target ? Math.max(0, target - now) : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const propId = data?.property?.id || data?.order?.propertyId;
    if (!propId || !mounted.current) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "";
    if (!wsUrl) return;
    const socket = io(wsUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 20,
    });
    const bannerTimers = [];
    const clearBannerIn = (ms) => {
      const id = setTimeout(() => setWsBanner(null), ms);
      bannerTimers.push(id);
    };
    socket.on("connect", () => {
      socket.emit("subscribe:property", propId);
    });
    socket.on("valet.order.parked", (ev) => {
      if (ev.orderId === data.order?.id) {
        setWsBanner("Your car has been parked");
        clearBannerIn(4000);
        setFetchKey((k) => k + 1);
      }
    });
    socket.on("valet.order.return.requested", (ev) => {
      if (ev.orderId === data.order?.id) {
        setWsBanner("Your car request has been received");
        clearBannerIn(4000);
        setFetchKey((k) => k + 1);
      }
    });
    socket.on("valet.order.completed", (ev) => {
      if (ev.orderId === data.order?.id) {
        setWsBanner("Your car has arrived!");
        clearBannerIn(4000);
        setFetchKey((k) => k + 1);
      }
    });
    socket.on("valet.delay.notified", (ev) => {
      if (ev.orderId === data.order?.id) {
        setWsBanner("Driver notified of a delay");
        clearBannerIn(4000);
        setFetchKey((k) => k + 1);
      }
    });
    return () => { bannerTimers.forEach(clearTimeout); socket.disconnect(); };
  }, [data?.property?.id, data?.order?.id]);

  useEffect(() => {
    if (!uid) {
      setData(null);
      setLoadState("landing");
      setResolvedUid(null);
      return;
    }
    let alive = true;
    const candidates = [uid];
    const hex = uid.replace(/:/g, "").toUpperCase();
    if (/^[0-9A-F]{6,16}$/.test(hex) && !/^\d+$/.test(uid)) {
      const paired = (hex.match(/.{1,2}/g) || []).join(":");
      if (!candidates.includes(paired)) candidates.push(paired);
      if (!candidates.includes(hex)) candidates.push(hex);
    }
    setLoadState("loading");
    setError("");
    (async () => {
      let lastErr = null;
      for (let i = 0; i < candidates.length; i++) {
        try {
          const d = await api(`/public/tap/${encodeURIComponent(candidates[i])}`);
          if (!alive) return;
          setResolvedUid(candidates[i]);
          setData(d);
          statusRef.current = d.order?.status || null;
          setLoadState("ready");
          if (d.order?.status === "returning" && d.order?.guestEta) {
            const etaMs = new Date(d.order.guestEta).getTime();
            const mins = Math.max(5, Math.ceil((etaMs - Date.now()) / 60000));
            setRequest({ eta: d.order.guestEta, minutes: mins });
            setReady(false);
          } else if (d.order?.status === "returned") {
            setRequest(null);
            setReady(true);
          } else {
            setRequest(null);
            setReady(false);
          }
          setView({ type: "home" });
          window.scrollTo({ top: 0 });
          return;
        } catch (e) {
          lastErr = e;
          if (alive && e.status && e.status !== 404) break;
        }
      }
      if (!alive) return;
      setError(lastErr?.message || "Something went wrong");
      setLoadState("error");
    })();
    return () => {
      alive = false;
    };
  }, [uid, fetchKey]);

  useEffect(() => {
    const activeUid = resolvedUid || uid;
    if (loadState !== "ready" || !activeUid) return;
    const id = setInterval(async () => {
      try {
        const d = await api(`/public/tap/${encodeURIComponent(activeUid)}`);
        if (!mounted.current) return;
        const prev = statusRef.current;
        const next = d.order?.status || null;
        setData(d);
        if (prev === next) return;
        statusRef.current = next;
        if (next === "returning" && d.order?.guestEta) {
          setRequest({
            eta: d.order.guestEta,
            minutes: Math.max(5, Math.ceil((new Date(d.order.guestEta).getTime() - Date.now()) / 60000)),
          });
          setReady(false);
        } else if (next === "returned") {
          setRequest(null);
          setReady(true);
        }
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, [loadState, resolvedUid, uid]);

  const onSubmitEta = async (minutes) => {
    if (!data?.order) {
      setEtaOpen(false);
      return;
    }
    setBusy(true);
    setEtaError("");
    try {
      const res = await api(`/public/tap/${encodeURIComponent(resolvedUid || uid)}`, {
        method: "POST",
        body: { minutes },
      });
      if (mounted.current) {
        setRequest(res);
        setEtaOpen(false);
        window.scrollTo({ top: 0 });
      }
    } catch (e) {
      if (mounted.current) setEtaError(e.message || "Request failed");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const finishVisit = () => {
    setReady(false);
    setRequest(null);
    setView({ type: "home" });
  };

  if (loadState === "landing") return <Landing onNavigate={(uid) => router.push(`/t/${uid}`)} />;
  if (loadState === "loading")
    return (
      <div className="state-wrap">
        <div className="spinner" />
      </div>
    );
  if (loadState === "error") return <ErrorState message={error} retry={() => { setLoadState("loading"); setFetchKey((k) => k + 1); }} />;

  if (ready) return <ReadyState order={data.order} onDone={finishVisit} />;

  const goBrowse = (cat, label, offer) => {
    if (offer) {
      setView({ type: "detail", offer, fromCat: view.cat || null, fromLabel: view.label || null });
    } else if (cat) {
      setView({ type: "list", cat, label });
    }
    window.scrollTo({ top: 0 });
  };

  const viewStatus = () => {
    setView({ type: "status" });
    window.scrollTo({ top: 0 });
  };

  if (view.type === "status" && request) {
    return <RequestState order={data.order} request={request} leftMs={leftMs} onBack={() => setView({ type: "home" })} />;
  }

  return (
    <div className="page">
      {wsBanner && (
        <div style={{ position: "fixed", top: 16, left: 16, right: 16, zIndex: 9999, background: "#0C9D61", color: "#fff", padding: "14px 20px", borderRadius: 14, fontWeight: 700, fontSize: 14, textAlign: "center", boxShadow: "0 6px 24px rgba(12,157,97,0.35)" }}>
          {wsBanner}
        </div>
      )}
      {view.type === "detail" ? (
        <OfferDetail
          offer={view.offer}
          property={data.property}
          onBack={() => {
            if (view.fromCat) setView({ type: "list", cat: view.fromCat, label: view.fromLabel || view.fromCat });
            else setView({ type: "home" });
          }}
          leftMs={leftMs}
          onViewStatus={viewStatus}
          apiCall={(body) => api("/public/offer/validate", { method: "POST", body: { ...body, cardUid: data.card?.uid || "" } })}
        />
      ) : view.type === "list" ? (
        <Listing
          category={view.cat}
          label={view.label}
          offers={data.offers || []}
          onBack={() => setView({ type: "home" })}
          onOpen={(o) => goBrowse(null, null, o)}
          leftMs={leftMs}
          onViewStatus={viewStatus}
          now={now}
        />
      ) : (
        <Home
          data={data}
          onOpenEta={() => setEtaOpen(true)}
          onBrowse={goBrowse}
          onReload={() => { setLoadState("loading"); setFetchKey((k) => k + 1); }}
          onViewStatus={viewStatus}
          leftMs={leftMs}
        />
      )}
      <EtaSheet
        open={etaOpen}
        onClose={() => setEtaOpen(false)}
        onSubmit={onSubmitEta}
        busy={busy}
        order={data.order}
        card={data.card}
        error={etaError}
      />
    </div>
  );
}

export default TapApp;
