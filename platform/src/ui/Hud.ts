import Phaser from 'phaser';
import { LENS_COLOR } from '../gameplay/Colours';
import { T } from '../config/tuning';
import { Audio } from '../core/Audio';
import { fillKeys } from '../core/Bindings';
import type { GameScene } from '../scenes/GameScene';

const FONT = '"Press Start 2P", monospace';
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** PKT's interface overlay. Drawn on the UI camera, pixel-crisp. */
export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private clock: Phaser.GameObjects.Text;
  private bannerTitle: Phaser.GameObjects.Text;
  private bannerSub: Phaser.GameObjects.Text;
  private bannerTime = 0;
  private bannerFull = '';
  private toastText: Phaser.GameObjects.Text;
  private toastTime = 0;
  private termBox: Phaser.GameObjects.Graphics;
  private termText: Phaser.GameObjects.Text;
  private termFull = '';
  private termShown = 0;
  private termAlpha = 0;
  private fade: Phaser.GameObjects.Rectangle;
  private flashRect: Phaser.GameObjects.Rectangle;
  private flashTime = 0;
  private flashDur = 1;
  private big: Phaser.GameObjects.Text;
  /** Seconds left on the big text; 0 keeps it up (deaths clear it with the room). */
  private bigTime = 0;
  fadeAlpha = 1;
  fadeTarget = 0;

  constructor(private w: GameScene) {
    const add = <O extends Phaser.GameObjects.GameObject>(o: O) => w.addUi(o);
    this.g = add(w.add.graphics().setDepth(100));
    this.label = add(w.add.text(24, 18, 'PIX', { fontFamily: FONT, fontSize: '12px', color: '#9ff6ff' }).setDepth(101));
    this.status = add(w.add.text(24, 76, '', { fontFamily: FONT, fontSize: '10px', color: '#9ff6ff' }).setDepth(101));
    this.clock = add(w.add.text(1256, 18, '', { fontFamily: FONT, fontSize: '12px', color: '#9ff6ff', align: 'right' }).setOrigin(1, 0).setDepth(101));
    this.bannerTitle = add(w.add.text(640, 300, '', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#ff2bd6', strokeThickness: 6 }).setOrigin(0.5).setDepth(101));
    this.bannerSub = add(w.add.text(640, 346, '', { fontFamily: FONT, fontSize: '12px', color: '#9ff6ff' }).setOrigin(0.5).setDepth(101));
    this.toastText = add(w.add.text(640, 200, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#0a0d24', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setDepth(101));
    this.termBox = add(w.add.graphics().setDepth(100));
    this.termText = add(w.add.text(640, 96, '', { fontFamily: FONT, fontSize: '13px', color: '#7dffa8', align: 'left', lineSpacing: 10 }).setOrigin(0.5, 0.5).setDepth(101));
    this.fade = add(w.add.rectangle(640, 360, 1280, 720, 0x05030f, 1).setDepth(200));
    this.flashRect = add(w.add.rectangle(640, 360, 1280, 720, 0xffffff, 1).setDepth(199).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));
    this.big = add(w.add.text(640, 340, '', { fontFamily: FONT, fontSize: '28px', color: '#ff2bd6', stroke: '#05030f', strokeThickness: 8, align: 'center', lineSpacing: 18 }).setOrigin(0.5).setDepth(201));
  }

  banner(title: string, sub: string): void {
    this.bannerFull = title;
    this.bannerTime = 0;
    this.bannerSub.setText(sub.toUpperCase());
  }

  toast(msg: string, color = 0xffffff): void {
    this.toastText.setText(fillKeys(msg)).setColor(hex(color));
    this.toastTime = 2.2;
  }

  showTerminal(raw: string | null): void {
    const text = raw && fillKeys(raw);
    if (text && text !== this.termFull) {
      this.termFull = text;
      this.termShown = 0;
    }
    if (!text) this.termFull = this.termAlpha > 0 ? this.termFull : '';
    this.termAlphaTarget = text ? 1 : 0;
  }
  private termAlphaTarget = 0;

  /** A full-screen wash of colour that fades out. */
  flash(color: number, secs: number): void {
    this.flashRect.setFillStyle(color, 1);
    this.flashTime = this.flashDur = secs;
  }

  bigText(msg: string, color = 0xff2bd6, secs = 0): void {
    this.big.setText(msg).setColor(hex(color)).setAlpha(1);
    this.bigTime = secs;
  }

  update(dt: number): void {
    const w = this.w;
    const p = w.player;
    const g = this.g;
    g.clear();

    // lens energy (hard mode only), in the colour being carried; hidden until Pix has a colour
    if (w.owned.length) {
      if (w.hard) {
        const e = w.recalEnergy / T.recalibrate.maxEnergy;
        g.fillStyle(0x0a0d24, 1).fillRect(21, 61, 116, 10);
        g.fillStyle(w.recalLocked ? 0x6a3a3a : w.lens ? LENS_COLOR[w.lens] : 0xd8c8a8, 1).fillRect(24, 64, 110 * e, 4);
      }
      // a swatch per recovered colour
      const sx = w.hard ? 142 : 24;
      w.owned.forEach((h, i) => g.fillStyle(LENS_COLOR[h], 1).fillRect(sx + i * 12, 61, 9, 10));
    }

    const c = w.cable;
    const st: Record<string, string> = {
      idle: 'CABLE: READY', retract: 'CABLE: READY', shoot: 'CABLE: OUT', swing: 'CABLE: SWING', zip: 'CABLE: ZIP',
      tether: 'CABLE: LIVE ({recall} DROP)', placed: 'CABLE: PLACED ({recall} RECALL)', hack: 'CABLE: HACK',
    };
    const lensHint = w.hard ? (w.owned.length ? '   LENS [{recal}]' : '') : w.owned.length === 3 ? '   TRUE VIEW [{recal}]' : '';
    this.status.setText(fillKeys(`${st[c.state]}${lensHint}`)).setColor(c.live ? '#30ff7a' : '#9ff6ff');

    const secs = w.runTime;
    const mm = Math.floor(secs / 60).toString().padStart(2, '0');
    const ss = (secs % 60).toFixed(1).padStart(4, '0');
    this.clock.setText(`${w.level.tag}${w.roomIndex + 1}/${w.level.rooms.length}  ${mm}:${ss}\nRESETS ${w.deaths}`);

    // banner: glitch type-in
    this.bannerTime += dt;
    const n = Math.min(this.bannerFull.length, Math.floor(this.bannerTime * 24));
    let shown = this.bannerFull.slice(0, n);
    if (n < this.bannerFull.length) shown += String.fromCharCode(33 + Math.floor(Math.random() * 60));
    this.bannerTitle.setText(shown);
    const ba = this.bannerTime < 2.8 ? 1 : Math.max(0, 1 - (this.bannerTime - 2.8) * 1.5);
    this.bannerTitle.setAlpha(ba).setX(640 + (Math.random() < 0.05 ? (Math.random() - 0.5) * 12 : 0));
    this.bannerSub.setAlpha(ba * Math.min(1, this.bannerTime * 2));

    this.toastTime = Math.max(0, this.toastTime - dt);
    this.toastText.setAlpha(Math.min(1, this.toastTime * 2));

    // terminal box
    this.termAlpha += (this.termAlphaTarget - this.termAlpha) * Math.min(1, dt * 10);
    const tb = this.termBox;
    tb.clear();
    if (this.termAlpha > 0.02 && this.termFull) {
      const prev = Math.floor(this.termShown);
      this.termShown = Math.min(this.termFull.length, this.termShown + dt * 70);
      if (Math.floor(this.termShown) !== prev && this.termAlphaTarget > 0 && Math.floor(this.termShown) % 2 === 0) Audio.play('type');
      this.termText.setText(this.termFull.slice(0, Math.floor(this.termShown)) + (Math.sin(w.simTime * 10) > 0 ? '_' : ' '));
      const bw = 760, bh = 120;
      tb.fillStyle(0x03140a, 0.88 * this.termAlpha).fillRect(640 - bw / 2, 96 - bh / 2, bw, bh);
      tb.lineStyle(3, 0x30ff7a, this.termAlpha).strokeRect(640 - bw / 2, 96 - bh / 2, bw, bh);
      for (let y = 96 - bh / 2; y < 96 + bh / 2; y += 4) tb.fillStyle(0x000000, 0.18 * this.termAlpha).fillRect(640 - bw / 2, y, bw, 1);
      this.termText.setAlpha(this.termAlpha);
    } else this.termText.setAlpha(0);

    this.fadeAlpha += (this.fadeTarget - this.fadeAlpha) * Math.min(1, dt * 14);
    if (this.bigTime > 0) {
      this.bigTime -= dt;
      this.big.setAlpha(Math.min(1, this.bigTime * 2));
      if (this.bigTime <= 0) this.big.setText('');
    }
    this.fade.setAlpha(this.fadeAlpha);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.flashRect.setAlpha(0.7 * (this.flashTime / this.flashDur) ** 2);
  }
}
