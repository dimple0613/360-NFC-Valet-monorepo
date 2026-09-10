import "dotenv/config";
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const WHITE_ARCS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F4531F"/>
      <stop offset="1" stop-color="#FF8A50"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="18" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 44a14 14 0 0 1 0-24"/>
    <path d="M30 47a21 21 0 0 1 0-30"/>
    <path d="M38 50a28 28 0 0 1 0-36"/>
  </g>
</svg>`;

async function main() {
  const buf = Buffer.from(WHITE_ARCS_SVG);
  writeFileSync("public/brand.png", await sharp(buf).resize(84, 84).png().toBuffer());
  const arcsSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a7 7 0 0 1 0 8"/><path d="M9.5 5.5a11 11 0 0 1 0 13"/><path d="M13 3a15 15 0 0 1 0 18"/></g></svg>');
  writeFileSync("public/arcs-white.png", await sharp(arcsSvg).resize(44, 44).png().toBuffer());
  console.log("written public/brand.png + public/arcs-white.png");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });