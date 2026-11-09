/** Axis-aligned rectangle, top-left origin. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A collidable rectangle in the room. `active` lets devices and view-only geometry toggle. */
export interface Solid extends Rect {
  oneWay?: boolean;
  active: boolean;
  /** Frame displacement, used to carry bodies standing on moving platforms. */
  dx?: number;
  dy?: number;
  tag?: string;
  /** Lens colour a hidden ledge belongs to. */
  color?: string;
}

export interface Body extends Rect {
  vx: number;
  vy: number;
}

export interface MoveResult {
  hitLeft: boolean;
  hitRight: boolean;
  hitTop: boolean;
  hitBottom: boolean;
  ground: Solid | null;
}

const EPS = 0.001;

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * Move a body by (dx, dy) against solids, X axis first then Y.
 * One-way platforms only block downward motion that starts above them.
 * `dropThrough` ignores one-way platforms for this move.
 */
export function moveBody(
  body: Body,
  dx: number,
  dy: number,
  solids: readonly Solid[],
  dropThrough = false,
): MoveResult {
  const res: MoveResult = { hitLeft: false, hitRight: false, hitTop: false, hitBottom: false, ground: null };

  if (dx !== 0) {
    body.x += dx;
    for (const s of solids) {
      if (!s.active || s.oneWay) continue;
      if (!overlaps(body, s)) continue;
      if (dx > 0) {
        body.x = s.x - body.w;
        res.hitRight = true;
      } else {
        body.x = s.x + s.w;
        res.hitLeft = true;
      }
    }
  }

  if (dy !== 0) {
    const prevBottom = body.y + body.h;
    body.y += dy;
    for (const s of solids) {
      if (!s.active) continue;
      if (!overlaps(body, s)) continue;
      if (s.oneWay) {
        if (dy <= 0 || dropThrough || prevBottom > s.y + EPS + 1) continue;
        body.y = s.y - body.h;
        res.hitBottom = true;
        res.ground = s;
        continue;
      }
      if (dy > 0) {
        body.y = s.y - body.h;
        res.hitBottom = true;
        res.ground = s;
      } else {
        body.y = s.y + s.h;
        res.hitTop = true;
      }
    }
  }
  return res;
}

/** Return the solid directly under the body (within 1px), if any. */
export function groundUnder(body: Rect, solids: readonly Solid[]): Solid | null {
  const probe = { x: body.x + 1, y: body.y + body.h, w: body.w - 2, h: 1.5 };
  for (const s of solids) {
    if (!s.active) continue;
    if (!overlaps(probe, s)) continue;
    if (s.oneWay && body.y + body.h > s.y + 1.5) continue;
    return s;
  }
  return null;
}

/** True if a solid (non one-way) touches the body's side. `dir` is -1 for left, 1 for right. */
export function wallBeside(body: Rect, dir: -1 | 1, solids: readonly Solid[]): boolean {
  const probe = { x: dir > 0 ? body.x + body.w : body.x - 1.5, y: body.y + 4, w: 1.5, h: body.h - 8 };
  for (const s of solids) {
    if (!s.active || s.oneWay) continue;
    if (overlaps(probe, s)) return true;
  }
  return false;
}

/** Push a body out of any solid it overlaps, along the shallowest axis. */
export function depenetrate(body: Rect, solids: readonly Solid[]): boolean {
  let moved = false;
  for (const s of solids) {
    if (!s.active || s.oneWay || !overlaps(body, s)) continue;
    const left = body.x + body.w - s.x;
    const right = s.x + s.w - body.x;
    const up = body.y + body.h - s.y;
    const down = s.y + s.h - body.y;
    const m = Math.min(left, right, up, down);
    if (m === up) body.y -= up;
    else if (m === down) body.y += down;
    else if (m === left) body.x -= left;
    else body.x += right;
    moved = true;
  }
  return moved;
}

/**
 * Segment vs rectangle (Liang-Barsky). Returns entry t in [0,1] or -1 if no hit.
 */
export function segmentRect(x0: number, y0: number, x1: number, y1: number, r: Rect): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return -1;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return -1;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return -1;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0;
}

/** First blocking hit along a segment against non one-way solids. Returns t in [0,1], 1 if clear. */
export function raycast(x0: number, y0: number, x1: number, y1: number, solids: readonly Solid[]): number {
  let best = 1;
  for (const s of solids) {
    if (!s.active || s.oneWay) continue;
    const t = segmentRect(x0, y0, x1, y1, s);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}

/** Greedy-merge a boolean tile grid into rectangles (in tile units). */
export function mergeTiles(grid: boolean[][]): Rect[] {
  const h = grid.length;
  const w = h ? grid[0].length : 0;
  const used = grid.map((row) => row.map(() => false));
  const out: Rect[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y][x] || used[y][x]) continue;
      let rw = 1;
      while (x + rw < w && grid[y][x + rw] && !used[y][x + rw]) rw++;
      let rh = 1;
      outer: while (y + rh < h) {
        for (let i = 0; i < rw; i++) if (!grid[y + rh][x + i] || used[y + rh][x + i]) break outer;
        rh++;
      }
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) used[y + yy][x + xx] = true;
      out.push({ x, y, w: rw, h: rh });
    }
  }
  return out;
}
