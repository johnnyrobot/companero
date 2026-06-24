import sharp from 'sharp';
import { join } from 'node:path';

const BG = '#111111';
const FG = '#ffffff';
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Full-bleed "Co" lettermark on a rounded-square background.
const svg = (size, inset) => {
  const r = Math.round(size * 0.18);                       // corner radius ≈ 18% of size (rounded square)
  const fontSize = Math.round((size - inset * 2) * 0.42);  // "Co" fills ≈ 42% of the usable (inset-adjusted) box
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-family="${FONT}" font-weight="600" font-size="${fontSize}" fill="${FG}">Co</text>
  </svg>`;
};

async function render(svgStr, size, outRel) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(join('icons', outRel));
  console.log('icons:', outRel);
}

await render(svg(192, 0), 192, 'icon-192.png');
await render(svg(512, 0), 512, 'icon-512.png');
// Maskable: extra padding so the mark survives platform mask cropping (safe zone ~80%).
await render(svg(512, 52), 512, 'icon-maskable-512.png');
