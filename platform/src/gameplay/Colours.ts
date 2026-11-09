import { Save } from '../core/Save';
import type { LevelDef, RoomDef } from './RoomData';

/**
 * Pix died with the pixel and starts hollow. Each of the first three stages
 * gives back one colour; from stage 4, owning all three unlocks the white lens.
 *
 * The lens is one button. Its colour is picked up from the zone Pix is standing
 * in when the button is pressed, and kept for as long as it's held, wherever Pix
 * goes. Hidden things of that colour become real; neon things vanish. Pressed
 * outside any zone it shows white (everything) once white is unlocked, and
 * nothing before that.
 */
export type Hue = 'blue' | 'green' | 'red';
export type Lens = Hue | 'white';
export const HUES: Hue[] = ['blue', 'green', 'red'];

/** Stage (level index) each colour is found in. */
const FOUND_IN: Record<Hue, number> = { blue: 1, green: 1, red: 1 };

/** Colours that exist by a stage: the ones found in it or earlier. */
export const huesInStage = (stage: number): Hue[] => HUES.filter((h) => FOUND_IN[h] <= stage);
/** White shows every colour at once, so it drains the lens budget faster. */
export const WHITE_DRAIN = 3;

export const LENS_COLOR: Record<Lens, number> = { blue: 0x4a8aff, green: 0x3aff7a, red: 0xff4a5a, white: 0xf0f0ff };
/** Shader tint for the world under each lens. */
export const LENS_TINT: Record<Lens, [number, number, number]> = {
  blue: [0.7, 0.88, 1.35],
  green: [0.75, 1.3, 0.8],
  red: [1.35, 0.75, 0.75],
  white: [1.06, 1.0, 0.9],
};

export const isHue = (v: unknown): v is Hue => v === 'blue' || v === 'green' || v === 'red';

/**
 * How the world looks. Before Pix has any colour it's almost black; from the
 * first colour on it's in full colour, so the
 * lens tints stand out against it. `level` is brightness, `mix` 0 = monochrome
 * in `tint`, 1 = full colour.
 */
export interface Sight { level: number; tint: [number, number, number]; mix: number }
export const DARK = 0.07;

export function sightFor(owned: Hue[]): Sight {
  if (!owned.length) return { level: DARK, tint: [0.6, 0.6, 0.7], mix: 0 };
  return { level: 1, tint: [1, 1, 1], mix: 1 };
}

/**
 * Colours Pix has at this point: anything from an earlier stage, anything saved,
 * and anything whose pickup room is behind the current room in this stage.
 * Training Grounds is a sandbox and has them all.
 */
export function ownedHues(level: LevelDef, levelIndex: number, roomIndex: number): Hue[] {
  if (levelIndex === 0) return [...HUES];
  return HUES.filter((h) => {
    if (levelIndex > FOUND_IN[h] || Save.hasColour(h)) return true;
    if (levelIndex !== FOUND_IN[h]) return false;
    const at = level.rooms.findIndex((r) => r.entities.some((e) => e.type === 'connector' && e.color === h));
    return at >= 0 && roomIndex > at;
  });
}

/** White true view: once all three colours are back, in any level (Training has it from the start). */
export function whiteAvailable(levelIndex: number, owned: Hue[]): boolean {
  return levelIndex === 0 || owned.length === 3;
}

/** The zone colour at a tile, if any. Later zones win where they overlap. */
export function zoneAt(room: RoomDef, tx: number, ty: number): Hue | null {
  let hit: Hue | null = null;
  for (const z of room.zones ?? []) if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) hit = z.color;
  return hit;
}
