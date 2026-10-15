/** A figure split for the odometer: digits that roll and units that rise. */
export type Glyph = { digit: number; order: number } | { unit: string };

/** "95K" → its glyphs. `order` counts the digits from the right, so they roll right to left. */
export function glyphs(s: string): Glyph[] {
  const chars = [...s];
  let fromRight = chars.filter((c) => /\d/.test(c)).length;
  return chars.map((c) => (/\d/.test(c) ? { digit: Number(c), order: --fromRight } : { unit: c }));
}

/**
 * The lines a digit rolls through, as a CSS string ("6\a 7\a 8\a 9"), counting up from `from`
 * (by default the three before it) to `to`. `rows` is how many lines it travels.
 */
export function column(to: number, from = (to + 7) % 10): { col: string; rows: number } {
  const lines = [from];
  while (lines[lines.length - 1] !== to) lines.push((lines[lines.length - 1] + 1) % 10);
  return { col: lines.join("\\a "), rows: lines.length - 1 };
}
