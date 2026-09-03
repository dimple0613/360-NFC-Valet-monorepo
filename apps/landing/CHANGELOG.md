# 360 NFC Valet — Landing Clone — Change Log

Static landing at `landing/clone/`. Brand system, product copy and numbers are sourced from
`D:\Dimple\strats360-lab\projects\360 NFC Valet System\html\360 NFC Valet - All Screens.dc.html`,
`audit-report.html`, `admin\PROJECT.md`, `mobile_web\PROJECT.md` and `admin\db\seed.js` — never invented.

## 2026-08-27 — Gallery images: real AI photos (SVGs removed)
- Replaced the 4 SVG slab illustrations with **AI-generated photo-real images** (Flux via Pollinations, 1024×576, cinematic Dubai-valet style) — one per caption in `assets/img/gallery-0*.jpg`:
  `gallery-01-duallookup.jpg` (valet presenting the card) · `gallery-02-anpr.jpg` (plate camera scanning the plate) · `gallery-03-livestatus.jpg` (phone countdown ring + driver) · `gallery-04-offernet.jpg` (offer cards at the table).
- SVGs deleted; page verified (4× loaded, 0 console errors). Screenshot: `landing/compare/ai-gallery.png`.

## 2026-08-27 — Plain-language rewrite + gallery images match the text
- Rewrote all copy in simple, human language (no jargon, no pitch-speak). Examples:
  - "The card *knows* the car" → "The card *brings* the car"
  - legal fix: "Every number on this page is real and taken from the system itself. No invented figures for marketing." (was confusing "a system, not an app")
  - footer/system/contact/other sections all spoke plainly.
- Generated 4 new gallery images (SVG, 16:9, brand-dark) so each photo now matches its caption:
  `slab-01-duallookup.svg` (chip = printed number), `slab-02-anpr.svg` (plate scan, DXB · A 74126), `slab-03-livestatus.svg` (12-min countdown ring), `slab-04-offernet.svg` (offers list with prices).
- Preloader now human: WAKING THE SYSTEM / READING CARDS / STARTING THE CLOCK / ALL READY.

## 2026-08-27 — Full content sweep vs figma flow (All Screens.dc.html)
- Audited every section against the design doc — all copy now speaks the real flow:
  TAP (card UID / 4-digit printed number) → PARK (zone/slot) → RETURN (Bring my car, ETA 5–30, driver pinged, car ready).
- Brand mark (topbar) replaced with the **official logo**: NFC waves mark `#F4531F` (matches `admin/public/favicon.svg`); favicon.svg re-synced to the same official mark.
- Hero trio now reads our loop: **TAP · PARK · RETURN** (was UNBREAKABLE/UNSTOPPABLE/UNRIVALED).
- Section-by-section check passed: preloader, topbar, HUD, hero, edge stats (7/11/6), specs (6 stages/580 cards/41 routes/248 today), drive, gallery (4 slabs), config (4 packages), outro, reserve, footer, marquee.

## 2026-08-27 — Flow + favicon sync (from All Screens.dc.html)
- Extracted the real product flow from the design doc:
  **Guest arrives → driver taps card → driver parks (zone/slot) → guest taps card on phone → "Bring my car" (ETA 5–30) → driver retrieves → "Car arrived" → rolls up to the dashboard.**
- Edge stats updated to the real screen inventory: **7 CConsole screens / 11 driver screens / 6 guest pages** (previously 16/15/2).
- Configurator: Operations package now reads **11 screens** (was 15).
- Gallery copy aligned to the doc: 4-digit printed card number, plate typed or photo, "Bring my car" ETA ring, Dining / Spa / Gym / Stay / Deals offer net with staff validation code.
- Outro (finish) background image swapped to **vanta-cabin.jpg** (keeper chosen by client, #05).
- Added **favicon.svg** (brand NFC-mark, Sunset #F4531F → #FF8A50) and linked it in `<head>`.
- Meta description updated to the live Dubai property set.

## 2026-08-27 — Numbers verified against live seed
- Stats now match `admin\db\seed.js` exactly: **6 order stages · 580 cards (200+260+120) · 41 API routes · 248 drop-offs today (JW 112 · Atlantis 86 · Address 50)**.
- Hero kicker uses a real pooled card UID (**70147**, JW pool 7001–7200) with real property/area (JW Marriott Marquis, Business Bay).
- Drive cards: **22 drivers** on the roster.
- Reserve meta: **580 dual-UID cards · 3 properties live in Dubai · 14-day trial**.

## 2026-08-27 — Static clone built
- Cloned the reference site 1:1 (structure, animations, videos, CSS) as a plain static page.
- All assets localised: `assets/vendor/` (GSAP, ScrollTrigger, ScrollToPlugin, CustomEase, Lenis, SplitType, 2 MP4s), `assets/img/` (6 JPGs).
- BOM stripped from `assets/script.js`; preload array uses document-relative `assets/img/...` paths.
- Served by Laragon Apache at `http://localhost/360-NFC-Valet/landing/clone/` (NOT via Vite).

## Pending
- [ ] Replace placeholder car photos with real property shots (keep `vanta-*.jpg` names, ~2200×1228, 16:9).
- [ ] Real WhatsApp / phone / email for footer contact (currently placeholders).
- [ ] Client decision: keep old React landing at `landing/` (localhost:5173) or retire it.