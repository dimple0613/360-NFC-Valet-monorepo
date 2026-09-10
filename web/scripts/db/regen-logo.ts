import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { BRAND_LOGO_SVG } from "../../src/lib/brand";

const FILE = "src/lib/brand.ts";

async function main() {
  const png = await sharp(Buffer.from(BRAND_LOGO_SVG)).resize({ width: 64, height: 64 }).png().toBuffer();
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  const lines = readFileSync(FILE, "utf8").split("\n");
  const idx = lines.findIndex((l) => l.startsWith("export const BRAND_LOGO_DATA_URI"));
  if (idx < 0) throw new Error("BRAND_LOGO_DATA_URI line not found");
  lines[idx] = `export const BRAND_LOGO_DATA_URI = "${dataUri}";`;
  writeFileSync(FILE, lines.join("\n"), "utf8");
  console.log(`written ${FILE}; PNG data-URI length=${dataUri.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });