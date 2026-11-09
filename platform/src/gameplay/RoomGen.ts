import { parseRoom } from './AsciiRoom';
import { CARRY, RISE, checkRoom, runFor, type SolveOptions } from './RoomSolver';
export { CARRY, checkRoom, reachMap } from './RoomSolver';
import { hasAbility } from './Abilities';
import { HUES, huesInStage, type Hue } from './Colours';
import type { LevelDef, RoomDef } from './RoomData';
import { buildDuo, buildLiftRoom, buildPower, buildSwing, buildSwitch, buildTimedGate } from './RoomBuilders';
import { draft, Grid, ri, mulberry, stitch, type Draft } from './RoomKit';
export { mulberry } from './RoomKit';

/**
 * Room generator: builds a draft room around one mechanic (Celeste style: introduce
 * it, push it, then twist it), then checks with a reachability solver that the exit
 * can be reached with Pix's moves. Drafts are meant to be played, then hand-edited.
 */
/** `true`: hidden ledges in a room-wide colour zone. `carry`: the zone is only at the start; press there and carry the colour out. */
export type Focus = 'gap' | 'fling' | 'zip' | 'wall' | 'true' | 'carry' | 'planks' | 'swing' | 'power' | 'capacitor' | 'duo';
export const FOCI: Focus[] = ['gap', 'fling', 'zip', 'wall', 'true', 'carry', 'planks', 'swing', 'power', 'capacitor', 'duo'];
export type Flow = 'right' | 'up';

/** What Pix can do at a stage: the generator never uses a locked mechanic. */
export interface StageProfile { stage: number; swing: boolean; power: boolean; hues: Hue[]; white: boolean }

export function stageProfile(stage: number): StageProfile {
  return { stage, swing: hasAbility(stage, 'swing'), power: hasAbility(stage, 'power'), hues: huesInStage(stage), white: stage >= 4 };
}

/** Whether a focus can be used at a stage. */
export function focusAllowed(f: Focus, p: StageProfile): boolean {
  switch (f) {
    case 'fling': case 'swing': return p.swing;
    case 'power': case 'capacitor': return p.power;
    case 'true': case 'carry': return p.hues.length >= 1;
    case 'duo': return p.hues.length >= 2;
    default: return true;
  }
}

export interface GenOptions {
  seed: number;
  focus?: Focus;
  /** Mechanic mixed into the last beat. */
  twist?: Focus;
  /** A second room stitched onto the first, to make one longer two-beat room. */
  combo?: Focus;
  difficulty?: 1 | 2 | 3;
  flow?: Flow;
  id?: string;
  name?: string;
  /** Hide a lost packet somewhere off the main path. */
  packet?: boolean;
  /** Return the first draft even if the solver can't finish it (for debugging). */
  unchecked?: boolean;
  /** Colour of hidden ledges and zones. Default blue. */
  hue?: Hue;
  /** A practice room: no spikes in the pits (see RoomBuilders). */
  safe?: boolean;
  /** Pix has the white lens (stage 4+): hidden ledges count anywhere. */
  white?: boolean;
  /** Generate for this stage: locked mechanics are refused, and the solver only allows its moves. */
  stage?: number;
  /** Skip the check that the focus mechanic is really needed. */
  anyRoute?: boolean;
  bg?: string;
}

export interface GenResult {
  room: RoomDef;
  text: string;
  seed: number;
  attempts: number;
}

// ------------------------------------------------------------------ movement model
// In tiles, from tuning: a jump rises ~3.6, a double jump ~6.4; running jumps carry
// ~6 tiles, ~10 with a dash. The solver stays a little under these.
const GLYPH: Record<Hue, string> = { blue: 'B', green: 'G', red: 'R' };

// ------------------------------------------------------------------ grid building

const HINT: Record<Focus, string> = {
  swing: 'HOLD {jack} AT A BLUE PORT TO HANG.',
  power: 'PLUG THE SOURCE, THEN THE CONSUMER.',
  capacitor: 'A CAPACITOR HOLDS POWER AFTER YOU UNPLUG IT.',
  duo: 'THE LENS TAKES THE COLOUR YOU PRESS IT IN.',
  gap: 'MIND THE GAP.\\nJUMP, THEN JUMP AGAIN IN THE AIR.\\n{dash} IF YOU NEED THE EXTRA PIXELS.',
  fling: 'NO FLOOR. ONE PORT.\\nTAP {jack} AT IT TO FLING YOURSELF OVER.\\nAIM WITH THE ARROWS.',
  zip: 'LEDGE TOO HIGH?\\nTAP {jack} AT THE GREEN PORT.\\nIT PULLS. YOU ARRIVE.',
  wall: 'A CHIMNEY. WALLS ARE STICKY.\\nJUMP FROM WALL TO WALL.\\nUP IS THE ONLY WAY.',
  true: 'THIS ROOM IS A COLOUR ZONE.\\nHOLD {recal} TO SEE ITS HIDDEN LEDGES.\\nIT ONLY LASTS A FEW SECONDS.',
  carry: 'THE COLOUR ZONE ENDS HERE.\\nPRESS {recal} INSIDE IT, THEN KEEP HOLDING.\\nYOU CARRY THE COLOUR WITH YOU.',
  planks: 'PLANKS. YOU CAN JUMP UP THROUGH THEM.\\n{down}+{jump} DROPS BACK DOWN.\\nTHEY ARE VERY UNDERSTANDING.',
};

interface Ctx {
  g: Grid;
  rnd: () => number;
  x: number;
  fy: number;
  minFy: number;
  maxFy: number;
  /** Cells where a packet could hide. */
  hide: [number, number][];
  hue: Hue;
}


/** Each beat starts at ctx.x on a floor at ctx.fy and ends on a landing platform. */
function beat(ctx: Ctx, f: Focus, d: number): void {
  const { g, rnd } = ctx;
  const land = (w: number, dy = 0) => {
    ctx.fy = Math.max(ctx.minFy, Math.min(ctx.maxFy, ctx.fy + dy));
    g.ground(ctx.x, ctx.x + w, ctx.fy);
    ctx.x += w;
  };
  const pit = (w: number, spikes: boolean) => {
    if (spikes) { g.ground(ctx.x, ctx.x + w, g.h - 1); g.fill(ctx.x, g.h - 2, ctx.x + w, g.h - 1, '^'); }
    ctx.x += w;
  };
  switch (f) {
    case 'gap': {
      for (let i = 0; i < (d >= 2 ? 2 : 1); i++) {
        pit([3, 5, 6][d - 1] + ri(rnd, 0, 1), rnd() < 0.5);
        land(ri(rnd, 2, 3), ri(rnd, -1, 1));
      }
      break;
    }
    case 'fling': {
      const w = [14, 15, 15][d - 1];
      const fy = ctx.fy;
      pit(w, rnd() < 0.6);
      const ax = ctx.x - Math.ceil(w / 2);
      g.set(ax, Math.max(2, fy - 4), 'o');
      ctx.hide.push([ax, Math.max(2, fy - 9)]);
      land(3, ri(rnd, -2, 0));
      break;
    }
    case 'zip': {
      land(3);
      const rise = [12, 13, 14][d - 1];
      const top = Math.max(ctx.minFy, ctx.fy - rise);
      g.ground(ctx.x, ctx.x + 4, top);
      g.set(ctx.x - 1, ctx.fy - 9, 'P');
      ctx.hide.push([ctx.x + 1, top - 4]);
      ctx.x += 4;
      ctx.fy = top;
      break;
    }
    case 'wall': {
      // walk in under a hanging pillar, wall-jump up the shaft, out onto the ledge
      const rise = [12, 13, 14][d - 1];
      const top = Math.max(ctx.minFy, ctx.fy - rise);
      const fy = ctx.fy;
      g.ground(ctx.x, ctx.x + 6, fy);
      g.fill(ctx.x + 1, top - 1, ctx.x + 3, fy - 2, '#');
      g.ground(ctx.x + 6, ctx.x + 9, top);
      ctx.hide.push([ctx.x + 4, top - 5]);
      ctx.x += 9;
      ctx.fy = top;
      break;
    }
    case 'true':
    case 'carry': {
      const n = [2, 3, 3][d - 1];
      const fy = ctx.fy;
      for (let i = 0; i < n; i++) {
        const gap = ri(rnd, 2, 3);
        ctx.x += gap;
        const ch = d >= 2 && i % 2 === 1 ? 'n' : GLYPH[ctx.hue];
        g.fill(ctx.x, fy, ctx.x + 3, fy + 1, ch);
        ctx.x += 3;
      }
      ctx.x += ri(rnd, 2, 3);
      ctx.hide.push([ctx.x - 4, fy - 6]);
      land(3, ri(rnd, -1, 1));
      break;
    }
    case 'planks': {
      const n = [2, 3, 4][d - 1];
      let y = ctx.fy;
      for (let i = 0; i < n; i++) {
        ctx.x += ri(rnd, 1, 2);
        y = Math.max(ctx.minFy, y - ri(rnd, 2, 3));
        g.fill(ctx.x, y, ctx.x + 3, y + 1, '=');
        ctx.x += 3;
      }
      ctx.hide.push([ctx.x - 2, y - 5]);
      ctx.x += 1;
      ctx.fy = Math.min(ctx.maxFy, y + 1);
      land(3);
      break;
    }
  }
}

/** Rough width a beat needs, to plan the room. */
const WIDTH: Record<Focus, number> = { gap: 9, fling: 19, zip: 8, wall: 9, true: 16, carry: 16, planks: 15, swing: 16, power: 20, capacitor: 20, duo: 20 };

function buildRight(opts: Required<Pick<GenOptions, 'focus' | 'difficulty'>> & GenOptions, rnd: () => number): Grid {
  const W = 40, H = 24;
  const g = new Grid(W, H);
  g.fill(0, 0, 2, H, '#');
  g.fill(W - 2, 0, W, H, '#');
  g.fill(0, 0, W, 1, '#');
  // climbing beats start low so there is height to climb
  const climbs = opts.focus === 'wall' || opts.focus === 'zip';
  const ctx: Ctx = { g, rnd, x: 2, fy: climbs ? 21 : ri(rnd, 17, 20), minFy: 3, maxFy: 21, hide: [], hue: opts.hue ?? 'blue' };
  g.ground(2, 7, ctx.fy);
  g.set(3, ctx.fy - 1, '@');
  g.set(5, ctx.fy - 1, '?');
  ctx.x = 7;
  // introduce, push, twist: as many beats as fit
  const plan: [Focus, number][] = [[opts.focus, 1], [opts.focus, Math.min(3, opts.difficulty + 1)]];
  if (opts.twist) plan.push([opts.twist, opts.difficulty]);
  else plan.push([opts.focus, opts.difficulty]);
  for (const [f, d] of plan) {
    if (ctx.x + WIDTH[f] > W - 6) continue;
    beat(ctx, f, Math.max(1, Math.min(3, d)) as 1 | 2 | 3);
    if (ctx.x < W - 6 && rnd() < 0.5) {
      g.ground(ctx.x, ctx.x + 2, ctx.fy);
      ctx.x += 2;
    }
  }
  // the end platform runs into the right wall, which opens up as the exit
  g.ground(ctx.x, W - 2, ctx.fy);
  g.fill(W - 2, ctx.fy - 4, W, ctx.fy, 'E');
  hideSpots = ctx.hide;
  zonesOut = lensZones(opts, W, H, 9);
  return g;
}

/** Candidate packet spots from the last build, off the main path. */
let hideSpots: [number, number][] = [];
/** Zone lines for the last build. */
let zonesOut: string[] = [];

/** A lens room gets a zone: the whole room for `true`, just the start for `carry`. */
function lensZones(opts: GenOptions, W: number, H: number, startW: number, startFromBottom = false): string[] {
  const uses = [opts.focus, opts.twist].some((f) => f === 'true' || f === 'carry');
  if (!uses) return [];
  const hue = opts.hue ?? 'blue';
  if (opts.focus === 'carry') return [startFromBottom ? `zone ${hue} 0 ${H - startW} ${W} ${startW}` : `zone ${hue} 0 0 ${startW} ${H}`];
  return [`zone ${hue} 0 0 ${W} ${H}`];
}

function buildUp(opts: Required<Pick<GenOptions, 'focus' | 'difficulty'>> & GenOptions, rnd: () => number): Grid {
  if (opts.focus === 'wall') return buildChimney(opts, rnd);
  const W = 24, H = 46;
  const g = new Grid(W, H);
  g.fill(0, 0, 2, H, '#');
  g.fill(W - 2, 0, W, H, '#');
  g.fill(0, H - 2, W, H, '#');
  // the ceiling, with a hatch in it for the exit
  g.fill(0, 0, W, 2, '#');
  let side = rnd() < 0.5 ? 0 : 1;
  let y = H - 3;
  const ledge = (s: number, yy: number) => (s === 0 ? g.fill(2, yy, 10, yy + 1, '#') : g.fill(W - 10, yy, W - 2, yy + 1, '#'));
  g.set(side === 0 ? 3 : W - 4, y, '@');
  g.set(side === 0 ? 5 : W - 6, y, '?');
  const hide: [number, number][] = [];
  // a carried colour only lasts ~22 tiles from its zone, so carry rooms climb on it twice, then plainly
  const beats: Focus[] = opts.focus === 'carry' ? ['carry', 'carry', 'planks', 'gap'] : [opts.focus, opts.focus, opts.twist ?? opts.focus, opts.focus];
  let i = 0;
  while (y > 9) {
    const f = beats[i % beats.length];
    const d = Math.min(3, 1 + Math.floor(i / 1.5));
    const forced = f === 'zip' || f === 'wall' || f === 'fling' || f === 'true' || f === 'carry';
    const rise = (forced ? [12, 13, 14][d - 1] : f === 'planks' ? 5 : 4) + (forced ? 0 : ri(rnd, 0, 1));
    const ny = Math.max(6, y - rise);
    const nside = 1 - side;
    const mid = Math.floor(W / 2);
    switch (f) {
      case 'zip': g.set(mid, y - 9, 'P'); break;
      case 'fling': g.set(mid, y - 8, 'o'); hide.push([mid, y - 12]); break;
      case 'true':
      case 'carry': g.fill(mid - 1, y - 6, mid + 2, y - 5, GLYPH[opts.hue ?? 'blue']); break;
      case 'planks': g.fill(mid - 2, y - 3, mid + 2, y - 2, '='); break;
      case 'wall': g.fill(mid - 1, ny + 1, mid + 1, y - 2, '#'); break;
      case 'gap': break;
    }
    ledge(nside, ny + 1);
    hide.push([nside === 0 ? 3 : W - 4, ny - 4]);
    side = nside;
    y = ny;
    i++;
  }
  // last climb to the hatch
  const hx = side === 0 ? 4 : W - 8;
  g.fill(hx, 0, hx + 4, 2, 'E');
  if (y - 2 > 3) g.fill(hx, y - 3, hx + 4, y - 2, '=');
  hideSpots = hide;
  zonesOut = lensZones(opts, W, H, 14, true);
  return g;
}

/** A vertical wall-jump room: the whole room is a shaft, with plank rest stops. */
function buildChimney(opts: Required<Pick<GenOptions, 'focus' | 'difficulty'>> & GenOptions, rnd: () => number): Grid {
  const W = 8, H = 34;
  const g = new Grid(W, H);
  g.fill(0, 0, 2, H, '#');
  g.fill(W - 2, 0, W, H, '#');
  g.fill(0, H - 2, W, H, '#');
  g.fill(0, 0, W, 2, '#');
  g.set(3, H - 3, '@');
  g.set(5, H - 3, '?');
  const hide: [number, number][] = [];
  // rest stops get rarer with difficulty
  const every = [12, 13, 14][opts.difficulty - 1];
  for (let y = H - 3 - every; y > 5; y -= every + ri(rnd, -1, 1)) {
    if (rnd() < 0.5) g.fill(2, y, 4, y + 1, '=');
    else g.fill(4, y, 6, y + 1, '=');
    hide.push([ri(rnd, 2, 5), y - 2]);
  }
  g.fill(2, 0, 6, 2, 'E');
  hideSpots = hide;
  zonesOut = [];
  return g;
}

// ------------------------------------------------------------------ text

export function gridToText(rows: string[], head: { id: string; name: string; tagline: string; bg: string }, tail: string[], comment?: string): string {
  return [comment ?? '// generated room', `id ${head.id}`, `name ${head.name}`, `tagline ${head.tagline}`, `bg ${head.bg}`, 'map', ...rows, 'end', ...tail].join('\n') + '\n';
}

// ------------------------------------------------------------------ solver

// ------------------------------------------------------------------ entry point

/** Mechanic to switch off to prove a focus is required, if it has one. */
const REQUIRES: Partial<Record<Focus, 'anchor' | 'pull' | 'wall' | 'colour' | 'power'>> = {
  swing: 'anchor', fling: 'anchor', zip: 'pull', wall: 'wall', true: 'colour', carry: 'colour', duo: 'colour', power: 'power', capacitor: 'power',
};

/** One focus's draft (no combo), used on its own or as a half of a combo. */
function buildOne(focus: Focus, o: GenOptions & { difficulty: 1 | 2 | 3 }, rnd: () => number): Draft {
  const bo = { difficulty: o.difficulty, hue: o.hue, safe: o.safe, rnd };
  switch (focus) {
    case 'swing': return buildSwing(bo);
    case 'power': return buildPower(bo);
    case 'capacitor': return o.twist === 'swing' ? buildSwitch(bo) : o.flow === 'up' ? buildLiftRoom(bo) : buildTimedGate(bo);
    case 'duo': return buildDuo(bo);
    default: {
      hideSpots = [];
      zonesOut = [];
      const g = o.flow === 'up' ? buildUp({ ...o, focus }, rnd) : buildRight({ ...o, focus }, rnd);
      const dr = draft(g);
      dr.zones = zonesOut;
      dr.hide = hideSpots;
      return dr;
    }
  }
}

/** Ask the right builder for a draft. A `combo` focus stitches a second room onto the first. */
function build(o: GenOptions & { focus: Focus; difficulty: 1 | 2 | 3 }, rnd: () => number): Draft {
  if (o.combo) return stitch(buildOne(o.focus, o, rnd), buildOne(o.combo, o, rnd));
  const bo = { difficulty: o.difficulty, hue: o.hue, safe: o.safe, rnd };
  switch (o.focus) {
    case 'swing': return buildSwing(bo);
    case 'power': return buildPower(bo);
    case 'capacitor': return o.twist === 'swing' ? buildSwitch(bo) : o.flow === 'up' ? buildLiftRoom(bo) : buildTimedGate(bo);
    case 'duo': return buildDuo(bo);
    default: {
      hideSpots = [];
      zonesOut = [];
      const g = o.flow === 'up' ? buildUp(o, rnd) : buildRight(o, rnd);
      const dr = draft(g);
      dr.zones = zonesOut;
      dr.hide = hideSpots;
      return dr;
    }
  }
}

function solveOptions(o: GenOptions): SolveOptions {
  if (o.stage === undefined) return { white: o.white, swing: true };
  const p = stageProfile(o.stage);
  return { white: o.white ?? p.white, swing: p.swing };
}

export function generateRoom(o: GenOptions): GenResult {
  const focus = o.focus ?? 'gap';
  const difficulty = o.difficulty ?? 2;
  const flow = o.flow ?? 'right';
  if (o.stage !== undefined) {
    const p = stageProfile(o.stage);
    for (const f of [focus, o.twist, o.combo]) if (f && !focusAllowed(f, p)) throw new Error(`RoomGen: '${f}' isn't unlocked in stage ${o.stage}`);
  }
  // each mechanic the room is built around has to be genuinely needed (the solver proves it by
  // failing when that mechanic is switched off)
  const needs = [REQUIRES[focus], o.combo ? REQUIRES[o.combo] : undefined].filter((x): x is NonNullable<typeof x> => !!x);
  const need = needs[0];
  const solve = solveOptions(o);
  for (let attempt = 1; attempt <= 60; attempt++) {
    const seed = (o.seed + (attempt - 1) * 7919) >>> 0;
    const rnd = mulberry(seed);
    const dr = build({ ...o, focus, difficulty, flow }, rnd);
    const g = dr.grid;
    const id = o.id ?? `gen-${focus}-${seed}`;
    const name = o.name ?? `GEN ${focus.toUpperCase()}${o.twist ? '+' + o.twist.toUpperCase() : ''} #${seed}`;
    const indoor = flow === 'up' || ['power', 'capacitor'].includes(focus) || (o.combo ? ['power', 'capacitor'].includes(o.combo) : false);
    const make = () => {
      const texts = dr.terms.length
        ? [...dr.terms].sort((a, b) => a.y - b.y || a.x - b.x).map((t) => `text ${t.text}`)
        : [`text ${HINT[focus]}`];
      const text = gridToText(g.rows(), { id, name, tagline: `generated: ${flow}, ${focus}, difficulty ${difficulty}`, bg: o.bg ?? (indoor ? 'hall' : 'city') },
        [...texts, ...dr.zones, ...dr.ents.map((e) => (e.startsWith('entity') ? e : `entity ${e}`))],
        `// generated by RoomGen: seed ${seed}, focus ${focus}${o.twist ? ', twist ' + o.twist : ''}, difficulty ${difficulty}, flow ${flow}`);
      return { text, room: parseRoom(text) };
    };
    let { text, room } = make();
    if (!o.unchecked) {
      if (!checkRoom(room, solve).ok) continue;
      // each focus has to be needed: with its mechanic switched off, the room mustn't be finishable
      if (!o.anyRoute && needs.some((m) => checkRoom(room, { ...solve, disable: [m] }).ok)) continue;
    }
    if (o.packet) {
      // try the hiding spots until one is reachable and the way on is still open from it. Prefer
      // a spot that's off the beaten path: one you can't stroll back to from the exit without
      // the room's mechanic. A room without a packet is still fine.
      const spots = [...dr.hide].sort(() => rnd() - 0.5);
      const [ex, ey, , eh] = room.exit;
      const fromExit = { ...solve, disable: need ? [need] : [] };
      for (const strict of [true, false]) {
        let placed = false;
        for (const [x, y] of spots) {
          if (y < 2 || g.get(x, y) !== '.') continue;
          g.set(x, y, '*');
          const next = make();
          const fine = checkRoom(next.room, solve).packetsReached === 1 && checkRoom({ ...next.room, spawn: [x, y] }, solve).ok
            && (!strict || checkRoom({ ...next.room, spawn: [ex, ey + eh - 1] }, fromExit).packetsReached === 0);
          if (fine) { ({ text, room } = next); placed = true; break; }
          g.set(x, y, '.');
        }
        if (placed) break;
      }
    }
    return { room, text, seed, attempts: attempt };
  }
  throw new Error(`RoomGen: no solvable room for ${JSON.stringify(o)} after 60 attempts`);
}

// ------------------------------------------------------------------ measuring and stages

/** Rough numbers about a room, for comparing drafts. */
export interface Measure { width: number; height: number; pit: number; anchors: number; gates: number; lifts: number; hidden: number }

export function measure(room: RoomDef): Measure {
  const count = (t: string) => room.entities.filter((e) => e.type === t).length;
  return {
    width: room.width,
    height: room.height,
    pit: Math.max(0, ...room.spikes.map(([, , w]) => w)),
    anchors: count('anchor') + count('pull'),
    gates: count('gate'),
    lifts: count('lift'),
    hidden: room.true.length,
  };
}

/** A single number for how demanding a draft is; higher is harder. */
export function score(room: RoomDef): number {
  const m = measure(room);
  return Math.round((m.pit * 0.4 + m.anchors * 0.8 + m.gates * 1.5 + m.lifts + m.hidden * 0.5 + (m.width + m.height) / 14) * 10) / 10;
}

export interface PlanStep { focus: Focus; twist?: Focus; combo?: Focus; difficulty: 1 | 2 | 3; flow?: Flow; hue?: Hue; safe?: boolean }

/**
 * Each stage as a run of teaching beats. Rooms are kept few and dense: most beats combine two
 * mechanics into one longer room (`combo`), rather than one mechanic per short room.
 */
export const STAGE_PLANS: Record<number, PlanStep[]> = {
  1: [
    { focus: 'gap', difficulty: 1 }, { focus: 'gap', difficulty: 2 }, { focus: 'zip', difficulty: 2, flow: 'up' },
    { focus: 'planks', difficulty: 2 }, { focus: 'wall', difficulty: 2, flow: 'up' }, { focus: 'carry', difficulty: 2 },
  ],
  // practice first (spike-free), two mechanics per room, then the real combined rooms, then the boss:
  // swing+power, then capacitor+green (both soft); then swing-for-real, lift+two-tone; switchboard; long swing
  2: [
    { focus: 'swing', combo: 'power', difficulty: 1, safe: true },
    { focus: 'capacitor', combo: 'duo', difficulty: 1, safe: true },
    { focus: 'swing', difficulty: 2 },
    { focus: 'capacitor', combo: 'duo', difficulty: 2, flow: 'up' },
    { focus: 'capacitor', twist: 'swing', difficulty: 2 },
    { focus: 'swing', difficulty: 3 },
  ],
};

export interface StageRoom { step: PlanStep; result: GenResult; score: number; picked: number; candidates: { seed: number; score: number }[] }

/**
 * Draft a whole stage: for each beat, make several candidates and keep the one
 * whose score is closest to the beat's target, so the stage ramps up.
 */
export function generateStage(stage: number, seed: number, candidates = 6): StageRoom[] {
  const plan = STAGE_PLANS[stage];
  if (!plan) throw new Error(`RoomGen: no plan for stage ${stage}`);
  return plan.map((step, i) => {
    const target = 4 + 3 * step.difficulty + (i === plan.length - 1 ? 2 : 0);
    const cands: { result: GenResult; score: number }[] = [];
    for (let k = 0; k < candidates; k++) {
      try {
        const result = generateRoom({ ...step, stage, seed: seed + i * 1009 + k * 131, packet: true, id: `s${stage}-${i + 1}`, name: `${stage}-${i + 1} ${step.focus.toUpperCase()}${step.twist ? '+' + step.twist.toUpperCase() : ''}` });
        cands.push({ result, score: score(result.room) });
      } catch { /* no solvable room for this seed; try the next */ }
    }
    if (!cands.length) throw new Error(`RoomGen: stage ${stage} step ${i + 1} (${step.focus}) produced no room`);
    cands.sort((a, b) => Math.abs(a.score - target) - Math.abs(b.score - target));
    return { step, result: cands[0].result, score: cands[0].score, picked: cands[0].result.seed, candidates: cands.map((c) => ({ seed: c.result.seed, score: c.score })) };
  });
}

/**
 * A playable run of generated rooms, for trying drafts in the game:
 * `?gen=<seed>&focus=<focus>&diff=<1-3>&flow=<right|up>&hue=<blue|green|red>`, or
 * `?gen=<seed>&stage=<n>` for a whole stage. Without a focus it cycles through every mechanic.
 */
const levelCache = new Map<string, LevelDef>();

export function generatedLevel(o: { seed: number; focus?: Focus; difficulty?: 1 | 2 | 3; flow?: Flow; hue?: Hue; count?: number; stage?: number }): LevelDef {
  const key = JSON.stringify(o);
  const hit = levelCache.get(key);
  if (hit) return hit;
  let rooms: RoomDef[];
  if (o.stage !== undefined && !o.focus) {
    rooms = generateStage(o.stage, o.seed).map((r) => r.result.room);
  } else {
    const pool = o.stage !== undefined ? FOCI.filter((f) => focusAllowed(f, stageProfile(o.stage!))) : FOCI.filter((f) => !['swing', 'power', 'capacitor', 'duo'].includes(f));
    rooms = [];
    for (let i = 0; i < (o.count ?? 10); i++) {
      const focus = o.focus ?? pool[i % pool.length];
      const flow = o.flow ?? (i % 3 === 2 ? 'up' : 'right');
      rooms.push(generateRoom({ seed: o.seed + i * 97, focus, stage: o.stage, difficulty: o.difficulty ?? (1 + Math.min(2, Math.floor(i / 4))) as 1 | 2 | 3, flow, hue: o.hue, packet: true, id: `gen-${i + 1}`, name: `G-${i + 1} ${focus.toUpperCase()}` }).room);
    }
  }
  const level: LevelDef = { id: 'gen', name: 'GENERATED ROOMS', tag: 'G-', device: 'modem', rooms };
  levelCache.set(key, level);
  return level;
}
