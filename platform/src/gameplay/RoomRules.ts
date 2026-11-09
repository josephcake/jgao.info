import type { RoomDef } from './RoomData';

/**
 * The mechanics a room is built from, as counted from its map and entities. Each
 * room declares its own counts in its header (`mechanics ...`); the test suite
 * checks the declaration against this count, so the numbers can't drift.
 * See docs/level-design-rules.md.
 *
 * Movement verbs (run, jump, double jump, dash, wall-jump) are not mechanics:
 * every room has them.
 */
export const MECHANICS = [
  'current', 'plank', 'pull', 'anchor', 'yank', 'hack', 'lift', 'capacitor', 'consumer',
  'colour', 'blue', 'green', 'red', 'neon', 'white', 'secret', 'chip',
] as const;
export type Mechanic = (typeof MECHANICS)[number];

/** Counts of each mechanic used in a room. A count of 0 is left out. */
export type MechanicCounts = Partial<Record<Mechanic, number>>;

/** Number of separate 4-connected patches among the given cells. */
function patches(cells: [number, number][]): number {
  const left = new Set(cells.map(([x, y]) => `${x},${y}`));
  let n = 0;
  for (const start of [...left]) {
    if (!left.has(start)) continue;
    n++;
    const stack = [start];
    left.delete(start);
    while (stack.length) {
      const [x, y] = stack.pop()!.split(',').map(Number);
      for (const k of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        if (left.has(k)) { left.delete(k); stack.push(k); }
      }
    }
  }
  return n;
}

const rectCells = (rects: number[][]): [number, number][] =>
  rects.flatMap(([x, y, w, h = 1]) => Array.from({ length: w * h }, (_, i) => [x + (i % w), y + Math.floor(i / w)] as [number, number]));

/** Count the mechanics in a room: one per patch of tiles, one per port or device. */
export function countMechanics(room: RoomDef): MechanicCounts {
  const ents = (pred: (t: RoomDef['entities'][number]) => boolean) => room.entities.filter(pred).length;
  const ledges = (hue: string) => rectCells(room.true.filter((_, i) => (room.trueColor?.[i] ?? 'blue') === hue));
  const raw: Record<Mechanic, number> = {
    current: patches(rectCells(room.spikes)),
    plank: patches(rectCells(room.oneway)),
    pull: ents((e) => e.type === 'pull'),
    anchor: ents((e) => e.type === 'anchor'),
    yank: ents((e) => (e.type === 'slider' && !!e.yankable) || e.type === 'yank'),
    hack: ents((e) => e.type === 'data'),
    lift: ents((e) => e.type === 'lift'),
    capacitor: ents((e) => e.type === 'capacitor'),
    consumer: ents((e) => e.type === 'consumer'),
    colour: ents((e) => e.type === 'connector'),
    blue: patches(ledges('blue')),
    green: patches(ledges('green')),
    red: patches(ledges('red')),
    neon: patches(rectCells(room.neon)),
    white: patches(ledges('white')),
    secret: patches(rectCells(room.secret ?? [])),
    chip: ents((e) => e.type === 'chip'),
  };
  const out: MechanicCounts = {};
  for (const m of MECHANICS) if (raw[m] > 0) out[m] = raw[m];
  return out;
}

/** Mechanics this room uses that no earlier room in the list did. */
export function newMechanics(rooms: RoomDef[], index: number): Mechanic[] {
  const seen = new Set<string>();
  for (let i = 0; i < index; i++) for (const m of Object.keys(countMechanics(rooms[i]))) seen.add(m);
  return (Object.keys(countMechanics(rooms[index])) as Mechanic[]).filter((m) => !seen.has(m));
}

/** `mechanics a:1 b:2` header value, in canonical order. */
export function formatCounts(c: MechanicCounts): string {
  return MECHANICS.filter((m) => c[m]).map((m) => `${m}:${c[m]}`).join(' ');
}
