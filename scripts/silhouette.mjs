// Draws the homepage silhouette, Leon seen from behind: skull, ears, neck and shoulders as shapes,
// hair as tapered locks. The drawing is rasterised, blurred and thresholded, which fuses it into one
// organic outline (the hair stays ragged, the joints go soft), and written as a black PNG with
// alpha to public/home/me.png. `node scripts/silhouette.mjs`; SEED, HEAD, LEN, LENR, LIFTP and BLUR
// tune it. Deterministic: the same settings draw the same figure.
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const W = 600;
const H = 760;
const cx = 300;
const SCALE = 2; // output 1200 x 1520
let seed = Number(process.env.SEED || 29);
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const r1 = (n) => Math.round(n * 10) / 10;

const solid = [];
// Skull: the back of a head, a little taller than wide.
solid.push(`<ellipse cx="${cx}" cy="212" rx="74" ry="88"/>`);
// Ears, half under the hair.
solid.push(`<ellipse cx="${cx - 71}" cy="248" rx="9" ry="16" transform="rotate(-10 ${cx - 71} 248)"/>`);
solid.push(`<ellipse cx="${cx + 71}" cy="248" rx="9" ry="16" transform="rotate(10 ${cx + 71} 248)"/>`);
const torso = [];
// The neck runs straight into the trapezius: one concave line from below the ears down to
// rounded shoulders, then the arms fall close to the body. A loose hoodie, no visible hood.
torso.push(`<path d="
  M ${cx - 54} 250
  C ${cx - 56} 290 ${cx - 58} 318 ${cx - 68} 340
  C ${cx - 86} 372 ${cx - 128} 392 ${cx - 172} 410
  C ${cx - 220} 428 ${cx - 246} 458 ${cx - 258} 506
  C ${cx - 268} 556 ${cx - 272} 650 ${cx - 274} ${H + 20}
  L ${cx + 274} ${H + 20}
  C ${cx + 272} 650 ${cx + 268} 556 ${cx + 258} 506
  C ${cx + 246} 458 ${cx + 220} 428 ${cx + 172} 410
  C ${cx + 128} 392 ${cx + 86} 372 ${cx + 64} 340
  C ${cx + 58} 318 ${cx + 56} 290 ${cx + 54} 250
  Z"/>`);

// Hair: short, thick and tousled. A volume cap, then many thin tapered locks rooted on the cap
// edge, lying along the head and falling away from a whorl at the back of the crown; most end
// just past the cap, a few lift further, so the edge is ragged but the mass reads as one.
const strands = [];
solid.push(`<ellipse cx="${cx + 1}" cy="198" rx="85" ry="91"/>`);
const lock = (x, y, ang, len, w) => {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const bend = (rnd() - 0.5) * 0.6;
  const tx = x + dx * len + nx * len * bend, ty = y + dy * len + ny * len * bend;
  const m1x = x + dx * len * 0.35 + nx * w, m1y = y + dy * len * 0.35 + ny * w;
  const m2x = x + dx * len * 0.35 - nx * w, m2y = y + dy * len * 0.35 - ny * w;
  return `<path d="M${r1(x + nx * w)} ${r1(y + ny * w)} Q${r1(m1x + nx * w * 0.4)} ${r1(m1y + ny * w * 0.4)} ${r1(tx)} ${r1(ty)} Q${r1(m2x - nx * w * 0.4)} ${r1(m2y - ny * w * 0.4)} ${r1(x - nx * w)} ${r1(y - ny * w)} Z"/>`;
};
for (let i = 0; i < 230; i++) {
  const t = rnd();
  const a = Math.PI * (0.9 + 1.2 * t); // below one ear, over the top, to below the other
  const x = cx + 1 + Math.cos(a) * 78;
  const y = 200 + Math.sin(a) * 82;
  // Along the skull and down, then a little outward.
  const down = Math.cos(a) < 0 ? a - Math.PI / 2 : a + Math.PI / 2;
  const dir = down * 0.68 + a * 0.32 + (rnd() - 0.5) * 0.45;
  const lift = rnd() < Number(process.env.LIFTP || 0.05) ? 8 + rnd() * 10 : 0;
  const len = Number(process.env.LEN || 10) + rnd() * Number(process.env.LENR || 11) + lift;
  solid.push(lock(x, y, dir, len, 4 + rnd() * 5));
}
// The nape: short locks falling over the neck.
for (let i = 0; i < 26; i++) {
  const x = cx - 60 + rnd() * 120;
  solid.push(lock(x, 262 + rnd() * 10, Math.PI / 2 + (rnd() - 0.5) * 0.6, 14 + rnd() * 14, 4 + rnd() * 4));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">
<rect width="${W}" height="${H}" fill="#fff"/>
<g fill="#000">${torso.join("")}<g transform="translate(${cx} 300) scale(${process.env.HEAD || 1.18}) translate(${-cx} -300)">${solid.join("")}</g></g>
<g fill="none" stroke="#000" stroke-linecap="round">${strands.join("")}</g>
</svg>`;

// Blur then threshold: the metaball pass. The blur radius sets how much neighbouring shapes fuse.
const BLUR = Number(process.env.BLUR || 3.1);
const mask = await sharp(Buffer.from(svg)).greyscale().blur(BLUR).threshold(150).blur(0.7).raw().toBuffer({ resolveWithObject: true });
const { width, height } = mask.info;
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  rgba[i * 4] = 10;
  rgba[i * 4 + 1] = 10;
  rgba[i * 4 + 2] = 10;
  rgba[i * 4 + 3] = 255 - mask.data[i];
}
const out = process.env.OUT || fileURLToPath(new URL("../public/home/me.png", import.meta.url));
await sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, palette: true, colours: 16 }).toFile(out);
console.log(`me.png ${width}x${height}, ${statSync(out).size} bytes`);
