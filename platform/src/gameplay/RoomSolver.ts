import type { EntityDef, RoomDef } from './RoomData';

/**
 * Reachability solver for rooms. It answers "can Pix get from the spawn to the
 * exit with the moves he has?" conservatively, so a pass means a real route
 * exists on paper (a real playthrough is still needed for feel).
 *
 * Moves: walking, jump arcs (clear of walls), wall-jump shafts,
 * cable air nodes (anchors and pull ports in range), swinging, lifts, hidden
 * ledges under a lens colour, and power: plugging a consumer or capacitor flips
 * the room between an OFF world and an ON world (gates and lifts follow it).
 * A capacitor only keeps the ON world for its hold time, so the route from the
 * plug to whatever it opens has to fit in that time.
 */

// ------------------------------------------------------------------ movement model
// In tiles, from tuning: a jump rises ~3.6, a double jump ~6.4, and jump, jump, dash
// up ~11 (the dash goes 8 ways). Across, jump, jump, dash carries ~13. The solver
// errs on the generous side, so a mechanic it says is required really is.
export const RISE = 11;
export const runFor = (rise: number) => (rise <= 2 ? 12 : rise <= 6 ? 9 : rise <= 9 ? 6 : 3);
const JACK = 10;
const TETHER = 9.5;
/** How far from an anchor a swing can carry Pix (rope up to 9.5 tiles, plus a release jump), in tiles. */
const SWING_REACH = 11;
/** Tiles Pix can travel from a zone while still holding its colour (5s lens budget, with margin). */
export const CARRY = 22;
/** Effective travel speed for timing budgets, in tiles per second (slower than a straight run). */
const SPEED = 5;
const CAPACITOR_HOLD = 10;
const MAX_ROUNDS = 8;

/** A mechanic that can be switched off, to check a room really needs it. */
export type Mech = 'anchor' | 'pull' | 'wall' | 'colour' | 'power' | 'yank' | 'hack';

export interface SolveOptions {
  /** The white lens is available: hidden ledges count anywhere. */
  white?: boolean;
  /** Swinging is unlocked (anchors carry Pix across, not just fling). */
  swing?: boolean;
  disable?: Mech[];
}

export interface Check {
  ok: boolean;
  /** Reached positions, as "x,y" (standing) or "x,ya" (mid-air). */
  reached: Set<string>;
  packetsReached: number;
  packets: number;
}

type Mask = boolean[][];
interface Masks { solid: Mask; plank: Mask; spike: Mask }

const key = (x: number, y: number, air = false) => `${x},${y}${air ? 'a' : ''}`;

class MinHeap {
  private a: [number, number, number, boolean][] = [];
  get size(): number { return this.a.length; }
  push(v: [number, number, number, boolean]): void {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number, number, boolean] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

function distToRect(x: number, y: number, w: number, h: number, z: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(0, z.x - (x + w), x - (z.x + z.w));
  const dy = Math.max(0, z.y - (y + h), y - (z.y + z.h));
  return dx + dy;
}

export function checkRoom(room: RoomDef, opts: SolveOptions = {}): Check {
  const W = room.width, H = room.height;
  const off = new Set(opts.disable ?? []);
  const blank = (): Mask => Array.from({ length: H }, () => new Array(W).fill(false));
  const mark = (m: Mask, x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (m[j] && i >= 0 && i < W) m[j][i] = true;
  };

  // ---- static geometry
  const base: Masks = { solid: blank(), plank: blank(), spike: blank() };
  for (const [x, y, w, h] of room.solids) mark(base.solid, x, y, w, h);
  for (const [x, y, w, h] of room.neon) mark(base.solid, x, y, w, h);
  // secret walls are walls, unless white true view is on the table: then Pix can walk through them
  if (!opts.white) for (const [x, y, w, h] of room.secret ?? []) mark(base.solid, x, y, w, h);
  // a hidden ledge is only there if its colour can be picked up close enough to carry it over
  const zones = room.zones ?? [];
  room.true.forEach(([x, y, w, h], i) => {
    if (off.has('colour')) return;
    const hue = room.trueColor?.[i] ?? 'blue';
    if (hue === 'white') { if (opts.white) mark(base.solid, x, y, w, h); return; }
    if (opts.white || zones.some((z) => z.color === hue && distToRect(x, y, w, h, z) <= CARRY)) mark(base.solid, x, y, w, h);
  });
  for (const [x, y, w] of room.oneway) mark(base.plank, x, y, w, 1);
  for (const [x, y, w] of room.spikes) mark(base.spike, x, y, w, 1);

  // ---- power
  const circuitIds = new Set(room.entities.filter((e) => (e.type === 'consumer' || e.type === 'capacitor') && e.id).map((e) => e.id!));
  const powered = (e: EntityDef) => (e.inputs ?? []).some((i) => circuitIds.has(i));
  // hack and yank ports flip a gate or platform for good, so what they drive counts as open both ways when
  // that mechanic is on, and shut (gates) or at rest (platforms) when it's switched off. The solver doesn't
  // check that the lever itself can be reached.
  const leverIds = (type: string, mech: Mech) => new Set(off.has(mech) ? [] : room.entities.filter((e) => e.type === type && e.id).map((e) => e.id!));
  const live = [leverIds('data', 'hack'), leverIds('yank', 'yank')];
  // a door opened by an item slot stays shut: the solver doesn't carry items
  const allLevers = new Set(room.entities.filter((e) => (e.type === 'data' || e.type === 'yank' || e.type === 'slot') && e.id).map((e) => e.id!));
  const toggled = (e: EntityDef) => (e.inputs ?? []).some((i) => live.some((l) => l.has(i)));
  const lever = (e: EntityDef) => (e.inputs ?? []).some((i) => allLevers.has(i));
  const gates = room.entities.filter((e) => e.type === 'gate');
  const lifts = room.entities.filter((e) => e.type === 'lift' || e.type === 'slider');
  const sources = room.entities.filter((e) => e.type === 'source');
  const plugs = room.entities.filter((e) => (e.type === 'consumer' || e.type === 'capacitor') && e.id);

  /** The room with the circuit off or on. Gates and lifts that aren't on the circuit are fixed. */
  const world = (on: boolean): Masks => {
    const m: Masks = { solid: base.solid.map((r) => [...r]), plank: base.plank.map((r) => [...r]), spike: base.spike };
    for (const g of gates) {
      const open = toggled(g) ? true : lever(g) ? false : powered(g) ? (g.invert ? !on : on) : true;
      if (!open) mark(m.solid, g.x, g.y, 1, g.h ?? 1);
    }
    for (const l of lifts) {
      const w = l.w ?? 3;
      mark(m.plank, l.x, l.y, w, 1);
      if (l.type === 'slider') {
        // a slider carries Pix along its whole path. A yankable slider has no wiring: it
        // is drivable whenever the yank mechanic is available, so treat its rail as reachable.
        const driveable = l.yankable ? !off.has('yank') : toggled(l);
        if (driveable) {
          const dx = (l.toX ?? l.x) - l.x, dy = (l.toY ?? l.y) - l.y, n = Math.max(Math.abs(dx), Math.abs(dy), 1);
          for (let i = 1; i <= n; i++) mark(m.plank, l.x + Math.round((dx * i) / n), l.y + Math.round((dy * i) / n), w, 1);
        }
      } else if (toggled(l) || !powered(l) || on) mark(m.plank, l.toX ?? l.x, l.toY ?? l.y, w, 1);
    }
    return m;
  };

  const anchorsAll = room.entities.filter((e) => e.type === 'anchor' || e.type === 'pull' || e.type === 'connector');
  const airAnchors = anchorsAll.filter((e) => !((e.type === 'pull' && off.has('pull')) || (e.type !== 'pull' && off.has('anchor'))));
  const swingers = opts.swing && !off.has('anchor') ? room.entities.filter((e) => e.type === 'anchor' || e.type === 'connector') : [];

  // ---- reachability inside one world
  const explore = (m: Masks, on: boolean, starts: [number, number][], budget: number): Map<string, number> => {
    const isSolid = (x: number, y: number) => x < 0 || x >= W || (y >= 0 && y < H && m.solid[y][x]);
    const free = (x: number, y: number) => !isSolid(x, y) && !(y >= 0 && y < H && m.spike[y]?.[x]);
    const body = (x: number, y: number) => free(x, y) && free(x, y - 1);
    const stand = (x: number, y: number) => body(x, y) && y + 1 < H && (isSolid(x, y + 1) || m.plank[y + 1][x]);

    const arc = (sx: number, sy: number, tx: number, ty: number, apex: number): boolean => {
      for (let y = sy; y >= apex; y--) if (!body(sx, y)) return false;
      const dx = Math.sign(tx - sx);
      for (let x = sx; x !== tx + dx; x += dx || 1) { if (!body(x, apex)) return false; if (!dx) break; }
      for (let y = apex; y <= ty; y++) if (!body(tx, y)) return false;
      return true;
    };
    const canJump = (sx: number, sy: number, tx: number, ty: number, rise: number): boolean => {
      const up = sy - ty;
      if (up > rise) return false;
      const run = Math.abs(tx - sx);
      const maxRun = up >= 0 ? runFor(up) : runFor(0) + Math.floor(-up / 2);
      if (run > maxRun) return false;
      const top = Math.min(sy, ty);
      for (let apex = top; apex >= Math.max(1, sy - rise); apex--) if (arc(sx, sy, tx, ty, apex)) return true;
      return false;
    };
    const sight = (x0: number, y0: number, x1: number, y1: number): boolean => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 1; i < n; i++) {
        if (isSolid(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n))) return false;
      }
      return true;
    };
    const shaftAt = (x: number, y: number): boolean => {
      let l = 0, r = 0;
      for (let k = 1; k <= 4; k++) { if (isSolid(x - k, y) || isSolid(x - k, y - 1)) { l = k; break; } if (!free(x - k, y)) break; }
      for (let k = 1; k <= 4; k++) { if (isSolid(x + k, y) || isSolid(x + k, y - 1)) { r = k; break; } if (!free(x + k, y)) break; }
      return l > 0 && r > 0 && l + r <= 5;
    };

    const best = new Map<string, number>();
    const heap = new MinHeap();
    const relax = (x: number, y: number, air: boolean, cost: number) => {
      if (cost > budget) return;
      const k = key(x, y, air);
      const b = best.get(k);
      if (b !== undefined && b <= cost) return;
      best.set(k, cost);
      heap.push([cost, x, y, air]);
    };
    for (const [x, y] of starts) if (stand(x, y)) relax(x, y, false, 0);

    while (heap.size) {
      const [cost, x, y, air] = heap.pop();
      if ((best.get(key(x, y, air)) ?? Infinity) < cost) continue;
      const rise = air ? RISE + 1 : RISE;
      // walk and step off edges
      if (!air) for (const dx of [-1, 1]) if (stand(x + dx, y)) relax(x + dx, y, false, cost + 1);
      for (let ty = Math.max(1, y - rise); ty < H; ty++) {
        for (let tx = Math.max(0, x - 12); tx <= Math.min(W - 1, x + 12); tx++) {
          if ((tx !== x || ty !== y) && stand(tx, ty) && canJump(x, y, tx, ty, rise)) relax(tx, ty, false, cost + Math.max(Math.abs(tx - x), Math.abs(ty - y)) + 1);
        }
      }
      // wall-jump up a shaft (jump into it first, then climb)
      if (!off.has('wall')) {
        let yy = y - 1;
        while (yy >= Math.max(1, y - RISE) && body(x, yy) && !shaftAt(x, yy)) yy--;
        for (; yy >= 1 && body(x, yy) && shaftAt(x, yy); yy--) relax(x, yy, true, cost + (y - yy));
      }
      // ride a lift between its two ends (only when it's powered, or always if it isn't on the circuit)
      for (const l of lifts) {
        if (powered(l) && !on) continue;
        const w = l.w ?? 3, ly = l.y - 1, ty = (l.toY ?? l.y) - 1;
        if (x >= l.x && x < l.x + w && (y === ly || y === ty)) {
          const ride = Math.abs(ly - ty) * 1.5;
          for (let i = 0; i < w; i++) { relax(l.x + i, ly, false, cost + ride); relax(l.x + i, ty, false, cost + ride); }
        }
      }
      // swinging: hang from an anchor in range, let go on the far side
      for (const a of swingers) {
        if (Math.hypot(a.x - x, a.y - (y - 1)) > JACK || !sight(x, y - 1, a.x, a.y)) continue;
        for (let ty = a.y + 2; ty <= Math.min(H - 1, a.y + 10); ty++) {
          for (let tx = Math.max(0, a.x - 10); tx <= Math.min(W - 1, a.x + 10); tx++) {
            if (stand(tx, ty) && Math.hypot(tx - a.x, ty - 1 - a.y) <= SWING_REACH && sight(a.x, a.y, tx, ty - 1)) relax(tx, ty, false, cost + 4);
          }
        }
      }
      // cable air nodes
      for (const a of airAnchors) {
        if (Math.hypot(a.x - x, a.y - (y - 1)) <= JACK && sight(x, y - 1, a.x, a.y) && body(a.x, a.y + 1)) relax(a.x, a.y + 1, true, cost + 3);
      }
    }
    return best;
  };

  // ---- can Pix plug the circuit from this standing cell?
  const offWorld = world(false);
  const isSolidOff = (x: number, y: number) => x < 0 || x >= W || (y >= 0 && y < H && offWorld.solid[y][x]);
  const sightOff = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 1; i < n; i++) if (isSolidOff(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n))) return false;
    return true;
  };
  const plugAt = (x: number, y: number): EntityDef | null => {
    for (const c of plugs) {
      if (Math.hypot(c.x - x, c.y - (y - 1)) > JACK || !sightOff(x, y - 1, c.x, c.y)) continue;
      for (const s of sources) {
        if (Math.hypot(s.x - x, s.y - (y - 1)) <= TETHER && sightOff(x, y - 1, s.x, s.y) && Math.hypot(s.x - c.x, s.y - c.y) <= TETHER + 1) return c;
      }
    }
    return null;
  };

  // ---- fixpoint: explore with the circuit off, plug somewhere, explore with it on, recall, repeat
  const [sx, sy] = room.spawn;
  const reached = new Map<string, number>();
  const add = (m: Map<string, number>) => {
    let grew = false;
    for (const [k, c] of m) if (!reached.has(k)) { reached.set(k, c); grew = true; }
    return grew;
  };
  add(explore(offWorld, false, [[sx, sy]], Infinity));
  const onWorld = world(true);
  const done = new Set<string>();
  const canPower = !off.has('power') && plugs.length > 0 && sources.length > 0;
  for (let round = 0; canPower && round < MAX_ROUNDS; round++) {
    let grew = false;
    const stands = [...reached.keys()].filter((k) => !k.endsWith('a')).map((k) => k.split(',').map(Number) as [number, number]);
    for (const [x, y] of stands) {
      const k = key(x, y);
      if (done.has(k)) continue;
      const c = plugAt(x, y);
      if (!c) continue;
      done.add(k);
      const timed = c.type === 'capacitor';
      const budget = timed ? (c.hold ?? CAPACITOR_HOLD) * SPEED : Infinity;
      const ons = explore(onWorld, true, [[x, y]], budget);
      if (add(ons)) grew = true;
      // power drops (recalled, or the capacitor ran out): back to the off world from wherever Pix is
      const here = [...ons.keys()].filter((q) => !q.endsWith('a')).map((q) => q.split(',').map(Number) as [number, number]);
      if (add(explore(offWorld, false, here, Infinity))) grew = true;
    }
    if (!grew) break;
  }

  const near = (ex: number, ey: number, ew: number, eh: number) => {
    for (const k of reached.keys()) {
      const [px, py] = k.replace('a', '').split(',').map(Number);
      if (px >= ex - 1 && px <= ex + ew && py >= ey - 1 && py <= ey + eh + 1) return true;
    }
    return false;
  };
  const [ex, ey, ew, eh] = room.exit;
  const packets = room.entities.filter((e) => e.type === 'packet');
  return {
    ok: ew > 0 && near(ex, ey, ew, eh),
    reached: new Set(reached.keys()),
    packetsReached: packets.filter((p) => near(p.x, p.y, 1, 1)).length,
    packets: packets.length,
  };
}

/** The room's rows with every solver-reached cell marked: `+` standing, `~` mid-air. */
export function reachMap(room: RoomDef, text: string, opts: SolveOptions = {}): string[] {
  const rows = text.split('\nmap\n')[1].split('\nend\n')[0].split('\n').map((r) => [...r]);
  for (const k of checkRoom(room, opts).reached) {
    const air = k.endsWith('a');
    const [x, y] = k.replace('a', '').split(',').map(Number);
    if (rows[y]?.[x] === '.') rows[y][x] = air ? '~' : '+';
  }
  return rows.map((r) => r.join(''));
}
