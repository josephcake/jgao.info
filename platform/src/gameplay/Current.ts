import Phaser from 'phaser';
import { currentTiles, type CurrentSide } from './RoomData';
import type { GameScene } from '../scenes/GameScene';

interface Tile {
  x: number;
  y: number;
  side: CurrentSide;
  /** Which way the voltage flows along the surface: +1 or -1. A whole run shares one. */
  dir: 1 | -1;
}

/** Pixels between zigzag corners. */
const SEG = 8;
/** How fast the zigzag flows along the surface, in px/s. */
const FLOW = 150;

/** Triangle wave: -1 at 0, +1 at 1, -1 at 2, ... */
const tri = (s: number): number => {
  const f = ((s % 2) + 2) % 2;
  return f < 1 ? f * 2 - 1 : 3 - f * 2;
};

/**
 * The live current. The charred contact strip is baked into the terrain; the arc itself is
 * drawn here every frame: a zigzag of electricity that flows along the surface it runs on.
 * Touching it is instant death.
 */
export class CurrentArcs {
  private readonly tiles: Tile[] = [];
  private readonly g: Phaser.GameObjects.Graphics;
  private time = 0;
  private readonly t: number;

  constructor(w: GameScene) {
    this.t = w.tile;
    for (const { x, y, side } of currentTiles(w.room)) {
      const horiz = side === 'floor' || side === 'ceil';
      this.tiles.push({ x, y, side, dir: ((horiz ? y : x) & 1) === 0 ? 1 : -1 });
    }
    this.g = w.addHero(w.add.graphics().setDepth(40));
  }

  update(dt: number, w: GameScene): void {
    const g = this.g;
    g.clear();
    if (!this.tiles.length) return;
    this.time += dt;
    const t = this.t, time = this.time;
    const cam = w.cameras.main, view = cam.worldView, pad = 80;
    const snap = (v: number) => Math.round(v / 3) * 3;

    for (const tile of this.tiles) {
      const { x, y, side, dir } = tile;
      if (x * t < view.x - pad || x * t > view.right + pad || y * t < view.y - pad || y * t > view.bottom + pad) continue;
      const horiz = side === 'floor' || side === 'ceil';
      const U0 = horiz ? x * t : y * t;
      /** Surface coordinate U along the run and v out from the surface, to a world point. */
      const at = (U: number, v: number): [number, number] =>
        side === 'floor' ? [snap(U), snap((y + 1) * t - v)]
        : side === 'ceil' ? [snap(U), snap(y * t + v)]
        : side === 'left' ? [snap(x * t + v), snap(U)]
        : [snap((x + 1) * t - v), snap(U)];

      // two bolts, flowing at different speeds, so the current looks alive
      const bolts = [
        { phase: dir * time * FLOW, amp: 0.2, v0: 0.27, glow: 0xffd23a, core: 0xfffbd8, gw: 9, cw: 3 },
        { phase: dir * (time * FLOW * 0.62 + SEG), amp: 0.13, v0: 0.27, glow: 0x4fd8ff, core: 0xd8fbff, gw: 6, cw: 2 },
      ];
      for (const b of bolts) {
        // corners fall where (U - phase) / SEG is a whole number, so the zigzag slides continuously
        const pts: number[] = [U0];
        for (let k = Math.ceil((U0 - b.phase) / SEG); b.phase + k * SEG < U0 + t; k++) {
          const U = b.phase + k * SEG;
          if (U > U0) pts.push(U);
        }
        pts.push(U0 + t);
        const path: [number, number][] = pts.map((U) => {
          const jitter = 0.75 + 0.25 * Math.sin(U * 0.21 + time * 17);
          return at(U, t * (b.v0 + b.amp * jitter * tri((U - b.phase) / SEG)));
        });
        g.lineStyle(b.gw, b.glow, 0.22);
        g.beginPath(); g.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < path.length; i++) g.lineTo(path[i][0], path[i][1]);
        g.strokePath();
        g.lineStyle(b.cw, b.core, 1);
        g.beginPath(); g.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < path.length; i++) g.lineTo(path[i][0], path[i][1]);
        g.strokePath();
      }
      // the odd spark spitting off the arc
      if (Math.random() < 0.05) {
        const [sx, sy] = at(U0 + Math.random() * t, t * (0.3 + Math.random() * 0.35));
        g.fillStyle(0xffffff, 1).fillRect(sx, sy, 3, 3);
      }
    }
  }
}
