import { isHue, type Lens } from './Colours';
import type { EntityDef, RoomDef, RoomRuleSet, Zone } from './RoomData';

/**
 * Rooms written as text. One character per 40px tile:
 *
 *   #  wall / floor        =  plank (one-way)      ^  current (live voltage along floor, wall or ceiling)
 *   n  neon block (gone under any lens)
 *   B  blue ledge          G  green ledge          R  red ledge    (real in its zone, or under its lens; t = B)
 *   W  white ledge (hidden: only real in white true view)
 *   H  secret wall (looks and acts like `#`, but white true view sees through it)
 *   @  spawn               E  exit zone            .  air (any unknown char is air too)
 *   o  anchor port         P  pull port            *  lost packet (collectible)
 *   ?  terminal (floating sign; one per new mechanic)
 *
 * Header lines come first (`id`, `name`, `tagline`, `bg`, and the design rules `main`,
 * `mechanics`, `new`, one `portion` line per section, `hardness`; see docs/level-design-rules.md), then `map`, the grid,
 * and `end`. After the grid:
 *
 *   text <terminal text>            one per `?`, in reading order (top to bottom, left to right)
 *   entity {json}                   anything without a glyph (gates, lifts, sliders, ids)
 *   zone <blue|green|red> x y w h   a lens colour zone: press the lens here to pick up that colour
 *   spawn x y  /  exit x y w h      overrides, when a glyph would sit on a wall
 *
 * `\n` inside text becomes a line break. Lines starting with `//` are comments.
 */
export function parseRoom(src: string): RoomDef {
  const lines = src.replace(/\r/g, '').split('\n');
  const head: Record<string, string> = {};
  const grid: string[] = [];
  const texts: string[] = [];
  const extra: EntityDef[] = [];
  let spawnOverride: number[] | null = null;
  let exitOverride: number[] | null = null;
  const zones: Zone[] = [];
  const portions: string[] = [];
  let mode: 'head' | 'map' | 'tail' = 'head';

  for (const raw of lines) {
    if (mode === 'map') {
      if (raw.trim() === 'end') { mode = 'tail'; continue; }
      grid.push(raw);
      continue;
    }
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (mode === 'head' && line === 'map') { mode = 'map'; continue; }
    const sp = line.indexOf(' ');
    const key = sp < 0 ? line : line.slice(0, sp);
    const val = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (mode === 'head' && key === 'portion') { portions.push(val); continue; }
    if (mode === 'head') { head[key] = val; continue; }
    switch (key) {
      case 'text': texts.push(val.replace(/\\n/g, '\n')); break;
      case 'entity': extra.push(JSON.parse(val) as EntityDef); break;
      case 'spawn': spawnOverride = val.split(/\s+/).map(Number); break;
      case 'exit': exitOverride = val.split(/\s+/).map(Number); break;
      case 'zone': {
        const [color, ...n] = val.split(/\s+/);
        if (!isHue(color)) throw new Error(`room ${head.id ?? '?'}: zone colour '${color}' must be blue, green or red`);
        const [x, y, w, h] = n.map(Number);
        zones.push({ color, x, y, w, h });
        break;
      }
      default: throw new Error(`room ${head.id ?? '?'}: unknown line '${key}'`);
    }
  }
  if (!grid.length) throw new Error(`room ${head.id ?? '?'}: no map`);

  const height = grid.length;
  const width = Math.max(...grid.map((r) => r.length));
  const at = (x: number, y: number) => (y >= 0 && y < height ? grid[y][x] ?? '.' : '.');

  const rects = (ch: string): number[][] => {
    // horizontal runs, merged downward when the run below matches exactly
    const out: number[][] = [];
    const open = new Map<string, number[]>();
    for (let y = 0; y < height; y++) {
      const next = new Map<string, number[]>();
      let x = 0;
      while (x < width) {
        if (at(x, y) !== ch) { x++; continue; }
        const x0 = x;
        while (x < width && at(x, y) === ch) x++;
        const k = `${x0},${x - x0}`;
        const r = open.get(k);
        if (r) { r[3]++; next.set(k, r); open.delete(k); } else { const n = [x0, y, x - x0, 1]; out.push(n); next.set(k, n); }
      }
      open.clear();
      for (const [k, r] of next) open.set(k, r);
    }
    return out;
  };

  const entities: EntityDef[] = [];
  let spawn: number[] | null = null;
  const exitCells: number[][] = [];
  let ti = 0;
  const glyph: Record<string, string> = { o: 'anchor', P: 'pull', '*': 'packet' };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = at(x, y);
      if (c === '@') spawn = [x, y];
      else if (c === 'E') exitCells.push([x, y]);
      else if (c === '?') {
        const text = texts[ti++];
        if (text === undefined) throw new Error(`room ${head.id}: terminal at ${x},${y} has no text line`);
        entities.push({ type: 'terminal', x, y, text });
      } else if (glyph[c]) entities.push({ type: glyph[c], x, y });
    }
  }
  if (ti !== texts.length) throw new Error(`room ${head.id}: ${texts.length} text lines but ${ti} terminals`);
  entities.push(...extra);

  let exit = [0, 0, 0, 0];
  if (exitCells.length) {
    const xs = exitCells.map((c) => c[0]), ys = exitCells.map((c) => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    exit = [x0, y0, Math.max(...xs) - x0 + 1, Math.max(...ys) - y0 + 1];
  }
  spawn = spawnOverride ?? spawn;
  if (!spawn) throw new Error(`room ${head.id}: no spawn (@)`);

  return {
    id: head.id,
    name: head.name ?? '',
    tagline: head.tagline ?? '',
    width,
    height,
    bg: head.bg ?? 'city',
    spawn,
    exit: exitOverride ?? exit,
    solids: rects('#'),
    oneway: rects('=').flatMap(([x, y, w, h]) => Array.from({ length: h }, (_, i) => [x, y + i, w])),
    spikes: rects('^').flatMap(([x, y, w, h]) => Array.from({ length: h }, (_, i) => [x, y + i, w])),
    neon: rects('n'),
    secret: rects('H'),
    ...hidden(),
    zones,
    entities,
    rules: parseRules(head, portions),
  };

  function hidden(): { true: number[][]; trueColor: Lens[] } {
    const out: number[][] = [];
    const color: Lens[] = [];
    for (const [ch, hue] of [['t', 'blue'], ['B', 'blue'], ['G', 'green'], ['R', 'red'], ['W', 'white']] as [string, Lens][]) {
      for (const r of rects(ch)) { out.push(r); color.push(hue); }
    }
    return { true: out, trueColor: color };
  }
}

/** The design-rules header lines, if the room has them. */
function parseRules(head: Record<string, string>, portions: string[]): RoomRuleSet | undefined {
  if (head.hardness === undefined && head.mechanics === undefined) return undefined;
  const words = (v: string | undefined) => (v ?? '').split(/\s+/).filter((w) => w && w !== '-');
  return {
    main: words(head.main),
    mechanics: Object.fromEntries(words(head.mechanics).map((p) => { const [k, n] = p.split(':'); return [k, Number(n)]; })),
    newMechanics: words(head.new),
    hardness: Number(head.hardness),
    portions: portions.map((p) => {
      const sp = p.indexOf(' ');
      return { hardness: Number(sp < 0 ? p : p.slice(0, sp)), label: sp < 0 ? '' : p.slice(sp + 1).trim() };
    }),
  };
}
