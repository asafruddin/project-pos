/**
 * Generates the Android launcher icon + splash from the PWA's in-app brand mark
 * (orange rounded square + Phosphor "coffee" fill). Run: node scripts/generate-icons.mjs
 * Output is committed under assets/.
 */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defs = fs.readFileSync(
  path.join(root, "node_modules/phosphor-react-native/src/defs/Coffee.tsx"),
  "utf8",
);
const fill = defs.slice(defs.indexOf("'fill'"));
const paths = [...fill.matchAll(/<Path d="([^"]+)"/g)].map((m) => m[1]);
if (paths.length === 0) throw new Error("coffee fill path not found");

const ORANGE = "#f97316";
const WHITE = "#ffffff";

/** Cup glyph, viewBox 0 0 256 256, scaled into a `size` box centred at (cx, cy). */
function cup(size, cx, cy, color) {
  const scale = size / 256;
  const tx = cx - 128 * scale;
  const ty = cy - 128 * scale;
  return `<g transform="translate(${tx} ${ty}) scale(${scale})" fill="${color}">${paths
    .map((d) => `<path d="${d}"/>`)
    .join("")}</g>`;
}

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

async function png(file, size, body) {
  await sharp(Buffer.from(svg(size, body))).png().toFile(path.join(root, "assets", file));
  console.log("wrote assets/" + file);
}

// Legacy / store icon: full orange tile with the cup.
await png(
  "icon.png",
  1024,
  `<rect width="1024" height="1024" rx="224" fill="${ORANGE}"/>${cup(560, 512, 512, WHITE)}`,
);
// Adaptive icon: background layer, foreground glyph inside the 66% safe zone, monochrome for themed icons.
await png("android-icon-background.png", 1024, `<rect width="1024" height="1024" fill="${ORANGE}"/>`);
await png("android-icon-foreground.png", 1024, cup(430, 512, 512, WHITE));
await png("android-icon-monochrome.png", 1024, cup(430, 512, 512, "#000000"));
// Splash glyph (shown on the orange splash background) and favicon.
await png("splash-icon.png", 1024, cup(420, 512, 512, WHITE));
await png(
  "favicon.png",
  256,
  `<rect width="256" height="256" rx="56" fill="${ORANGE}"/>${cup(140, 128, 128, WHITE)}`,
);
