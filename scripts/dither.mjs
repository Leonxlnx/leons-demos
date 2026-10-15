// Writes public/dither/{id}.png and {id}-paper.png: each demo's poster as an ordered-dither
// print in four greys, for the homepage strip and the closing reel.
// `node scripts/dither.mjs` after adding demos to data/demos.json, next to previews.mjs
// (Node 22.18+ strips the types from bayer.ts by itself; older 22.x needs
// --experimental-strip-types).
//
// The poster is the one the homepage shows (the first media with a video, else the first
// media), fetched at the size the page requests. A failed fetch is logged and skipped; the
// homepage shows a demo without a print as its poster in dimmed grey.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
// bayer4() of the background shader, so the prints share its grain.
import { BAYER } from "../src/lib/bayer.ts";

const VARIANTS = [
  // Strip: 132 rows is 3px per cell on a 396px frame. The lightest tone is --muted, so the
  // prints stay below the colour frame in the centre. A light-ground frame is printed as a
  // negative, light ink on the dark ground, or it would be a flat grey slab among the others.
  { suffix: "", height: 132, tones: [0x0a, 0x26, 0x5c, 0x8f], negativeWhenLight: true },
  // Reel: ink on the light closing section. The lightest tone stays a step below the paper,
  // so every print keeps an edge against it.
  { suffix: "-paper", height: 60, tones: [0x4a, 0x8f, 0xc4, 0xe2] },
];

const demos = JSON.parse(await readFile(new URL("../data/demos.json", import.meta.url), "utf8"));
const outDir = new URL("../public/dither/", import.meta.url);
await mkdir(outDir, { recursive: true });

/** Same URL as sizedImage(poster, "small") in src/lib/demos.ts. */
const small = (url) => (url.startsWith("https://pbs.twimg.com/") ? `${url.replace(/\?.*$/, "")}?format=webp&name=small` : url);

/**
 * Stretches the 1st to 99th percentile to 0..1. sharp's normalise() leaves most of these frames
 * almost as they are (a few white pixels of UI text are enough), which prints dark clips in two
 * tones. The gain is capped at 4 so a near-blank frame stays flat instead of turning to noise.
 */
function normalise(data) {
  const sorted = Uint8Array.from(data).sort();
  const lo = sorted[Math.floor((sorted.length - 1) * 0.01)];
  const hi = sorted[Math.floor((sorted.length - 1) * 0.99)];
  const range = Math.max(hi - lo, 64);
  return Float32Array.from(data, (v) => Math.min(1, Math.max(0, (v - lo) / range)));
}

/** Median of 0..1 values; above about 0.8 the frame is mostly a light ground. */
function median(values) {
  const sorted = Float32Array.from(values).sort();
  return sorted[sorted.length >> 1];
}

/** Four-level ordered dither of a one-channel image (values 0..1) into `tones`. */
function dither(values, width, tones) {
  const out = Buffer.alloc(values.length);
  for (let i = 0; i < values.length; i++) {
    const x = i % width;
    const y = (i - x) / width;
    out[i] = tones[Math.min(3, Math.floor(values[i] * 3 + (BAYER[y & 3][x & 3] + 0.5) / 16))];
  }
  return out;
}

let written = 0;
for (const d of demos) {
  const poster = (d.media.find((m) => m.video) ?? d.media[0])?.image;
  if (!poster) continue;
  try {
    const res = await fetch(small(poster), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const source = Buffer.from(await res.arrayBuffer());
    for (const v of VARIANTS) {
      // gamma(1.15) resizes in a darker encoding, so thin bright lines keep their weight.
      const { data, info } = await sharp(source)
        .greyscale()
        .gamma(1.15)
        .resize({ height: v.height })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      // dither: 0 so the encoder keeps the Bayer pattern as drawn and adds no noise of its own.
      let values = normalise(data);
      if (v.negativeWhenLight && median(values) > 0.8) values = values.map((x) => 1 - x);
      const png = await sharp(dither(values, info.width, v.tones), { raw: { width: info.width, height: info.height, channels: 1 } })
        .png({ palette: true, colours: 4, dither: 0, compressionLevel: 9 })
        .toBuffer();
      await writeFile(new URL(`${d.id}${v.suffix}.png`, outDir), png);
    }
    written++;
  } catch (err) {
    console.warn(`${d.id}: ${err.message}, skipped`);
  }
}
// Prints of demos that have left data/demos.json are removed, so the folder mirrors the data.
const ids = new Set(demos.map((d) => d.id));
let removed = 0;
for (const file of await readdir(outDir)) {
  const id = file.match(/^(\d+)(-paper)?\.png$/)?.[1];
  if (id && !ids.has(id)) {
    await rm(new URL(file, outDir));
    removed++;
  }
}
console.log(`${written} prints in public/dither${removed ? `, ${removed} stale removed` : ""}`);
