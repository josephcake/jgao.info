import Phaser from 'phaser';
import { Audio } from '../core/Audio';
import { overlaps, type Rect } from './physics';
import type { EntityDef } from './RoomData';
import type { GameScene } from '../scenes/GameScene';

/**
 * A data chip: an item Pix picks up by touching it and carries over his head until he
 * brings it to a slot. Authored as `entity {"type":"chip","x":..,"y":..}`.
 */
export class Chip {
  readonly x: number;
  readonly y: number;
  carried = false;
  used = false;
  private t = Math.random() * 10;
  private g: Phaser.GameObjects.Graphics;

  constructor(w: GameScene, def: EntityDef) {
    this.x = (def.x + 0.5) * w.tile;
    this.y = (def.y + 0.5) * w.tile;
    this.g = w.addHero(w.add.graphics().setDepth(46));
  }

  update(dt: number, w: GameScene): void {
    this.t += dt;
    const p = w.player;
    if (!this.carried && !this.used && !p.dead) {
      const r: Rect = { x: this.x - 14, y: this.y - 16, w: 28, h: 32 };
      if (overlaps(p, r)) {
        this.carried = true;
        Audio.play('plug');
        w.fx.ring(this.x, this.y, 0xe0b050);
        w.toast('GOT A DATA CHIP. FIND THE SLOT IT FITS.', 0xe0b050);
      }
    }
    const g = this.g;
    g.clear();
    if (this.used) return;
    const x = this.carried ? p.cx : this.x;
    const y = this.carried ? p.y - 22 : this.y + Math.sin(this.t * 2.5) * 4;
    drawChip(g, x, y, 0.5 + 0.5 * Math.sin(this.t * 4));
  }
}

/**
 * A card slot beside a door. Bring a chip to it and it clicks in, turning its `id` on
 * for good: doors listing that id open. Authored as `entity {"type":"slot","x":..,"y":..,"id":"k1"}`.
 */
export class Slot {
  readonly x: number;
  readonly y: number;
  readonly id: string;
  filled = false;
  private g: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor(w: GameScene, def: EntityDef) {
    this.x = (def.x + 0.5) * w.tile;
    this.y = (def.y + 0.5) * w.tile;
    this.id = def.id ?? '';
    if (this.id) w.power.add(this.id, 'toggle', false);
    this.g = w.addWorld(w.add.graphics().setDepth(4));
  }

  update(dt: number, w: GameScene, chips: Chip[]): void {
    this.t += dt;
    const p = w.player;
    if (!this.filled && !p.dead && Math.hypot(p.cx - this.x, p.cy - this.y) < w.tile * 1.6) {
      const chip = chips.find((c) => c.carried && !c.used);
      if (chip) {
        chip.carried = false;
        chip.used = true;
        this.filled = true;
        if (this.id) w.power.toggle(this.id);
        Audio.play('gate');
        w.juice.shake(4, 0.25);
        w.fx.ring(this.x, this.y, 0x30ff7a);
        w.toast('CHIP ACCEPTED. DOOR OPEN.', 0x30ff7a);
      }
    }
    const g = this.g;
    g.clear();
    // the housing, the card slot, and a light: red waiting, green once filled
    g.fillStyle(0x07080e, 1).fillRect(this.x - 15, this.y - 12, 30, 24);
    g.fillStyle(0x262a38, 1).fillRect(this.x - 15, this.y - 12, 30, 3);
    g.fillStyle(0x000000, 1).fillRect(this.x - 9, this.y - 3, 18, 5);
    if (this.filled) drawChip(g, this.x, this.y - 1, 1, 0.6);
    const blink = this.filled || Math.sin(this.t * 4) > -0.2;
    g.fillStyle(this.filled ? 0x30ff7a : 0xff3a4a, blink ? 1 : 0.35).fillRect(this.x + 9, this.y + 5, 3, 3);
  }
}

/** A little memory card: dark body, gold contacts, a glow that pulses. */
function drawChip(g: Phaser.GameObjects.Graphics, x: number, y: number, glow: number, scale = 1): void {
  const s = (v: number) => Math.round(v * scale);
  const snap = (v: number) => Math.round(v / 3) * 3;
  x = snap(x); y = snap(y);
  g.fillStyle(0xe0b050, 0.18 * glow).fillRect(x - s(17), y - s(14), s(34), s(28));
  g.fillStyle(0x0a0b10, 1).fillRect(x - s(11), y - s(9), s(22), s(18));
  g.fillStyle(0x1a1d28, 1).fillRect(x - s(11), y - s(9), s(22), s(3));
  g.fillStyle(0x3a3e4c, 1).fillRect(x - s(7), y - s(4), s(10), s(6));
  for (let i = 0; i < 4; i++) g.fillStyle(0xe0b050, 1).fillRect(x - s(9) + s(i * 5), y + s(5), s(3), s(4));
  g.fillStyle(0xe0b050, 1).fillRect(x + s(6), y - s(6), s(3), s(3));
}
