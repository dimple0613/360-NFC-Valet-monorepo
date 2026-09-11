const sharp = require("sharp");
const fs = require("fs");

fs.promises
  .readFile("public/favicon.svg")
  .then((buf) => sharp(buf).resize(128, 128).png({ compressionLevel: 9 }).toBuffer())
  .then((png) => {
    const url = "data:image/png;base64," + png.toString("base64");
    const out = `export const BRAND_NAME = "360 NFC Valet";

export const BRAND_LOGO_SVG = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
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
</svg>\`;

export const BRAND_LOGO_DATA_URI = "${url}";
`;
    fs.writeFileSync("src/lib/brand.ts", out);
    console.log("wrote src/lib/brand.ts  png bytes:", png.length);
  })
  .catch((e) => {
    console.error("ERR", e);
    process.exit(1);
  });