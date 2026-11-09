import Phaser from 'phaser';
import { Controls, PAD, type Action } from './Bindings';

/** Snapshot of player intent for one fixed simulation step. */
export interface Intent {
  move: number;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
  jackPressed: boolean;
  jackHeld: boolean;
  recalHeld: boolean;
  /** Held 8-way direction, each axis -1/0/1. Cable resolves it into an aim. */
  dirX: number;
  dirY: number;
}

/** Scripted input for automated play-tests (`window.__dbg`). */
interface DebugInput {
  move?: number;
  up?: boolean;
  down?: boolean;
  jumpHeld?: boolean;
  jackHeld?: boolean;
  recalHeld?: boolean;
  press?: string[];
}

type Latch = 'jump' | 'dash' | 'jack' | 'pause';
const LATCHES: Latch[] = ['jump', 'dash', 'jack', 'pause'];

/** Fixed gamepad layout. `Controls.pad` holds a remappable copy that isn't wired in yet. */
const PAD_LATCH: [number[], Latch][] = [
  [[PAD.a], 'jump'],
  [[PAD.b], 'dash'],
  [[PAD.rt, PAD.rb], 'jack'],
  [[PAD.start], 'pause'],
];

export interface PadState {
  connected: boolean;
  stickX: number;
  stickY: number;
  down: (i: number) => boolean;
}

/** First connected standard gamepad, read straight from the browser. */
export function readPad(): PadState {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads ?? []).find((p) => p && p.connected) ?? null;
  if (!pad) return { connected: false, stickX: 0, stickY: 0, down: () => false };
  return {
    connected: true,
    stickX: pad.axes[0] ?? 0,
    stickY: pad.axes[1] ?? 0,
    down: (i) => {
      const b = pad.buttons[i];
      return !!b && (b.pressed || b.value > 0.4);
    },
  };
}

/** True on the frame any face/start button goes down. Used by menus. */
export class PadEdge {
  private prev = new Set<number>();
  anyPressed(): boolean {
    const pad = readPad();
    let fired = false;
    const now = new Set<number>();
    for (const i of [PAD.a, PAD.b, PAD.x, PAD.y, PAD.start]) {
      if (pad.down(i)) {
        now.add(i);
        if (!this.prev.has(i)) fired = true;
      }
    }
    this.prev = now;
    return fired;
  }
}

/**
 * Polls keyboard + gamepad once per rendered frame and latches edge presses so
 * the fixed-step simulation never misses a tap. No pointer input.
 */
export class InputMap {
  /** Physical keys currently held, as `KeyboardEvent.code`. */
  private held = new Set<string>();
  private latched = new Set<Latch>();
  private padPrev = new Set<number>();
  private pad: PadState = readPad();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      this.held.add(e.code);
      if (e.repeat) return;
      for (const l of LATCHES) if (Controls.has(l, e.code)) this.latched.add(l);
    });
    kb.on('keyup', (e: KeyboardEvent) => this.held.delete(e.code));
    const blur = () => this.clear();
    window.addEventListener('blur', blur);
    scene.events.once('shutdown', () => window.removeEventListener('blur', blur));
  }

  /** Forget held and latched keys, e.g. after another scene had the keyboard. */
  clear(): void {
    this.held.clear();
    this.latched.clear();
  }

  /** Call once per rendered frame, even while paused. */
  poll(): void {
    this.pad = readPad();
    const now = new Set<number>();
    for (const [buttons, latch] of PAD_LATCH) {
      for (const b of buttons) {
        if (!this.pad.down(b)) continue;
        now.add(b);
        if (!this.padPrev.has(b)) this.latched.add(latch);
      }
    }
    this.padPrev = now;
  }

  private down(action: Action): boolean {
    return Controls.codes(action).some((c) => this.held.has(c));
  }

  /** Consume a latched press. */
  take(name: Latch): boolean {
    const had = this.latched.has(name);
    this.latched.delete(name);
    return had;
  }

  /** Stick + d-pad snapped to 8 directions. */
  private padDir(): { x: number; y: number } {
    const p = this.pad;
    if (!p.connected) return { x: 0, y: 0 };
    let x = (p.down(PAD.right) ? 1 : 0) - (p.down(PAD.left) ? 1 : 0);
    let y = (p.down(PAD.down) ? 1 : 0) - (p.down(PAD.up) ? 1 : 0);
    const mag = Math.hypot(p.stickX, p.stickY);
    if (x === 0 && y === 0 && mag > 0.4) {
      const oct = Math.round(Math.atan2(p.stickY, p.stickX) / (Math.PI / 4));
      const a = (oct * Math.PI) / 4;
      x = Math.round(Math.cos(a));
      y = Math.round(Math.sin(a));
    }
    return { x, y };
  }

  intent(): Intent {
    const pd = this.padDir();
    const move = Math.sign((this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0) + pd.x);
    const vert = Math.sign((this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0) + pd.y);
    const pad = this.pad;
    const jackHeld = this.down('jack') || pad.down(PAD.rt) || pad.down(PAD.rb);

    const dbg = (window as unknown as { __dbg?: DebugInput | null }).__dbg;
    if (dbg) {
      const press = (k: string) => {
        const i = dbg.press?.indexOf(k) ?? -1;
        if (i >= 0) dbg.press!.splice(i, 1);
        return i >= 0;
      };
      const m = dbg.move ?? 0;
      const up = dbg.up ?? false;
      const down = dbg.down ?? false;
      return {
        move: m,
        up,
        down,
        jumpPressed: press('jump'),
        jumpHeld: dbg.jumpHeld ?? false,
        dashPressed: press('dash'),
        jackPressed: press('jack'),
        jackHeld: dbg.jackHeld ?? false,
        recalHeld: dbg.recalHeld ?? false,
        dirX: Math.sign(m),
        dirY: up ? -1 : down ? 1 : 0,
      };
    }

    return {
      move,
      up: vert < 0,
      down: vert > 0,
      jumpPressed: this.take('jump'),
      jumpHeld: this.down('jump') || pad.down(PAD.a),
      dashPressed: this.take('dash'),
      jackPressed: this.take('jack'),
      jackHeld,
      recalHeld: this.down('recal') || pad.down(PAD.lt) || pad.down(PAD.lb),
      dirX: move,
      dirY: vert,
    };
  }

  /** Clear latched presses that should not leak between frames (call after the sim). */
  flushFrame(): void {
    for (const k of ['jump', 'dash', 'jack'] as const) this.latched.delete(k);
  }
}
