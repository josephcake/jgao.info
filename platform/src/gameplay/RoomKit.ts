import type { Hue } from './Colours';

/** Pieces shared by the room generator and its builders. */

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ri = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

/** Glyph of a hidden ledge, by colour. */
export const GLYPH: Record<Hue, string> = { blue: 'B', green: 'G', red: 'R' };

export class Grid {
  readonly c: string[][];
  constructor(readonly w: number, readonly h: number) {
    this.c = Array.from({ length: h }, () => new Array(w).fill('.'));
  }
  get(x: number, y: number): string { return x < 0 || y < 0 || x >= this.w || y >= this.h ? '#' : this.c[y][x]; }
  set(x: number, y: number, ch: string): void { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = ch; }
  /** Fill [x0, x1) by [y0, y1). */
  fill(x0: number, y0: number, x1: number, y1: number, ch: string): void {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, ch);
  }
  /** Solid ground from row `top` to the bottom, across [x0, x1). */
  ground(x0: number, x1: number, top: number): void { this.fill(x0, top, x1, this.h, '#'); }
  /** The standard box: side walls and a ceiling. */
  box(): void {
    this.fill(0, 0, 2, this.h, '#');
    this.fill(this.w - 2, 0, this.w, this.h, '#');
    this.fill(0, 0, this.w, 2, '#');
  }
  rows(): string[] { return this.c.map((r) => r.join('')); }
}

/** What a builder hands back: the grid plus everything that goes after `end`. */
export interface Draft {
  grid: Grid;
  /** `zone ...` lines. */
  zones: string[];
  /** Entities without a glyph, as JSON lines. */
  ents: string[];
  /** Terminal texts with their tile, so they can be written in reading order. */
  terms: { x: number; y: number; text: string }[];
  /** Cells where a lost packet could hide. */
  hide: [number, number][];
}

export const draft = (grid: Grid): Draft => ({ grid, zones: [], ents: [], terms: [], hide: [] });

/** Put a terminal glyph on the grid and remember its text. */
export function term(d: Draft, x: number, y: number, text: string): void {
  d.grid.set(x, y, '?');
  d.terms.push({ x, y, text });
}

export const ent = (e: Record<string, unknown>) => `entity ${JSON.stringify(e)}`;

/** Entity ids a builder hands out, which collide when two drafts are stitched. */
const COMBO_IDS = ['s1', 'c1', 'b1'];

/** Rename every id in a draft's entity and input lines, so the right half doesn't clash with the left. */
function renameIds(dr: Draft, suffix: string): void {
  dr.ents = dr.ents.map((line) => {
    let out = line;
    for (const id of COMBO_IDS) {
      out = out.replace(new RegExp(`"${id}"`, 'g'), `"${id}${suffix}"`);
    }
    return out;
  });
}

/**
 * Join two drafts into one wide room: the left half keeps its spawn, the right half
 * keeps its exit, and the seam in between is floored over so Pix can walk across.
 *
 * Each builder makes a self-contained room (its own `@`, `E` and box walls). To put
 * two in one grid we drop the left room's exit column, drop the right room's spawn and
 * its left wall, line the two floors up, and shift everything in the right half across
 * by the left half's width (minus the shared seam).
 */
export function stitch(left: Draft, right: Draft): Draft {
  const lg = left.grid, rg = right.grid;
  // a short corridor of shared wall where the two rooms meet
  const SEAM = 3;
  const floor = (g: Grid): number => {
    // the row of the ground Pix spawns on: first solid row scanning up from the bottom on the left side
    for (let y = g.h - 1; y >= 0; y--) if (g.get(3, y) === '#') return y;
    return g.h - 2;
  };
  const lFloor = floor(lg), rFloor = floor(rg);
  const H = Math.max(lg.h, rg.h);
  // align both floors to the taller grid's floor row
  const lDy = H - lg.h, rDy = H - rg.h;
  const joinX = lg.w - 2; // drop the left room's right wall
  const W = joinX + SEAM + (rg.w - 2); // drop the right room's left wall
  const g = new Grid(W, H);

  const paste = (src: Grid, dx: number, dy: number, x0: number, x1: number) => {
    for (let y = 0; y < src.h; y++) {
      for (let x = x0; x < x1; x++) {
        const ch = src.get(x, y);
        if (ch === 'E' && src === lg) continue; // the left exit goes away
        if (ch === '@' && src === rg) continue; // the right spawn goes away
        g.set(x + dx, y + dy, ch);
      }
    }
  };
  paste(lg, 0, lDy, 0, joinX);
  paste(rg, joinX + SEAM - 2, rDy, 2, rg.w);

  // floor the seam so the two halves connect, at the right floor's walking height
  const seamTop = rFloor + rDy;
  g.fill(joinX, seamTop, joinX + SEAM, H, '#');
  // ceiling over the seam, so it reads as one room
  g.fill(joinX, 0, joinX + SEAM, 2, '#');
  void lFloor;

  const out = draft(g);
  out.zones = [...left.zones];
  out.terms = [...left.terms];
  out.hide = [...left.hide];
  out.ents = [...left.ents];

  // shift and merge the right half
  const sdx = joinX + SEAM - 2 - 2, rdy = rDy; // -2 extra because we pasted from src x=2
  renameIds(right, 'b');
  for (const z of right.zones) {
    const [, color, x, y, w, h] = z.split(/\s+/);
    out.zones.push(`zone ${color} ${Number(x) + sdx} ${Number(y) + rdy} ${w} ${h}`);
  }
  for (const t of right.terms) out.terms.push({ x: t.x + sdx, y: t.y + rdy, text: t.text });
  for (const [x, y] of right.hide) out.hide.push([x + sdx, y + rdy]);
  for (const line of right.ents) out.ents.push(shiftEnt(line, sdx, rdy));
  return out;
}

/** Shift an `entity {json}` line's x (and y) by (dx, dy), including toX/toY. */
function shiftEnt(line: string, dx: number, dy: number): string {
  const json = line.replace(/^entity\s+/, '');
  const e = JSON.parse(json) as Record<string, unknown>;
  if (typeof e.x === 'number') e.x += dx;
  if (typeof e.y === 'number') e.y += dy;
  if (typeof e.toX === 'number') (e.toX as number) += dx;
  if (typeof e.toY === 'number') (e.toY as number) += dy;
  return `entity ${JSON.stringify(e)}`;
}
