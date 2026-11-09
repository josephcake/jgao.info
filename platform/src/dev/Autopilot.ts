/**
 * Dev-only autopilot: plays a room through the same debug input the game reads
 * (`window.__dbg`), to check by actually playing that a room can be finished.
 *
 *   await __bot.room(3)        // play room 4 of the current level
 *   await __bot.level()        // play every room of the current level, return a report
 *
 * It recognises a room by what's in it (anchors over a pit, a power airlock, a
 * capacitor lift, colour ledges, ...) and runs the matching routine. It's a
 * crude player, so a failure means "look at this room", not "this room is broken".
 */
import type { GameScene } from '../scenes/GameScene';
import type { EntityDef } from '../gameplay/RoomData';

type W = Window & { __game?: GameScene; __dbg?: Record<string, unknown> | null; __bot?: unknown };
const win = window as unknown as W;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const G = () => win.__game!;
/**
 * Replace the held inputs. Taps queued in `press` survive until the game reads them,
 * so a tap isn't wiped by the next loop tick before a frame has seen it.
 */
const set = (d: Record<string, unknown> = {}) => {
  const prev = (win.__dbg?.press as string[] | undefined) ?? [];
  const add = (d.press as string[] | undefined) ?? [];
  win.__dbg = { ...d, press: [...prev, ...add.filter((k) => !prev.includes(k))] };
};

export interface RoomReport { room: string; kind: string; ok: boolean; note: string; ms: number; trace?: string[]; marks?: string[] }

/** The last few samples of what the bot saw, kept for the failure report. */
let trace: string[] = [];
let marks: string[] = [];
/** Log a routine step (kept separately from the movement trace). */
const mark = (g: GameScene, label: string) => marks.push(`${label}@${(g.player.cx / g.tile).toFixed(1)},${(g.player.cy / g.tile).toFixed(1)}`);
let lastSample = 0;
function sample(g: GameScene, extra = ''): void {
  if (Date.now() - lastSample < 120) return;
  lastSample = Date.now();
  const p = g.player, t = g.tile;
  const a = g.cable.aimTarget ? ` aim(${(g.cable.aimTarget.x / t).toFixed(0)},${(g.cable.aimTarget.y / t).toFixed(0)})` : '';
  trace.push(`${g.cable.state} x${(p.cx / t).toFixed(1)} y${(p.cy / t).toFixed(1)} v${Math.round(p.vx)},${Math.round(p.vy)}${p.onGround ? ' G' : ''}${a} ${extra}`);
  if (trace.length > 30) trace.shift();
}

/** Wait until `cond` or the timeout; true if it held. */
async function until(cond: () => boolean, ms: number, step = 25): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) return true;
    await sleep(step);
  }
  return cond();
}

async function load(index: number): Promise<GameScene> {
  const g0 = G();
  const old = g0.player;
  g0.scene.restart({ level: g0.levelIndex, room: index });
  // Phaser reuses the scene object, so a restart shows up as a new player
  await until(() => !!G().player && G().player !== old && !!G().cable && G().roomIndex === index, 8000, 50);
  await sleep(1200);
  return G();
}

const done = (g: GameScene, index: number) => g.transitioning || G().roomIndex !== index;

/** Aim at an entity from where Pix stands and tap jack once. */
async function jackAt(g: GameScene, e: EntityDef): Promise<void> {
  const t = g.tile, p = g.player;
  const dx = e.x * t + t / 2 - p.cx, dy = e.y * t + t / 2 - p.cy;
  set({ move: Math.abs(dx) > t ? Math.sign(dx) : 0, up: dy < -t, press: ['jack'] });
  await sleep(60);
  set();
}

/** Walk to a tile column. */
async function walkTo(g: GameScene, tx: number, ms = 6000): Promise<void> {
  const p = g.player, t = g.tile, dir = tx * t > p.cx ? 1 : -1;
  set({ move: dir });
  await until(() => { sample(g, `walk ${tx}`); return (dir > 0 ? p.cx >= tx * t : p.cx <= tx * t) || p.dead; }, ms, 20);
  set();
}

const groundAtG = (g: GameScene, x: number, y: number) => g.solids.some((s) => s.active && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);

/** Head for the exit, jumping up steps and over gaps on the way; true once the room is done. */
async function onward(g: GameScene, index: number, dir: 1 | -1, ms = 12000, stopX?: number): Promise<boolean> {
  const p = g.player, t = g.tile;
  let stuck = 0, hold = 0, doubled = false;
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(25);
    if (done(g, index)) return true;
    if (p.dead) return false;
    if (stopX !== undefined && p.onGround && (dir > 0 ? p.cx > stopX * t : p.cx < stopX * t)) { set(); return false; }
    sample(g, 'onward');
    stuck = p.onGround && Math.abs(p.vx) < 20 ? stuck + 1 : 0;
    const gap = p.onGround && !groundAtG(g, p.cx + dir * t, p.y + p.h + 6);
    // spikes on the row Pix is standing on, a couple of tiles ahead: jump them
    const feet = Math.round((p.y + p.h) / t) - 1, tx = p.cx / t;
    const spikeAhead = g.room.spikes.some(([sx, sy, sw]) => sy >= feet && sy <= feet + 1 && (dir > 0 ? sx - tx < 2.2 && sx + sw > tx : tx - (sx + sw) < 2.2 && sx < tx));
    if (p.onGround) doubled = false;
    if (stuck > 3 || gap || (spikeAhead && p.onGround)) hold = 14;
    const twice = !p.onGround && spikeAhead && p.vy > 150 && !doubled;
    if (twice) doubled = true;
    set({ move: dir, jumpHeld: hold-- > 0, press: hold === 13 || twice ? ['jump'] : [] });
  }
  return done(g, index);
}

/** Plug the source, then the circuit's consumer/capacitor, from a spot between them. */
async function plug(g: GameScene, target: EntityDef): Promise<void> {
  const src = g.room.entities.find((e) => e.type === 'source')!;
  await walkTo(g, Math.round((src.x + target.x) / 2));
  await sleep(300);
  await jackAt(g, src);
  await sleep(700);
  await jackAt(g, target);
}

// ------------------------------------------------------------------ swing

/** Swing across the pit anchor by anchor, letting go on the rising side and landing on the far platform. */
async function swingAcross(g: GameScene, index: number): Promise<boolean> {
  const t = g.tile, p = g.player;
  const anchors = g.room.entities.filter((e) => e.type === 'anchor').sort((a, b) => a.x - b.x);
  const sp = g.room.spikes[0];
  const edgeX = (sp[0] - 0.5) * t, landX = (sp[0] + sp[2] + 0.5) * t;
  await walkTo(g, edgeX / t - 0.3);
  let i = 0, released = false, wasSwing = false, shot = false;
  set({ move: 1, press: ['jack'], jackHeld: true });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    await sleep(25);
    if (done(g, index)) return true;
    sample(g, `i${i}${released ? ' rel' : ''}`);
    const s = g.cable.state;
    if (s === 'swing') {
      shot = false;
      if (!wasSwing) { wasSwing = true; released = false; }
      const last = i >= anchors.length - 1;
      const a = anchors[Math.min(i, anchors.length - 1)];
      // on the last rope, let go over the landing, or early if Pix is already up near the anchor's height
      const high = p.cx > a.x * t + 3 * t && p.vy < 0 && p.cy < (a.y + 3) * t;
      const trigger = last ? p.cx > landX - 0.5 * t || high : p.cx > a.x * t + 3 * t;
      if (!released && trigger && p.vx > 150) { released = true; i++; set({ move: 1, jackHeld: false, press: ['jump'] }); }
      else if (!released) set({ move: Math.sign(p.vx) || 1, jackHeld: true }); // pump the way you're travelling
    } else {
      wasSwing = false;
      if (released && i < anchors.length) {
        // tap jack once when the next anchor is in sight, then hold
        if (g.cable.aimTarget && (s === 'idle' || s === 'retract') && !shot) { shot = true; set({ move: 1, jackHeld: true, press: ['jack'] }); }
        else set({ move: 1, jackHeld: shot });
      } else if (released && p.onGround && p.cx > landX) return onward(g, index, 1);
      else if (released) set({ move: 1 });
      if (p.y > g.roomH - 5 * t) return false;
    }
  }
  return false;
}

// ------------------------------------------------------------------ routines

async function airlock(g: GameScene, index: number): Promise<boolean> {
  const t = g.tile, p = g.player;
  const con = g.room.entities.find((e) => e.type === 'consumer')!;
  const gates = g.room.entities.filter((e) => e.type === 'gate').sort((a, b) => a.x - b.x);
  await plug(g, con);
  await sleep(900);
  await walkTo(g, (gates[0].x + gates[1].x) / 2);
  await sleep(300);
  set({ press: ['jack'] });
  await sleep(80);
  set({});
  await sleep(900);
  void t;
  return onward(g, index, 1);
}

async function liftRide(g: GameScene, index: number): Promise<boolean> {
  const t = g.tile, p = g.player;
  const cap = g.room.entities.find((e) => e.type === 'capacitor')!;
  const lift = g.room.entities.find((e) => e.type === 'lift')!;
  await plug(g, cap);
  await sleep(1800);
  await walkTo(g, lift.x + 1.5);
  await sleep(200);
  set({ press: ['jack'] });
  await sleep(80);
  set();
  await until(() => p.y < lift.toY! * t - 10 && p.onGround, 15000, 100);
  return onward(g, index, -1);
}

async function colourRun(g: GameScene, index: number): Promise<boolean> {
  const t = g.tile, p = g.player;
  const conn = g.room.entities.find((e) => e.type === 'connector');
  if (conn && !g.owned.includes(conn.color as never)) { await jackAt(g, conn); await sleep(3500); }
  // each pit and the colour of the hidden ledges inside it
  const pits: { x0: number; x1: number; hue: string | undefined }[] = [];
  for (const hue of ['blue', 'green', 'red']) {
    const ls = g.room.true.filter((_, i) => (g.room.trueColor?.[i] ?? 'blue') === hue);
    if (ls.length) pits.push({ x0: Math.min(...ls.map((l) => l[0])) - 1, x1: Math.max(...ls.map((l) => l[0] + l[2])) + 1, hue });
  }
  const groundAt = (x: number, y: number) => groundAtG(g, x, y);
  let doubled = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    await sleep(25);
    if (done(g, index)) return true;
    sample(g, `lens:${g.lens}`);
    if (p.dead) return false;
    const tx = p.cx / t;
    if (p.onGround && tx > Math.max(...pits.map((q) => q.x1)) + 0.3) return onward(g, index, 1);
    const pit = pits.find((q) => tx > q.x0 - 3 && tx < q.x1 + 0.5);
    // press the lens once Pix is in a zone of the colour this pit's ledges need, then keep holding
    const zoneHere = [...(g.room.zones ?? [])].reverse().find((z) => tx >= z.x && tx < z.x + z.w && p.cy / t >= z.y && p.cy / t < z.y + z.h)?.color;
    const holding = g.lens !== null && g.lens === pit?.hue;
    const d: Record<string, unknown> = { move: 1, recalHeld: !!pit && (holding || zoneHere === pit.hue) };
    if (p.onGround && !groundAt(p.cx + 1.0 * t, p.y + p.h + 6)) { d.press = ['jump']; doubled = false; }
    else if (!p.onGround && p.vy > 350 && !doubled && !groundAt(p.cx + 0.6 * t, p.y + p.h + 30)) { d.press = ['jump']; doubled = true; }
    set(d);
  }
  return false;
}

async function switchboard(g: GameScene, index: number): Promise<boolean> {
  const cap = g.room.entities.find((e) => e.type === 'capacitor')!;
  await plug(g, cap);
  await sleep(1600);
  set({ press: ['jack'] });
  await sleep(80);
  set();
  return swingAcross(g, index);
}




/** Hop up onto something: run at it and jump. */
async function hop(g: GameScene, ms = 900): Promise<void> {
  set({ move: g.player.facing, jumpHeld: true, press: ['jump'] });
  await sleep(ms);
  set();
}

const ent = (g: GameScene, id: string) => g.room.entities.find((e) => e.id === id)!;

/** Hack every data port in the room, left to right. */
async function hackAll(g: GameScene): Promise<void> {
  const ports = g.room.entities.filter((e) => e.type === 'data').sort((a, b) => a.x - b.x);
  for (const port of ports) {
    await walkTo(g, port.x - 2);
    await sleep(300);
    await jackAt(g, port);
    await sleep(1000);
  }
}

/** 1-3 (left half): hack the two gates open. */
async function hackRoom(g: GameScene, index: number): Promise<boolean> {
  await hackAll(g);
  return onward(g, index, 1);
}

/** A capacitor and a far gate: charge, recall, run. */
async function timedGate(g: GameScene, index: number): Promise<boolean> {
  const cap = g.room.entities.find((e) => e.type === 'capacitor')!;
  await plug(g, cap);
  await sleep(1800);
  set({ press: ['jack'] });
  await sleep(80);
  set();
  return onward(g, index, 1);
}

// ------------------------------------------------------------------ stage 1 (rebuilt rooms)

const T_ = (g: GameScene) => g.tile;
const feetRow = (g: GameScene) => Math.round((g.player.y + g.player.h) / g.tile);

/** Jump (and double jump near the apex), steering with `move`; resolves once grounded again. */
async function leap(g: GameScene, move: number, double = true, ms = 2500): Promise<void> {
  const p = g.player;
  set({ move, jumpHeld: true, press: ['jump'] });
  await until(() => !p.onGround, 400, 10);
  let doubled = !double;
  await until(() => {
    if (!doubled && p.vy > -60) { doubled = true; set({ move, jumpHeld: true, press: ['jump'] }); }
    else set({ move, jumpHeld: true, recalHeld: (win.__dbg?.recalHeld as boolean) ?? false });
    return p.onGround || p.dead;
  }, ms, 10);
  set();
}

/** Jump toward tile column `tx` (double-jumping at the apex if asked), stop steering over it, land. */
async function leapTo(g: GameScene, tx: number, double = false, dash = false, ms = 2500): Promise<boolean> {
  const p = g.player, t = T_(g);
  const lens = (win.__dbg?.recalHeld as boolean) ?? false;
  const steer = () => (Math.abs(p.cx - tx * t) < 0.25 * t ? 0 : Math.sign(tx * t - p.cx));
  set({ move: steer(), jumpHeld: true, recalHeld: lens, press: ['jump'] });
  await until(() => !p.onGround, 400, 10);
  let doubled = !double, dashed = !dash;
  const ok = await until(() => {
    sample(g, `leap ${tx}`);
    if (!doubled && p.vy > -60) { doubled = true; set({ move: steer(), jumpHeld: true, recalHeld: lens, press: ['jump'] }); }
    // jump, jump, dash: the air dash at the top of the double jump carries furthest
    else if (doubled && !dashed && p.vy > -60) { dashed = true; set({ move: steer() || p.facing, jumpHeld: true, recalHeld: lens, press: ['dash'] }); }
    else set({ move: steer(), jumpHeld: true, recalHeld: lens });
    return p.onGround || p.dead;
  }, ms, 10);
  set({ recalHeld: lens });
  return ok && !p.dead;
}

/** Climb a two-wall chimney by bouncing wall to wall until Pix is above `topRow`. */
async function chimney(g: GameScene, topRow: number, ms = 12000): Promise<boolean> {
  const p = g.player, t = T_(g);
  let dir: 1 | -1 = 1;
  set({ move: dir, jumpHeld: true, press: ['jump'] });
  const ok = await until(() => {
    sample(g, `chim d${dir} w${p.wallDir}`);
    if (p.cy < topRow * t || p.dead) return true;
    if (!p.onGround && p.wallDir === dir) { dir = (-dir) as 1 | -1; set({ move: dir, jumpHeld: true, press: ['jump'] }); }
    else if (p.onGround) set({ move: dir, jumpHeld: true, press: ['jump'] });
    else set({ move: dir, jumpHeld: true });
    return false;
  }, ms, 15);
  set();
  return ok && !p.dead;
}

/** Tap jack at an entity, then wait for the cable to settle. */
async function hackAt(g: GameScene, e: EntityDef, wait = 900): Promise<void> {
  await jackAt(g, e);
  await sleep(wait);
}

/** Tap jack at a pull port and hop off the top, steering `move`; true once grounded above `belowRow`. */
async function pullUp(g: GameScene, e: EntityDef, move: number, belowRow: number): Promise<boolean> {
  const p = g.player, t = T_(g);
  await jackAt(g, e);
  await until(() => g.cable.state === 'zip', 1500, 10);
  await until(() => g.cable.state !== 'zip', 3000, 10);
  set({ move, jumpHeld: true, press: ['jump'] });
  return until(() => p.onGround && p.cy < belowRow * t, 3000, 20).finally(() => set());
}

/** Tether to a yank platform, step on, drive it to the end of its rail, step off. */
async function drivePlatform(g: GameScene, dir: 1 | -1, which = 0): Promise<boolean> {
  const p = g.player;
  const defs = g.room.entities.filter((e) => e.type === 'slider' && e.yankable).sort((a, b) => a.x - b.x);
  const def = defs[which];
  const ports = g.ports.filter((q) => q.owner).sort((a, b) => a.x - b.x);
  const port = ports[which];
  if (!def || !port) return false;
  await jackAt(g, { ...def, x: port.x / g.tile - 0.5, y: port.y / g.tile - 0.5 });
  if (!(await until(() => g.cable.state === 'drive', 1500, 10))) return false;
  const lifts = g.solids.filter((s) => s.tag === 'lift').sort((a, b) => a.x - b.x);
  const lift = lifts[which];
  set({ move: dir });
  await until(() => p.ground === lift, 3000, 10);
  // ride it to the end of the rail, then keep walking off the far side
  const end = Math.max(def.x, def.toX ?? def.x) * g.tile;
  const start = Math.min(def.x, def.toX ?? def.x) * g.tile;
  await until(() => (dir > 0 ? lift.x >= end - 1 : lift.x <= start + 1) || p.dead, 9000, 20);
  await until(() => p.ground !== lift && p.onGround, 2000, 20);
  set({ press: ['jack'] });                    // let go of the platform
  await sleep(250);
  set();
  return !p.dead;
}

/** Drop through the thin floor Pix is standing on, and land. */
async function dropThrough(g: GameScene): Promise<void> {
  set({ down: true, press: ['jump'] });
  await sleep(120);
  set();
  await until(() => g.player.onGround, 1500, 20);
  await sleep(120);
}

async function lastMile(g: GameScene, index: number): Promise<boolean> {
  const p = g.player, t = T_(g);
  const conn = g.room.entities.find((e) => e.type === 'connector')!;
  await walkTo(g, conn.x - 3);
  mark(g, "await walkTo(g, conn.x - 3);");
  await jackAt(g, conn);
  mark(g, "await jackAt(g, conn);");
  await sleep(3200);
  await walkTo(g, 14.5);
  mark(g, "await walkTo(g, 14.5);");
  if (!(await leapTo(g, 17))) return false;        // step, 2 up
  mark(g, "if (!(await leapTo(g, 17))) return false");
  if (!(await leapTo(g, 22))) return false;        // step, 3 up
  mark(g, "if (!(await leapTo(g, 22))) return false");
  await walkTo(g, 27.5);
  mark(g, "await walkTo(g, 27.5);");
  if (!(await leapTo(g, 31, true))) return false;  // double jump onto the tall block
  mark(g, "if (!(await leapTo(g, 31, true))) return");
  if (!(await leapTo(g, 40, true))) return false;  // over the short spikes
  mark(g, "if (!(await leapTo(g, 40, true))) return");
  await walkTo(g, 40.6);
  mark(g, "await walkTo(g, 40.6);");
  if (!(await leapTo(g, 49.5, true, true))) return false; // over the long spikes: jump, jump, dash
  mark(g, "if (!(await leapTo(g, 49.5, true, true))");
  await walkTo(g, 53);
  mark(g, "await walkTo(g, 53);");
  if (!(await leapTo(g, 53, true))) return false;  // up through the thin floors
  mark(g, "if (!(await leapTo(g, 53, true))) return");
  for (let i = 0; i < 2 && feetRow(g) > 12; i++) if (!(await leapTo(g, 53))) return false;
  await walkTo(g, 70);
  mark(g, "await walkTo(g, 70);");
  await dropThrough(g);
  mark(g, "await dropThrough(g);");
  await dropThrough(g);
  mark(g, "await dropThrough(g);");
  await walkTo(g, 83.5);
  mark(g, "await walkTo(g, 83.5);");
  if (!(await chimney(g, 7.3))) return false;
  mark(g, "if (!(await chimney(g, 7.3))) return fal");
  set({ move: 1, jumpHeld: true, press: ['jump'] });   // double jump clear of the lip, onto the shelf
  await until(() => p.onGround || p.dead, 2500, 10);
  await walkTo(g, 93.4);
  mark(g, "await walkTo(g, 93.4);");
  if (!(await leapTo(g, 101, true, true))) return false; // over the shelf spikes: jump, jump, dash
  mark(g, "if (!(await leapTo(g, 101, true, true)))");
  void t;
  return onward(g, index, 1, 4000);
}

async function handshake(g: GameScene, index: number): Promise<boolean> {
  const p = g.player, t = T_(g);
  const pulls = g.room.entities.filter((e) => e.type === 'pull').sort((a, b) => a.x - b.x);
  await walkTo(g, 8.4);
  set({ move: 1, recalHeld: true });               // across the blue bridge
  await until(() => p.cx > 21 * t || p.dead, 4000, 10);
  set();
  await sleep(1200);                                // let the lens recharge
  await walkTo(g, 24.6);
  set({ recalHeld: true });
  await sleep(150);
  if (!(await leapTo(g, 27, true))) return false;   // the blue hop
  if (!(await leapTo(g, 31))) return false;         // up onto the high floor
  set();
  if (!(await leapTo(g, 42.4, true, true))) return false; // across the high floor: jump, jump, dash
  await walkTo(g, 42.4);
  if (!(await pullUp(g, pulls[0], 1, 6))) return false;
  await walkTo(g, 59.5);
  await until(() => p.onGround && feetRow(g) >= 15, 2500, 20);
  if (!(await pullUp(g, pulls[1], 1, 6))) return false;
  return onward(g, index, 1, 5000);
}

async function portAuthorityV2(g: GameScene, index: number): Promise<boolean> {
  const p = g.player;
  await walkTo(g, 9.5);
  await hackAt(g, ent(g, 'h1'));
  await walkTo(g, 16.2);
  await leap(g, 1, false);                     // onto the step plank
  await walkTo(g, 19.5);
  await leap(g, 1, true);                      // up onto the ledge
  await walkTo(g, 28.2);
  await hackAt(g, ent(g, 'h2'));
  await walkTo(g, 20.5);                       // off the ledge's left end, back to the floor
  await until(() => p.onGround && feetRow(g) >= 21, 2000, 20);
  await walkTo(g, 42.6);                       // to the foot of the cliff
  if (!(await pullUp(g, g.room.entities.find((e) => e.type === 'pull')!, 1, 12))) return false;
  await walkTo(g, 47.5);
  if (!(await drivePlatform(g, 1, 0))) return false;
  await walkTo(g, 71.5);
  if (!(await drivePlatform(g, 1, 1))) return false;
  return onward(g, index, 1);
}

async function falseFloorV2(g: GameScene, index: number): Promise<boolean> {
  const p = g.player, t = T_(g);
  set({ move: 1, recalHeld: true });
  await until(() => p.cx > 22.4 * t || p.dead, 5000, 10);
  set({ move: 1, recalHeld: true });
  await leap(g, 1);
  set();
  if (!(p.onGround && feetRow(g) <= 13)) return false;
  await walkTo(g, 33.5);
  await dropThrough(g);
  await dropThrough(g);
  await hackAt(g, ent(g, 'h1'), 1200);
  return onward(g, index, 1, 6000);
}

async function uplinkV2(g: GameScene, index: number): Promise<boolean> {
  const p = g.player, t = T_(g);
  await walkTo(g, 5.2);
  if (!(await leapTo(g, 7))) return false;     // plank 1
  if (!(await leapTo(g, 12))) return false;    // plank 2
  if (!(await leapTo(g, 15.5))) return false;  // floor past the spikes
  await walkTo(g, 17);
  if (!(await pullUp(g, g.room.entities.find((e) => e.type === 'pull')!, 1, 23.5))) return false;
  await walkTo(g, 23.6);
  set({ move: 0, jumpHeld: true, press: ['jump'] });
  await sleep(300);
  set({ move: 0, jumpHeld: true, press: ['jump'] });
  await sleep(250);
  set({ move: -1, jumpHeld: true });
  await until(() => p.onGround, 2000, 10);
  set();
  if (feetRow(g) > 20) return false;
  await walkTo(g, 14.6);
  set({ recalHeld: true });
  await sleep(250);
  if (!(await leapTo(g, 10))) return false;    // the blue hop
  if (!(await leapTo(g, 4))) return false;     // the exit shelf
  set();
  void t;
  return onward(g, index, -1, 4000);
}

async function chainV2(g: GameScene, index: number): Promise<boolean> {
  const p = g.player, t = T_(g);
  await walkTo(g, 10);
  if (!(await drivePlatform(g, 1))) return false;
  await walkTo(g, 30.6);
  await hackAt(g, ent(g, 'h1'), 1200);
  await walkTo(g, 34.3);
  await leap(g, 1);                            // over the spikes
  if (p.cx < 40 * t) return false;
  await walkTo(g, 42.2);
  if (!(await pullUp(g, g.room.entities.find((e) => e.type === 'pull')!, 1, 10))) return false;
  return onward(g, index, 1);
}

/** Pick the routine from what's in the room. */
function kindOf(g: GameScene): string {
  const has = (t: string) => g.room.entities.some((e) => e.type === t);
  if (g.room.id === 'l1-01') return 'lastmile';
  if (g.room.id === 'l1-02') return 'handshake';
  if (g.room.id === 'l1-03') return 'portauthority';
  if (g.room.id === 'l1-04') return 'falsefloor';
  if (g.room.id === 'l1-05') return 'uplink';
  if (g.room.id === 'l1-06') return 'chain';
  if (has('capacitor') && has('gate') && !has('anchor') && !has('lift')) return 'timedgate';
  if (has('capacitor') && has('anchor')) return 'switchboard';
  if (has('capacitor') && has('lift')) return 'lift';
  if (has('consumer') && has('gate')) return 'airlock';
  if (g.room.true.length) return 'colours';
  if (has('anchor') && g.room.spikes.length) return 'swing';
  return 'unknown';
}

async function room(index: number): Promise<RoomReport> {
  const t0 = Date.now();
  trace = [];
  marks = [];
  const g = await load(index);
  const id = g.room.id;
  const kind = kindOf(g);
  let ok = false, note = '';
  try {
    if (kind === 'swing') ok = await swingAcross(g, index);
    else if (kind === 'airlock') ok = await airlock(g, index);
    else if (kind === 'lift') ok = await liftRide(g, index);
    else if (kind === 'colours') ok = await colourRun(g, index);
    else if (kind === 'switchboard') ok = await switchboard(g, index);
    else if (kind === 'hack') ok = await hackRoom(g, index);
    else if (kind === 'lastmile') ok = await lastMile(g, index);
    else if (kind === 'handshake') ok = await handshake(g, index);
    else if (kind === 'portauthority') ok = await portAuthorityV2(g, index);
    else if (kind === 'falsefloor') ok = await falseFloorV2(g, index);
    else if (kind === 'uplink') ok = await uplinkV2(g, index);
    else if (kind === 'chain') ok = await chainV2(g, index);
    else if (kind === 'timedgate') ok = await timedGate(g, index);
    else note = 'no routine for this room';
  } catch (e) {
    note = String(e);
  }
  set();
  return { room: id, kind, ok, note: note || (ok ? '' : `stopped at x=${(g.player.cx / g.tile).toFixed(1)} y=${(g.player.cy / g.tile).toFixed(1)}`), ms: Date.now() - t0, trace: ok ? undefined : trace.slice(-14), marks: ok ? undefined : marks };
}

async function level(): Promise<RoomReport[]> {
  const n = G().level.rooms.length;
  const out: RoomReport[] = [];
  for (let i = 0; i < n; i++) out.push(await room(i));
  return out;
}

win.__bot = { room, level };
