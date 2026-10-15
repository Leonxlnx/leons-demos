// Writes the Bayer mask tiles --m0 to --m8 into src/styles/global.css, between the
// bayer:start and bayer:end comments: `node scripts/bayer-css.mjs` (Node 22.18+ strips the
// types from bayer.ts by itself; older 22.x needs --experimental-strip-types). Running it
// again rewrites the same block, so it is safe to repeat after changing bayer.ts.
//
// --mN is tile(2N): 2N of 16 cells lit. --m0 hides everything and --m8 shows everything; the
// stepped develops walk the even levels between (--m2 is a quarter, --m4 half, --m6 three
// quarters, and the page develop takes --m1 to --m7 = 2 to 14 cells). Odd levels get no token.
import { readFile, writeFile } from "node:fs/promises";
import { tile } from "../src/lib/bayer.ts";

const file = new URL("../src/styles/global.css", import.meta.url);
const START = "/* bayer:start */";
const END = "/* bayer:end */";
const MAX_BYTES = 400;

// Single quotes inside the SVG, so only < > # % need escaping inside url("...").
const uri = (svg) => `url("data:image/svg+xml,${svg.replaceAll('"', "'").replace(/[<>#%]/g, encodeURIComponent)}")`;

const css = await readFile(file, "utf8");
const a = css.indexOf(START);
const b = css.indexOf(END);
if (a < 0 || b < a) throw new Error(`${START} ... ${END} not found in global.css`);
const indent = css.slice(css.lastIndexOf("\n", a) + 1, a);

const lines = [`${indent}/* --mN = tile(2N): 2N of 16 cells lit, in bayer4() order. */`];
for (let n = 0; n <= 8; n++) {
  const value = uri(tile(2 * n));
  if (value.length > MAX_BYTES) throw new Error(`--m${n} is ${value.length} bytes, over ${MAX_BYTES}`);
  lines.push(`${indent}--m${n}: ${value};`);
}
await writeFile(file, `${css.slice(0, a + START.length)}\n${lines.join("\n")}\n${indent}${css.slice(b)}`);
console.log(`global.css: --m0 to --m8 written`);
