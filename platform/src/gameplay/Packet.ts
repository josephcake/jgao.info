import Phaser from 'phaser';
import { Audio } from '../core/Audio';
import { packetId, Save } from '../core/Save';
import type { EntityDef } from './RoomData';
import { overlaps } from './physics';
import type { GameScene } from '../scenes/GameScene';

/**
 * A lost packet: the optional collectible, usually off the main route. It only
 * counts once the room is finished; die first and it goes back. Packets already
 * recovered on an earlier visit show as a hollow outline and can't be collected again.
 */
export class Packet {
  readonly id: string;
  taken = false;
  private readonly known: boolean;
  private x: number;
  private y: number;
  private t = Math.random() * 6;
  private g: Phaser.GameObjects.Graphics;

  constructor(w: GameScene, def: EntityDef) {
    const tile = w.tile;
    this.x = (def.x + 0.5) * tile;
    this.y = (def.y + 0.5) * tile;
    this.id = packetId(w.room.id, def.x, def.y);
    this.known = Save.hasPacket(w.level.id, this.id);
    this.g = w.addHero(w.add.graphics().setDepth(40));
  }

  update(dt: number, w: GameScene): void {
    this.t += dt;
    const g = this.g;
    g.clear();
    if (this.taken) return;
    const bob = Math.round((Math.sin(this.t * 3) * 6) / 3) * 3;
    const x = Math.round(this.x / 3) * 3, y = Math.round(this.y / 3) * 3 + bob;
    if (this.known) {
      g.lineStyle(3, 0x9ff6ff, 0.35).strokeRect(x - 12, y - 9, 24, 18);
    } else {
      // a little envelope of light: three sub-pixel stripes in a frame
      const glow = 0.25 + 0.15 * Math.sin(this.t * 6);
      g.fillStyle(0xffffff, glow).fillRect(x - 18, y - 15, 36, 30);
      g.fillStyle(0x0a0d24, 1).fillRect(x - 12, y - 9, 24, 18);
      g.fillStyle(0xff3a5a, 1).fillRect(x - 9, y - 6, 6, 12);
      g.fillStyle(0x30ff7a, 1).fillRect(x - 3, y - 6, 6, 12);
      g.fillStyle(0x3a8aff, 1).fillRect(x + 3, y - 6, 6, 12);
      if (Math.sin(this.t * 2.3) > 0.9) w.fx.sparkles(x, y, 1, undefined, 30);
    }
    const p = w.player;
    if (p.dead) return;
    if (overlaps(p, { x: this.x - 18, y: this.y - 18 + bob, w: 36, h: 36 })) {
      this.taken = true;
      Audio.play('charge');
      w.juice.hitstop(0.06);
      w.fx.sparkles(this.x, this.y, this.known ? 6 : 24, undefined, 30);
      w.toast(this.known ? 'PACKET ALREADY DELIVERED. STILL NICE.' : 'LOST PACKET RECOVERED. FINISH THE ROOM TO KEEP IT.', 0x9ff6ff);
    }
  }
}
