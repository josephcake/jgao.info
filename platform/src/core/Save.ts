/** Persistent progress: lost packets recovered per level, colours Pix has recovered, the last room reached, and the chosen mode. */

const KEY = 'deadpixel.packets.v1';
const COLOUR_KEY = 'deadpixel.colours.v1';
const MODE_KEY = 'deadpixel.mode.v1';
const PROGRESS_KEY = 'deadpixel.progress.v1';
const DONE_KEY = 'deadpixel.completed.v1';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): Store | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function read(): Record<string, string[]> {
  try {
    const v = JSON.parse(store()?.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Stable id for a packet: room id plus its tile. */
export const packetId = (roomId: string, x: number, y: number) => `${roomId}:${x},${y}`;

function colours(): string[] {
  try {
    const v = JSON.parse(store()?.getItem(COLOUR_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** The mode, for when storage isn't available. */
let sessionHard: boolean | null = null;

export const Save = {
  /** Hard mode: colours are only real while the lens is held. Normal: they show inside their zone. */
  get hard(): boolean {
    try { return store()?.getItem(MODE_KEY) === 'hard' || (sessionHard ?? false); } catch { return sessionHard ?? false; }
  },
  setHard(hard: boolean): void {
    sessionHard = hard;
    try { store()?.setItem(MODE_KEY, hard ? 'hard' : 'normal'); } catch { /* session only */ }
  },
  /** The last room reached in the story, for Load Game. */
  get progress(): { level: number; room: number } | null {
    try {
      const v = JSON.parse(store()?.getItem(PROGRESS_KEY) ?? 'null');
      return v && typeof v.level === 'number' && typeof v.room === 'number' ? v : null;
    } catch {
      return null;
    }
  },
  setProgress(level: number, room: number): void {
    try { store()?.setItem(PROGRESS_KEY, JSON.stringify({ level, room })); } catch { /* session only */ }
  },
  /** Ids of story rooms finished at least once, for Level Select. */
  get completed(): string[] {
    try {
      const v = JSON.parse(store()?.getItem(DONE_KEY) ?? '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  },
  addCompleted(roomId: string): void {
    try { store()?.setItem(DONE_KEY, JSON.stringify([...new Set([...Save.completed, roomId])])); } catch { /* session only */ }
  },
  /** New Game: forget packets, colours, the last room and finished rooms. The mode and key bindings stay. */
  resetProgress(): void {
    try { for (const k of [KEY, COLOUR_KEY, PROGRESS_KEY, DONE_KEY]) store()?.removeItem(k); } catch { /* session only */ }
  },
  hasColour(c: string): boolean {
    return colours().includes(c);
  },
  addColour(c: string): void {
    try { store()?.setItem(COLOUR_KEY, JSON.stringify([...new Set([...colours(), c])])); } catch { /* session only */ }
  },
  hasPacket(levelId: string, id: string): boolean {
    return (read()[levelId] ?? []).includes(id);
  },
  packetCount(levelId: string): number {
    return (read()[levelId] ?? []).length;
  },
  /** Commit packets picked up in a room. Called when the room is completed, so dying loses them. */
  addPackets(levelId: string, ids: string[]): void {
    if (!ids.length) return;
    const all = read();
    all[levelId] = [...new Set([...(all[levelId] ?? []), ...ids])];
    try { store()?.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: progress lasts the session */ }
  },
};
