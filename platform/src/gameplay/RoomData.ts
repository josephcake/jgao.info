import type { Device } from '../render/CityDressing';
import type { Rect, Solid } from './physics';
import type { Hue, Lens } from './Colours';
import r1 from '../../assets/data/rooms/room01.json';
import r2 from '../../assets/data/rooms/room02.json';
import r3 from '../../assets/data/rooms/room03.json';
import r5 from '../../assets/data/rooms/room05.json';
import r6 from '../../assets/data/rooms/room06.json';
import { parseRoom } from './AsciiRoom';
// every .room file in a level folder, in file-name order (so number them: 01-..., 02-...)
const folder = (files: Record<string, string>) => Object.keys(files).sort().map((k) => parseRoom(files[k]));
const level1Files = import.meta.glob('../../assets/data/rooms/level1/*.room', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** One entity in a room file. Coordinates are tile cells. */
export interface EntityDef {
  type: string;
  x: number;
  y: number;
  id?: string;
  w?: number;
  h?: number;
  toY?: number;
  /** A yankable slider that homes to Pix's column instead of a fixed point. */
  toPix?: boolean;
  /**
   * A slider or gate that carries its own yank port (no separate lever, no `inputs`).
   * Yanking a slider slides it to Pix's column; yanking a gate rips the door down so it
   * topples toward Pix and becomes a walkable fallen slab.
   */
  yankable?: boolean;
  inputs?: string[];
  invert?: boolean;
  text?: string;
  needs?: string;
  hold?: number;
  /** Horizontal travel target for a slider. */
  toX?: number;
  /** Colour of a colour pickup. */
  color?: string;
}

/** A region of a room that gives the lens its colour (see Colours.ts). */
export interface Zone {
  color: Hue;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomDef {
  id: string;
  name: string;
  tagline: string;
  width: number;
  height: number;
  bg: string;
  spawn: number[];
  exit: number[];
  solids: number[][];
  oneway: number[][];
  spikes: number[][];
  neon: number[][];
  true: number[][];
  /** Colour of each `true` ledge, by index. Missing means blue. */
  trueColor?: Lens[];
  /** Secret walls: solid, drawn like the rest, but white true view sees through them. */
  secret?: number[][];
  /** Lens colour zones. */
  zones?: Zone[];
  entities: EntityDef[];
  /** The room's design rules from its header. See docs/level-design-rules.md. */
  rules?: RoomRuleSet;
}

/** A room's declared design rules: what it is built from and how hard it is. */
export interface RoomRuleSet {
  /** The one to three mechanics the room is about. */
  main: string[];
  /** How many times each mechanic appears (see RoomRules.countMechanics). */
  mechanics: Record<string, number>;
  /** Mechanics that appear here for the first time in the level. */
  newMechanics: string[];
  /** The mean of the portions' hardness, 1 to 10, one decimal. */
  hardness: number;
  /** The room's sections in route order, each with its own hardness 1-10. */
  portions: { hardness: number; label: string }[];
}

export interface LevelDef {
  id: string;
  name: string;
  /** Prefix on the HUD room counter. */
  tag: string;
  /** The hardware this level takes place inside. */
  device: Device;
  /** Shown under the first room's name. */
  inside?: string;
  rooms: RoomDef[];
}

export const LEVELS: LevelDef[] = [
  { id: 'training', name: 'TRAINING GROUNDS', tag: 'T-', device: 'modem', rooms: [r1, r2, r3, r5, r6] as RoomDef[] },
  { id: 'level1', name: 'LEVEL 1: THE LAST MILE', tag: '1-', device: 'modem', inside: 'INSIDE: WIFI MODEM', rooms: folder(level1Files) },
];

/** Every room in every level. */
export const ROOMS: RoomDef[] = LEVELS.flatMap((l) => l.rooms);

/** Room geometry resolved into pixel-space solids and hazards. */
export interface RoomGeometry {
  solids: Solid[];
  neon: Solid[];
  truth: Solid[];
  /** Secret walls, solid until white true view sees through them. */
  secret: Solid[];
  hazards: Rect[];
  /** Tile grid of permanent clay terrain (for baking art). */
  grid: boolean[][];
}

/** Convert a room definition into collision geometry. */
export type CurrentSide = 'floor' | 'ceil' | 'left' | 'right';

/**
 * Which surface a current tile (`^`) runs along: the floor under it first, then a wall
 * beside it, then the ceiling. The arc zigzags in the air off that surface.
 */
export function currentSide(def: RoomDef, x: number, y: number): CurrentSide {
  const solid = (tx: number, ty: number) => tx < 0 || tx >= def.width || ty < 0 || ty >= def.height
    || def.solids.some(([sx, sy, sw, sh]) => tx >= sx && tx < sx + sw && ty >= sy && ty < sy + sh);
  if (solid(x, y + 1)) return 'floor';
  if (solid(x - 1, y)) return 'left';
  if (solid(x + 1, y)) return 'right';
  if (solid(x, y - 1)) return 'ceil';
  return 'floor';
}

/** Every current tile with the surface it runs along. */
export function currentTiles(def: RoomDef): { x: number; y: number; side: CurrentSide }[] {
  const out: { x: number; y: number; side: CurrentSide }[] = [];
  for (const [x, y, w] of def.spikes) for (let i = 0; i < w; i++) out.push({ x: x + i, y, side: currentSide(def, x + i, y) });
  return out;
}

export function buildGeometry(def: RoomDef, tile: number): RoomGeometry {
  const grid: boolean[][] = [];
  for (let y = 0; y < def.height; y++) grid.push(new Array(def.width).fill(false));
  const solids: Solid[] = [];
  for (const [x, y, w, h] of def.solids) {
    solids.push({ x: x * tile, y: y * tile, w: w * tile, h: h * tile, active: true, tag: 'clay' });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (grid[yy]) grid[yy][xx] = true;
  }
  for (const [x, y, w] of def.oneway) {
    solids.push({ x: x * tile, y: y * tile, w: w * tile, h: tile * 0.4, oneWay: true, active: true, tag: 'plank' });
  }
  const neon: Solid[] = def.neon.map(([x, y, w, h]) => ({ x: x * tile, y: y * tile, w: w * tile, h: h * tile, active: true, tag: 'neon' }));
  const truth: Solid[] = def.true.map(([x, y, w, h], i) => ({ x: x * tile, y: y * tile, w: w * tile, h: h * tile, active: false, tag: 'true', color: def.trueColor?.[i] ?? 'blue' }));
  const secret: Solid[] = (def.secret ?? []).map(([x, y, w, h]) => ({ x: x * tile, y: y * tile, w: w * tile, h: h * tile, active: true, tag: 'secret' }));
  solids.push(...neon, ...truth, ...secret);
  // a current kills on the half of its tile against the surface it runs along
  const k = 0.55;
  const hazards: Rect[] = currentTiles(def).map(({ x, y, side }) => {
    const X = x * tile, Y = y * tile;
    if (side === 'ceil') return { x: X, y: Y, w: tile, h: tile * k };
    if (side === 'left') return { x: X, y: Y, w: tile * k, h: tile };
    if (side === 'right') return { x: X + tile * (1 - k), y: Y, w: tile * k, h: tile };
    return { x: X, y: Y + tile * (1 - k), w: tile, h: tile * k };
  });
  return { solids, neon, truth, secret, hazards, grid };
}

/** Validate cross references inside a room. Returns a list of problems. */
export function validateRoom(def: RoomDef): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const signals = new Set<string>();
  for (const e of def.entities) {
    if (e.id) ids.add(e.id);
    if (e.needs) signals.add(e.needs);
  }
  for (const e of def.entities) {
    for (const i of e.inputs ?? []) if (!ids.has(i) && !signals.has(i)) problems.push(`${def.id}: ${e.type} input '${i}' unknown`);
  }
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < def.width && y < def.height;
  if (!inBounds(def.spawn[0], def.spawn[1])) problems.push(`${def.id}: spawn out of bounds`);
  for (const e of def.entities) if (!inBounds(e.x, e.y)) problems.push(`${def.id}: ${e.type} out of bounds`);
  return problems;
}
