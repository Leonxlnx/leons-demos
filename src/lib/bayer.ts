/*
 * The 4x4 Bayer dither of the background shader (bg-renderer.ts), as SVG. Everything that
 * develops on the page is printed in it: the CSS mask tiles --m0 to --m8 (written into
 * global.css by scripts/bayer-css.mjs) and the seams (DitherRamp.astro). A cell is 3px, the
 * canvas cell, so one 4x4 block is a 12px tile.
 *
 * Plain TypeScript with no imports, so Node can run it with its types stripped.
 */

/** CSS pixels per dither cell: CELL in background.ts. */
export const CELL = 3;
/** One 4x4 block of cells, in CSS pixels. */
export const TILE = 4 * CELL;

/**
 * The threshold of each cell in a block, in rows from the top: bayer4() in bg-renderer.ts
 * times 16, with cell.y counted from the top as its main() does. Level k lights the k cells
 * below k, so each level keeps the cells of the one before and adds one.
 */
export const BAYER: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Path data for the lit cells of level k (0 to 16) in one tile: a 3x3 square per cell. */
export function cells(k: number): string {
  let d = "";
  BAYER.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v < k) d += `M${x * CELL} ${y * CELL}h${CELL}v${CELL}H${x * CELL}z`;
    }),
  );
  return d;
}

/**
 * A 12x12 SVG of level k: k of the 16 cells in `fill`, the rest transparent. crispEdges
 * keeps the cells hard when a mask is drawn at a fractional device pixel ratio.
 */
export function tile(k: number, fill = "#000"): string {
  const d = cells(k);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" shape-rendering="crispEdges">` +
    (d ? `<path fill="${fill}" d="${d}"/>` : "") +
    `</svg>`
  );
}

export interface RampRow {
  level: number;
  /** Top of the row, from the top of the ramp. */
  y: number;
  height: number;
}

/**
 * A dither ramp: one row per level, `rowPx` tall, stacked from y = 0 in the order given
 * (so ascending levels run sparse at the top to solid at the bottom). A row of whole tiles
 * keeps the Bayer phase the same from row to row.
 */
export function ramp(levels: readonly number[], rowPx = TILE): RampRow[] {
  return levels.map((level, i) => ({ level, y: i * rowPx, height: rowPx }));
}
