import type { Hue } from './Colours';
import { draft, ent, Grid, ri, term, type Draft } from './RoomKit';

/**
 * Builders for the stage 2 mechanics: swinging, carrying power, capacitors, and
 * colour zones side by side. Each returns a Draft: a grid plus the zone, entity
 * and terminal lines that go with it. Distances are chosen so a room can't be
 * finished without its mechanic (the generator checks that with the solver).
 */
export interface BuildOpts {
  difficulty: 1 | 2 | 3;
  hue?: Hue;
  /** A practice room: pits are deep and spike-free, with a stair of planks to climb out. */
  safe?: boolean;
  /** Seeded random numbers, for variety between drafts. */
  rnd: () => number;
}

/** A pit with a spiked floor, cut into ground that already runs to the bottom. */
function pit(g: Grid, x0: number, x1: number, floorRow: number, safe = false): void {
  g.fill(x0, floorRow, x1, g.h - 2, '.');
  if (safe) stairs(g, x0, g.h - 2);
  else g.fill(x0, g.h - 3, x1, g.h - 2, '^');
}

/** One-plank-wide steps up the left side of a pit whose floor top is `floor`, so a fall in a practice room isn't a reset. */
function stairs(g: Grid, x: number, floor: number): void {
  g.fill(x, floor - 4, x + 1, floor - 3, '=');
  g.fill(x, floor - 8, x + 1, floor - 7, '=');
}

/**
 * A girder across [x0, x1) with its underside on row `bottom`, hung from the
 * ceiling by a strut at each end and spiked on top so nobody walks across it.
 */
function beam(g: Grid, x0: number, x1: number, bottom: number): void {
  g.fill(x0, bottom - 1, x1, bottom + 1, '#');
  g.fill(x0, bottom - 2, x1, bottom - 1, '^');
  for (const sx of [x0, x1 - 1]) g.fill(sx, 2, sx + 1, bottom - 1, '#');
}

/**
 * A one-tile pillar standing in a spike pit, off to the side of an anchor, with
 * the lost packet on top: reel down to it, then swing back out.
 */
function pillar(g: Grid, dr: Draft, x: number, top: number): void {
  g.fill(x, top, x + 1, g.h - 2, '#');
  dr.hide.push([x, top - 1]);
}

/** Raise the ground across [x0, x1) to row `top`: a terrace to climb before the exit. */
function terrace(g: Grid, x0: number, x1: number, top: number): void {
  g.fill(x0, top, x1, g.h, '#');
}

// ------------------------------------------------------------------ swing

/**
 * A wide pit with anchors hanging over it. d1: one anchor. d2: two, so you
 * chain swings. d3: three, with a higher ceiling and a landing platform lower
 * than the start. Low ceilings over the pit stop you
 * jumping across.
 */
export function buildSwing(o: BuildOpts): Draft {
  const d = o.difficulty;
  const n = [1, 2, 3][d - 1];
  const pw = [15, 18, 24][d - 1];
  const px0 = ri(o.rnd, 7, 10), F = ri(o.rnd, 13, 15);
  const drop = d === 3 ? ri(o.rnd, 2, 4) : d === 1 ? ri(o.rnd, 3, 4) : ri(o.rnd, 1, 2);
  // a practice pit is deep enough that you can't climb out the far side, so you still have to swing
  const H = o.safe ? F + drop + 11 : 26;
  const landW = ri(o.rnd, 11, 14);
  const W = px0 + pw + landW + 2;
  const g = new Grid(W, H);
  g.box();
  const dr = draft(g);
  g.ground(2, px0, F);
  const LF = F + drop;
  g.ground(px0 + pw, W - 2, LF);
  g.fill(px0, H - 2, px0 + pw, H, '#');
  if (o.safe) stairs(g, px0, H - 2); else g.fill(px0, H - 3, px0 + pw, H - 2, '^');
  const under = d === 3 ? F - 7 : F - 4;
  beam(g, px0 - 1, px0 + pw + 1, under);
  // the second beat: a terrace up to the exit
  const tx = px0 + pw + ri(o.rnd, 5, 7), tTop = LF - (d === 1 ? 2 : 3);
  terrace(g, tx, W - 2, tTop);
  for (let i = 0; i < n; i++) {
    // a lone anchor sits past the middle: a pendulum is symmetric, so centred it only just reaches the far edge
    const ax = n === 1 ? px0 + Math.floor(pw * 0.55) + ri(o.rnd, -1, 0) : px0 + Math.floor((pw * (i + 0.5)) / n) + ri(o.rnd, -1, 1);
    g.set(ax, d === 3 ? F - 3 - (i % 2) * ri(o.rnd, 1, 2) : F - 3, 'o');
    if (i === n - 1) pillar(g, dr, ax - 3, H - (d === 3 ? 6 : 5));
  }
  g.set(3, F - 1, '@');
  term(dr, 5, F - 1, d === 1 && o.safe
    ? 'BLUE PORTS ARE ANCHORS. HOLD {jack} TO HANG.\\n{left}/{right} PUMPS THE SWING. LET GO TO FLY.\\nTHE FLOOR IS SOFT HERE. NO CURRENT. PRACTISE.'
    : d === 1
    ? 'BLUE PORT. HOLD {jack} TO HANG.\\n{left}/{right} PUMPS THE SWING.\\nLET GO TO FLY.'
    : d === 2
      ? 'NEXT PORT? LET GO, THEN {jack} AGAIN.\\nRELEASE AT THE TOP OF THE SWING.\\nSPEED IS FREE. GRAVITY IS A LOAN.'
      : 'THE LANDING IS LOWER. SO IS YOUR MARGIN.\\n{up}/{down} REELS THE ROPE IN AND OUT.\\nTHREE PORTS. DIFFERENT HEIGHTS. NO NET.');
  g.fill(W - 4, tTop - 4, W - 2, tTop, 'E');
  return dr;
}

// ------------------------------------------------------------------ power

/**
 * An airlock. Power the circuit and the first gate opens; walk in; recall the
 * cable and the second gate (which wants the power off) opens. d2 and d3 add a
 * pit after the airlock.
 */
export function buildPower(o: BuildOpts): Draft {
  const d = o.difficulty;
  const lock = ri(o.rnd, 5, 8);
  const g1 = ri(o.rnd, 10, 12), g2 = g1 + lock + 1;
  const W = [g2 + 14, g2 + 20, g2 + 24][d - 1] + ri(o.rnd, 0, 2), H = 18, F = 15;
  const g = new Grid(W, H);
  g.box();
  const dr = draft(g);
  g.ground(2, W - 2, F);
  g.set(3, F - 1, '@');
  term(dr, 5, F - 1, 'A SOURCE AND A CONSUMER.\\nTAP {jack} AT THE SOURCE, THEN THE CONSUMER.\\nTHE CABLE STAYS PLUGGED. THE GATE OPENS.');
  dr.ents.push(ent({ type: 'source', x: ri(o.rnd, 4, 5), y: F - ri(o.rnd, 3, 5), id: 's1' }), ent({ type: 'consumer', x: g1 - 2, y: F - ri(o.rnd, 3, 5), id: 'c1' }));
  dr.ents.push(ent({ type: 'gate', x: g1, y: 2, h: F - 2, inputs: ['c1'] }));
  term(dr, g1 + 1 + Math.floor(lock / 2), F - 1, 'AIRLOCK. ONE DOOR AT A TIME. HR INSISTS.\\n{jack} RECALLS YOUR CABLE.\\nNO POWER, NO PROBLEM. THE OTHER DOOR OPENS.');
  dr.ents.push(ent({ type: 'gate', x: g2, y: 2, h: F - 2, inputs: ['c1'], invert: true }));
  const pitX = g2 + ri(o.rnd, 3, 5), pitW = d === 2 ? ri(o.rnd, 4, 6) : ri(o.rnd, 6, 7);
  if (d >= 2) pit(g, pitX, pitX + pitW, F);
  // past the airlock: a step up to the exit, and a shelf over the airlock for the packet
  const tTop = F - 2;
  terrace(g, W - 9, W - 2, tTop);
  g.fill(g1 + 2, F - 6, g2 - 1, F - 5, '=');
  dr.hide.push([g1 + 2 + Math.floor((lock - 2) / 2), F - 7]);
  g.fill(W - 4, tTop - 4, W - 2, tTop, 'E');
  return dr;
}

// ------------------------------------------------------------------ capacitors

/**
 * A capacitor holds power for a while after you unplug it. Charge it, recall the
 * cable, and run to the gate it opens before the hold runs out. d2 and d3 put a
 * pit in the way and push the gate further out.
 */
export function buildTimedGate(o: BuildOpts): Draft {
  const d = o.difficulty;
  const W = 40, H = 18, F = 15;
  const gx = [26, 28, 32][d - 1] + ri(o.rnd, -1, 2);
  const g = new Grid(W, H);
  g.box();
  const dr = draft(g);
  g.ground(2, W - 2, F);
  g.set(3, F - 1, '@');
  term(dr, 5, F - 1, 'A CAPACITOR CHARGES WHILE PLUGGED.\\nUNPLUG IT: IT KEEPS THE GATE OPEN. FOR A WHILE.\\nTHE GATE IS FAR. RUN.');
  dr.ents.push(
    ent({ type: 'source', x: ri(o.rnd, 4, 5), y: F - ri(o.rnd, 3, 5), id: 's1' }),
    ent({ type: 'capacitor', x: ri(o.rnd, 8, 10), y: F - ri(o.rnd, 3, 5), id: 'b1', hold: [9, 8, 8][d - 1] }),
    ent({ type: 'gate', x: gx, y: 2, h: F - 2, inputs: ['b1'] }),
  );
  const tp = ri(o.rnd, 15, 18);
  if (d >= 2) pit(g, tp, tp + (d === 2 ? 6 : 7), F);
  // a shelf over the run, for the packet
  const sx = ri(o.rnd, 20, 22);
  g.fill(sx, F - 5, sx + 3, F - 4, '=');
  dr.hide.push([sx + 1, F - 6]);
  g.fill(W - 4, F - 4, W - 2, F, 'E');
  return dr;
}

/**
 * A lift that runs on a capacitor. Charge it, step on the lift, recall the
 * cable, and ride up before the power runs out. The deeper the room, the longer
 * the ride and the less spare time.
 */
export function buildLiftRoom(o: BuildOpts): Draft {
  const d = o.difficulty;
  const rise = [14, 18, 23][d - 1] + ri(o.rnd, 0, 1);
  const TOP = ri(o.rnd, 7, 9), F = TOP + rise, H = F + 3, W = 29;
  const g = new Grid(W, H);
  g.box();
  const dr = draft(g);
  g.fill(2, F, 26, H, '#');
  g.fill(26, 0, 29, H, '#');
  g.fill(21, F, 25, F + 1, '.');
  g.fill(18, TOP, 19, F - 4, '#');
  g.fill(2, TOP, 21, TOP + 2, '#');
  // up top, a short spiked gap before the exit
  g.fill(9, TOP, 12, TOP + 1, '.');
  g.fill(9, TOP + 1, 12, TOP + 2, '^');
  // the packet waits in a notch in the shaft wall, halfway up: hop off the lift to grab it
  const mid = Math.round((TOP + F) / 2);
  g.fill(26, mid - 2, 28, mid + 1, '.');
  dr.hide.push([26, mid]);
  g.fill(23, TOP - 4, 26, TOP - 3, '=');
  dr.hide.push([24, TOP - 5]);
  g.fill(3, TOP - 4, 5, TOP, 'E');
  g.set(3, F - 1, '@');
  term(dr, 5, F - 1, 'THE LIFT RUNS ON A CAPACITOR.\\nPLUG IT AND WAIT. STEP ON THE LIFT.\\nRECALL THE CABLE. RIDE.');
  dr.ents.push(
    ent({ type: 'source', x: ri(o.rnd, 10, 12), y: F - ri(o.rnd, 3, 5), id: 's1' }),
    ent({ type: 'capacitor', x: ri(o.rnd, 14, 16), y: F - ri(o.rnd, 3, 5), id: 'b1', hold: [9, 9, 10][d - 1] }),
    ent({ type: 'lift', x: 21, y: F, w: 4, toY: TOP, inputs: ['b1'] }),
  );
  return dr;
}

/**
 * Capacitor and swing together: charge the capacitor on the near side, then swing
 * across the pit before it runs out, to reach the gate it holds open.
 */
export function buildSwitch(o: BuildOpts): Draft {
  const d = o.difficulty;
  const n = d === 3 ? 3 : 2;
  const pw = d === 3 ? 24 : 18;
  const px0 = ri(o.rnd, 11, 13), F = ri(o.rnd, 13, 15), H = 26;
  const landW = ri(o.rnd, 13, 15);
  const drop = ri(o.rnd, 2, 3);
  const W = px0 + pw + landW + 2;
  const g = new Grid(W, H);
  g.box();
  const dr = draft(g);
  g.ground(2, px0, F);
  const LF = F + drop;
  g.ground(px0 + pw, W - 2, LF);
  g.fill(px0, H - 2, px0 + pw, H, '#');
  g.fill(px0, H - 3, px0 + pw, H - 2, '^');
  beam(g, px0 - 1, px0 + pw + 1, F - 4);
  for (let i = 0; i < n; i++) {
    const ax = px0 + Math.floor((pw * (i + 0.5)) / n) + ri(o.rnd, -1, 1);
    g.set(ax, F - 3, 'o');
    if (i === n - 1) pillar(g, dr, ax - 3, H - 5);
  }
  g.set(3, F - 1, '@');
  const gx = px0 + pw + ri(o.rnd, 4, 6);
  term(dr, 6, F - 1, 'POWER FIRST. THEN THE GAP.\\nCHARGE THE CAPACITOR, RECALL, THEN SWING.\\nTHE GATE CLOSES WHEN THE CHARGE RUNS OUT.');
  dr.ents.push(
    ent({ type: 'source', x: 4, y: F - 4, id: 's1' }),
    ent({ type: 'capacitor', x: 8, y: F - 4, id: 'b1', hold: 9 }),
    ent({ type: 'gate', x: gx, y: 2, h: LF - 2, inputs: ['b1'] }),
  );
  const tTop = LF - 2;
  terrace(g, gx + 3, W - 2, tTop);
  g.fill(W - 4, tTop - 4, W - 2, tTop, 'E');
  return dr;
}

// ------------------------------------------------------------------ colours

/**
 * First green. A green connector at the start; then a pit crossed on blue
 * ledges in a blue zone, a platform where the zone turns green, and a second pit
 * crossed on green ledges. The lens takes its colour where you press it, so you
 * press again on the middle platform.
 */
export function buildDuo(o: BuildOpts): Draft {
  const d = o.difficulty;
  const pw = [14, 15, 16][d - 1];
  const lw = d === 3 ? 2 : 3;
  const F = ri(o.rnd, 14, 16), H = o.safe ? F + 11 : 20;
  const p1 = ri(o.rnd, 9, 11), mid = p1 + pw, p2 = mid + ri(o.rnd, 5, 7);
  const W = p2 + pw + ri(o.rnd, 5, 7) + 2;
  const g = new Grid(W, H);
  g.box();
  const dr = draft(g);
  g.ground(2, W - 2, F);
  pit(g, p1, mid, F, o.safe);
  pit(g, p2, p2 + pw, F, o.safe);
  const nl = d === 3 ? 3 : 2;
  const ledges = (x0: number, ch: string) => {
    for (let i = 0; i < nl; i++) {
      const lx = x0 + 1 + Math.round((i * (pw - 2 - lw)) / (nl - 1));
      g.fill(lx, F, lx + lw, F + 1, ch);
    }
  };
  ledges(p1, 'B');
  ledges(p2, 'G');
  // packets hang over each pit on a high ledge of the pit's colour
  for (const [x0, ch] of [[p1, 'B'], [p2, 'G']] as const) {
    const hx = x0 + Math.floor(pw / 2) - 1;
    g.fill(hx, F - 4, hx + 2, F - 3, ch);
    dr.hide.push([hx, F - 5]);
  }
  g.set(3, F - 1, '@');
  dr.ents.push(ent({ type: 'connector', x: 7, y: F - 4, color: 'green' }));
  term(dr, 5, F - 1, o.safe
    ? 'GREEN, AT LAST. TAP {jack} TO PLUG IN.\\nTHEN HOLD {recal} IN A GREEN ZONE.\\nNO CURRENT IN THESE PITS. PRACTISE.'
    : 'GREEN, AT LAST. TAP {jack} TO PLUG IN.\\nTHEN HOLD {recal} IN A GREEN ZONE.\\nBLUE LEDGES ARE STILL A THING. SO IS BLUE.');
  term(dr, mid + 1, F - 1, 'THE ZONE CHANGES COLOUR AHEAD.\\nLET GO OF {recal}. PRESS IT AGAIN IN THE GREEN.\\nTHE LENS TAKES THE COLOUR YOU PRESS IT IN.');
  const zx = mid + 2;
  dr.zones.push(`zone blue 0 0 ${zx} ${H}`, `zone green ${zx} 0 ${W - zx} ${H}`);
  const tTop = F - 2;
  terrace(g, W - 6, W - 2, tTop);
  g.fill(W - 4, tTop - 4, W - 2, tTop, 'E');
  return dr;
}
