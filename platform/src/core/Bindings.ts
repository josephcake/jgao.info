/**
 * Remappable controls. Keyboard keys are stored as `KeyboardEvent.code`
 * (physical key position, so layouts like AZERTY keep the same shape).
 * Gamepad buttons are stored as standard-mapping button indices; the gamepad
 * profile is saved and editable here but not yet read by `InputMap`.
 */

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'dash' | 'jack' | 'recal' | 'pause';

export interface ActionInfo {
  id: Action;
  label: string;
  group: 'MOVE' | 'CABLE & MOVES' | 'SYSTEM';
  hint: string;
}

export const ACTIONS: ActionInfo[] = [
  { id: 'left', label: 'LEFT', group: 'MOVE', hint: 'MOVE LEFT. ALSO AIMS THE CABLE.' },
  { id: 'right', label: 'RIGHT', group: 'MOVE', hint: 'MOVE RIGHT. ALSO AIMS THE CABLE.' },
  { id: 'up', label: 'UP', group: 'MOVE', hint: 'AIM UP. REELS IN WHILE SWINGING.' },
  { id: 'down', label: 'DOWN', group: 'MOVE', hint: 'AIM DOWN. REELS OUT WHILE SWINGING.\nDOWN + JUMP DROPS THROUGH PLANKS.' },
  { id: 'jump', label: 'JUMP', group: 'CABLE & MOVES', hint: 'JUMP. HOLD FOR HEIGHT.\nPRESS AGAIN IN THE AIR TO DOUBLE JUMP.' },
  { id: 'dash', label: 'DASH', group: 'CABLE & MOVES', hint: 'A QUICK BURST. BRIEFLY UNTOUCHABLE.' },
  { id: 'jack', label: 'JACK', group: 'CABLE & MOVES', hint: 'FIRE THE CABLE AT A PORT.\nHOLD TO SWING, TAP TO PULL.\nWHILE THE CABLE IS OUT, PULLS IT BACK.' },
  { id: 'recal', label: 'TRUE VIEW', group: 'CABLE & MOVES', hint: 'HOLD TO SEE THE WORLD AS IT REALLY IS.\nRUNS ON A LIMITED BUFFER.' },
  { id: 'pause', label: 'PAUSE', group: 'SYSTEM', hint: 'PAUSE THE GAME.\nALSO BACKS OUT OF THIS SCREEN.' },
];

/** Keys that keep a fixed job and can't be bound, with the reason shown to the player. */
export const RESERVED: Record<string, string> = {
  Backspace: 'CANCEL / CLEAR',
  KeyM: 'MUTE',
  KeyR: 'RESTART ROOM (PAUSED)',
  KeyQ: 'QUIT TO TITLE (PAUSED)',
  KeyK: 'CONTROLS (PAUSED)',
  Tab: 'SYSTEM',
  MetaLeft: 'SYSTEM',
  MetaRight: 'SYSTEM',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Digit${i + 1}`, 'JUMP TO ROOM (PAUSED)'])),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 'SYSTEM'])),
};

export type Slots<T> = [T | null, T | null];
export type SlotMap<T> = Record<Action, Slots<T>>;

export const DEFAULT_KEYS: SlotMap<string> = {
  left: ['ArrowLeft', null],
  right: ['ArrowRight', null],
  up: ['ArrowUp', null],
  down: ['ArrowDown', null],
  jump: ['KeyZ', 'Space'],
  dash: ['KeyV', null],
  jack: ['KeyC', null],
  recal: ['KeyS', null],
  pause: ['Escape', 'KeyP'],
};

/** Standard-mapping gamepad button indices. */
export const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, home: 16 } as const;

export const DEFAULT_PAD: SlotMap<number> = {
  left: [PAD.left, null],
  right: [PAD.right, null],
  up: [PAD.up, null],
  down: [PAD.down, null],
  jump: [PAD.a, null],
  dash: [PAD.b, null],
  jack: [PAD.rt, PAD.rb],
  recal: [PAD.lt, PAD.lb],
  pause: [PAD.start, null],
};

export type BindResult =
  | { ok: true; swapped?: { action: Action; slot: number } }
  | { ok: false; reason: string };

export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const STORAGE_KEY = 'null_route.controls.v1';

const clone = <T>(m: SlotMap<T>): SlotMap<T> => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]])) as SlotMap<T>;

/**
 * Put `value` into `map[action][slot]`. If another slot already holds it, that
 * slot takes this slot's old value (a swap), so nothing is left unbound.
 */
function bindIn<T>(map: SlotMap<T>, action: Action, slot: number, value: T): BindResult {
  const old = map[action][slot];
  if (old === value) return { ok: true };
  let swapped: { action: Action; slot: number } | undefined;
  for (const a of Object.keys(map) as Action[]) {
    const i = map[a].indexOf(value);
    if (i < 0) continue;
    if (old === null && i === 0 && map[a][1] === null && a !== action) {
      return { ok: false, reason: `THAT IS THE ONLY KEY FOR ${ACTIONS.find((x) => x.id === a)!.label}` };
    }
    map[a][i] = old;
    if (map[a][0] === null) { map[a][0] = map[a][1]; map[a][1] = null; }
    if (a !== action || i !== slot) swapped = { action: a, slot: i };
  }
  map[action][slot] = value;
  if (map[action][0] === null) { map[action][0] = map[action][1]; map[action][1] = null; }
  return { ok: true, swapped };
}

function sanitize<T>(raw: unknown, defaults: SlotMap<T>, valid: (v: unknown) => v is T): SlotMap<T> {
  const out = clone(defaults);
  if (!raw || typeof raw !== 'object') return out;
  for (const a of Object.keys(defaults) as Action[]) {
    const v = (raw as Record<string, unknown>)[a];
    if (!Array.isArray(v)) continue;
    const s: Slots<T> = [valid(v[0]) ? v[0] : null, valid(v[1]) ? v[1] : null];
    if (s[0] === null) { s[0] = s[1]; s[1] = null; }
    if (s[0] !== null) out[a] = s;
  }
  // a hand-edited or stale save must not bind one key to two actions
  const seen = new Set<T>();
  for (const a of Object.keys(out) as Action[]) {
    for (let i = 0; i < 2; i++) {
      const v = out[a][i];
      if (v === null) continue;
      if (seen.has(v)) out[a][i] = null;
      else seen.add(v);
    }
    if (out[a][0] === null) out[a] = [...defaults[a]] as Slots<T>;
  }
  return out;
}

const isCode = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && !(v in RESERVED);
const isButton = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 32;

export class Bindings {
  keys: SlotMap<string> = clone(DEFAULT_KEYS);
  pad: SlotMap<number> = clone(DEFAULT_PAD);

  constructor(private store: Store | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.load();
  }

  load(): void {
    let raw: { keys?: unknown; pad?: unknown } = {};
    try { raw = JSON.parse(this.store?.getItem(STORAGE_KEY) ?? '{}') ?? {}; } catch { raw = {}; }
    this.keys = sanitize(raw.keys, DEFAULT_KEYS, isCode);
    this.pad = sanitize(raw.pad, DEFAULT_PAD, isButton);
  }

  save(): void {
    try { this.store?.setItem(STORAGE_KEY, JSON.stringify({ keys: this.keys, pad: this.pad })); } catch { /* private mode: keep in memory */ }
  }

  resetKeys(): void { this.keys = clone(DEFAULT_KEYS); this.save(); }
  resetPad(): void { this.pad = clone(DEFAULT_PAD); this.save(); }

  bindKey(action: Action, slot: number, code: string): BindResult {
    if (code in RESERVED) return { ok: false, reason: `${keyLabel(code)} IS RESERVED: ${RESERVED[code]}` };
    const r = bindIn(this.keys, action, slot, code);
    if (r.ok) this.save();
    return r;
  }

  bindPad(action: Action, slot: number, button: number): BindResult {
    const r = bindIn(this.pad, action, slot, button);
    if (r.ok) this.save();
    return r;
  }

  /** Backup slots can be emptied; the main slot always keeps a key. */
  clearKey(action: Action, slot: number): boolean {
    if (slot !== 1 || this.keys[action][1] === null) return false;
    this.keys[action][1] = null;
    this.save();
    return true;
  }

  codes(action: Action): string[] { return this.keys[action].filter((c): c is string => c !== null); }

  has(action: Action, code: string): boolean { return this.keys[action].includes(code); }

  /** Short label of an action's main key, for help text. */
  label(action: Action): string { return keyLabel(this.keys[action][0]); }

  /** One-line control summary for the title screen and pause menu. */
  summary(): string {
    const arrows = (['left', 'right', 'up', 'down'] as const).every((a) => this.keys[a][0] === DEFAULT_KEYS[a][0]);
    const move = arrows ? 'ARROWS' : `${this.label('left')}/${this.label('right')}/${this.label('up')}/${this.label('down')}`;
    return `${move} MOVE/AIM  ${this.label('jump')} JUMP  ${this.label('jack')} JACK  ${this.label('dash')} DASH  ${this.label('recal')} TRUE VIEW  ${this.label('pause')} PAUSE`;
  }

  /**
   * Replace `{action}` tokens in player-facing text with the bound key, e.g.
   * "HOLD {jack} TO SWING". `{recall}` reads as the jack key, which pulls the cable back.
   */
  fill(text: string): string {
    return text.replace(/\{(\w+)\}/g, (m, name: string) => {
      if (name === 'recall') return this.label('jack');
      return name in this.keys ? this.label(name as Action) : m;
    });
  }
}

const NAMED: Record<string, string> = {
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
  Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', NumpadEnter: 'NUM ENTER', Backspace: 'BKSP', Tab: 'TAB',
  ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT', AltRight: 'R-ALT', CapsLock: 'CAPS', ContextMenu: 'MENU',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PG UP', PageDown: 'PG DN',
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .',
};

/** Human label for a `KeyboardEvent.code`. */
export function keyLabel(code: string | null): string {
  if (!code) return '--';
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `NUM ${code.slice(6)}`;
  return code.toUpperCase().slice(0, 8);
}

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3', 'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT', 'HOME'];

/** Human label for a standard-mapping gamepad button (Xbox-style names). */
export function padLabel(button: number | null): string {
  if (button === null) return '--';
  return PAD_NAMES[button] ?? `B${button}`;
}

/**
 * Reports the first gamepad button that goes down after `arm()`. Groundwork
 * for gamepad remapping; nothing calls it yet.
 */
export class PadCapture {
  private held = new Set<number>();

  constructor(private read: () => readonly (Gamepad | null)[] = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [])) {}

  private pressed(): Set<number> {
    const out = new Set<number>();
    const pad = Array.from(this.read() ?? []).find((p) => p && p.connected);
    pad?.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) out.add(i); });
    return out;
  }

  /** Start listening; buttons already held are ignored until released. */
  arm(): void { this.held = this.pressed(); }

  /** Call once per frame. Returns a newly pressed button index, or null. */
  poll(): number | null {
    const now = this.pressed();
    let hit: number | null = null;
    for (const b of now) if (!this.held.has(b)) { hit = b; break; }
    this.held = now;
    return hit;
  }
}

/** The shared, persisted controls profile. */
export const Controls = new Bindings();

export const fillKeys = (text: string): string => Controls.fill(text);
