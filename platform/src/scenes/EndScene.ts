import Phaser from 'phaser';
import { LEVELS } from '../gameplay/RoomData';
import { Audio } from '../core/Audio';
import { Controls } from '../core/Bindings';
import { PadEdge } from '../core/Input';
import { backdropTextures } from '../render/CityDressing';

const FONT = '"Press Start 2P", monospace';

export class EndScene extends Phaser.Scene {
  private pad = new PadEdge();
  private ready = false;

  constructor() {
    super('end');
  }

  /** Stage to continue into, if there is one. */
  private next: number | null = null;

  create(data: { deaths?: number; runTime?: number; level?: number }): void {
    this.next = data.level !== undefined && data.level >= 1 && data.level + 1 < LEVELS.length ? data.level + 1 : null;
    const secs = data.runTime ?? 0;
    const mm = Math.floor(secs / 60).toString().padStart(2, '0');
    const ss = (secs % 60).toFixed(1).padStart(4, '0');
    this.cameras.main.setBackgroundColor(0x05030f);
    const bd = backdropTextures(this);
    this.add.image(0, 0, bd.sky).setOrigin(0).setAlpha(0.5);
    this.add.tileSprite(0, 200, 1280, 520, bd.far).setOrigin(0).setAlpha(0.35);
    this.add.tileSprite(0, 240, 1280, 520, bd.near).setOrigin(0).setTilePosition(600, 0).setAlpha(0.45);
    this.add.text(640, 200, data.level === 1 ? 'LAST MILE: DELIVERED.' : 'ROUTE FOUND.', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#ff2bd6', strokeThickness: 8 }).setOrigin(0.5);
    this.add.text(640, 300, `TIME ${mm}:${ss}     RESETS ${data.deaths ?? 0}`, { fontFamily: FONT, fontSize: '16px', color: '#4ff3ff' }).setOrigin(0.5);
    const body = this.add.text(
      640,
      350,
      data.level === 1
        ? 'THE UPLINK HUMS. THE PACKET GOT THROUGH.\nNOBODY SIGNED FOR IT. NOBODY EVER DOES.\n\nPIX FEELS GREEN AGAIN. HE IS TWO COLOURS BRIGHTER.\nONE TO GO.\n\nTHANKS FOR PLAYING DEAD PIXEL.'
        : 'THE ANALOG WORLD STILL DOESN\'T UNDERSTAND YOU.\nBUT NOW IT HAS A PORT WITH YOUR NAME ON IT.\n\nTHANKS FOR PLAYING DEAD PIXEL.',
      { fontFamily: FONT, fontSize: '12px', color: '#d8c8ff', align: 'center', lineSpacing: 14 },
    ).setOrigin(0.5, 0);
    const p = this.add.text(640, Math.min(680, body.y + body.height + 50), this.next !== null ? `PRESS ${Controls.label('jump')} OR ENTER TO HOP ON    ESC: TITLE` : `PRESS ${Controls.label('jump')} OR ENTER TO REBOOT`, { fontFamily: FONT, fontSize: '13px', color: '#30ff7a' }).setOrigin(0.5);
    this.tweens.add({ targets: p, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
    Audio.play('exit');
    this.ready = false;
    this.time.delayedCall(800, () => {
      this.ready = true;
      this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || Controls.has('jump', e.code)) this.go();
        else if (e.code === 'Escape') this.scene.start('title');
      });
    });
  }

  private go(): void {
    if (!this.ready) return;
    this.ready = false;
    if (this.next !== null) this.scene.start('game', { level: this.next, room: 0, intro: true });
    else this.scene.start('title');
  }

  update(): void {
    if (this.pad.anyPressed()) this.go();
  }
}
