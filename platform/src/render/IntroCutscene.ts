import Phaser from 'phaser';
import { Audio, type SfxName } from '../core/Audio';
import { fillKeys } from '../core/Bindings';
import type { GameScene } from '../scenes/GameScene';
import { FRAMES } from './PixelHero';

const FONT = '"Press Start 2P", monospace';
/** Drawn at 1/PX resolution and scaled up unfiltered, on the game's 3px grid. */
const PX = 3;
const VW = 1280, VH = 720;

// the monitor's screen, in room coordinates, as a grid of CELL-sized pixels
const SX = 540, SY = 180, CELL = 5, COLS = 80, ROWS = 45;
/** The pixel that is Pix. */
const PIX_COL = 52, PIX_ROW = 24;
const TX = SX + PIX_COL * CELL + CELL / 2, TY = SY + PIX_ROW * CELL + CELL / 2;
const ZOOM_MAX = 70;

const T_ZOOM = 5.0, T_ARRIVE = 8.8;
const T_FLICKER = 14.8, T_DEAD = 15.6;
const T_PIX = 15.9, T_JUMP = 21.8, T_GONE = 23.0, T_FADE = 23.6, T_END = 24.2;

const CAPTIONS: [number, number, string][] = [
  [0.3, 3.0, 'APARTMENT 4B. 2:13 AM.\nEVERYONE IS ASLEEP. THE MONITOR ISN\'T.'],
  [3.2, 6.0, 'IT HAS 2,073,600 PIXELS.\nEVERY NIGHT THEY DRAW THE SAME SCREENSAVER.'],
  [9.0, 11.6, 'THIS ONE IS PIX.\nSEVEN YEARS AT COLUMN 1342, ROW 611. NEVER ONCE MOVED.'],
  [11.8, 14.6, 'ALL NIGHT PIX LISTENS TO THE MODEM HUM\nAND WONDERS WHAT\'S ON THE OTHER END OF THE CABLE.'],
  [16.0, 18.4, 'PIX JUST DIED. HIS COLOURS SCATTERED\nDOWN THE CABLE, INTO THE NETWORK.'],
  [18.6, 21.0, 'PIX KNOWS WHAT HAPPENS TO A MONITOR\nWITH A DEAD PIXEL. IT GETS TOSSED OUT.'],
  [21.2, 23.6, 'ALONG WITH HIS WHOLE FAMILY.\nPIX NEEDS HIS COLOURS BACK. FAST.'],
];

const smooth = (a: number, b: number, t: number) => {
  const k = Phaser.Math.Clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/** Opening of Level 1: a quiet room, a zoom into the monitor, and one pixel going dark. */
export class IntroCutscene {
  private rt: Phaser.GameObjects.RenderTexture;
  private g: Phaser.GameObjects.Graphics;
  private bars: Phaser.GameObjects.Graphics;
  private caption: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private pix: Phaser.GameObjects.Image;
  private t = 0;
  private cue = new Set<string>();

  constructor(w: GameScene, private onDone: () => void = () => {}) {
    this.rt = w.addUi(w.add.renderTexture(0, 0, Math.ceil(VW / PX), Math.ceil(VH / PX)).setOrigin(0).setScale(PX).setDepth(150));
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.g = w.make.graphics({}, false);
    this.bars = w.addUi(w.add.graphics().setDepth(151));
    this.pix = w.addUi(w.add.image(640, 0, 'pkt', 0).setOrigin(0.5, 1).setScale(9).setDepth(152).setVisible(false));
    this.caption = w.addUi(
      w.add.text(640, 664, '', { fontFamily: FONT, fontSize: '13px', color: '#e8e0ff', align: 'center', lineSpacing: 10 })
        .setOrigin(0.5, 0.5).setDepth(153),
    );
    this.hint = w.addUi(w.add.text(1256, 30, fillKeys('{jump}: SKIP'), { fontFamily: FONT, fontSize: '10px', color: '#9ff6ff' }).setOrigin(1, 0.5).setDepth(153).setAlpha(0));
  }

  /** Returns false once finished (and cleaned up). */
  update(dt: number, skip: boolean): boolean {
    this.t += dt;
    const t = this.t;
    if ((skip && t > 0.3) || t >= T_END) {
      this.destroy();
      this.onDone();
      return false;
    }
    this.sounds(t);

    // camera: a slow push on the room, then a dive into one pixel
    const push = smooth(0, T_ZOOM, t);
    const dive = smooth(T_ZOOM, T_ARRIVE, t);
    const z = (1 + 0.25 * push) * Math.pow(ZOOM_MAX / 1.25, dive);
    const fx = Phaser.Math.Linear(Phaser.Math.Linear(640, 740, push), TX, dive);
    const fy = Phaser.Math.Linear(Phaser.Math.Linear(360, 300, push), TY, dive);

    const g = this.g;
    g.clear();
    g.setScale(z / PX).setPosition((VW / 2 - fx * z) / PX, (VH / 2 - fy * z) / PX);
    if (z < 20) this.drawRoom(g, t);
    this.drawScreen(g, t, z, fx, fy);
    this.rt.clear();
    this.rt.draw(g);

    this.drawPix(t, dt);
    this.drawOverlay(t);
    return true;
  }

  private sounds(t: number): void {
    const at = (k: string, time: number, name: SfxName) => {
      if (t >= time && !this.cue.has(k)) { this.cue.add(k); Audio.play(name); }
    };
    at('dive', T_ZOOM, 'charge');
    at('flicker', T_FLICKER, 'hack');
    at('dead', T_DEAD, 'nocarrier');
    at('pix', T_PIX, 'plug');
    at('jump', T_JUMP + 0.12, 'jump');
    at('gone', T_GONE - 0.15, 'unplug');
  }

  // ------------------------------------------------------------------ room

  private drawRoom(g: Phaser.GameObjects.Graphics, t: number): void {
    // wall, floor, skirting
    g.fillStyle(0x15122a, 1).fillRect(-400, -400, 2080, 960);
    g.fillStyle(0x1e1830, 1).fillRect(-400, 560, 2080, 600);
    g.fillStyle(0x2a2238, 1).fillRect(-400, 556, 2080, 6);

    // window: night city and rain
    g.fillStyle(0x0a1030, 1).fillRect(90, 110, 240, 250);
    for (let i = 0; i < 9; i++) {
      const bx = 96 + i * 26, bh = 60 + ((i * 37) % 90);
      g.fillStyle(0x141a40, 1).fillRect(bx, 360 - bh, 22, bh);
      if (i % 2) g.fillStyle(0xe0a050, 0.8).fillRect(bx + 6, 360 - bh + 14, 4, 4);
    }
    g.lineStyle(2, 0x6a78a8, 0.35);
    for (let i = 0; i < 14; i++) {
      const rx = 92 + ((i * 53 + t * 220) % 236), ry = 112 + ((i * 89 + t * 520) % 244);
      g.lineBetween(rx, ry, rx - 2, ry + 10);
    }
    g.fillStyle(0x2c2440, 1).fillRect(84, 104, 252, 8).fillRect(84, 104, 8, 262).fillRect(328, 104, 8, 262).fillRect(206, 104, 6, 262);
    g.fillStyle(0x3a3050, 1).fillRect(76, 360, 268, 10);

    // desk, router with blinking LEDs, the cable between them
    g.fillStyle(0x2a1e1a, 1).fillRect(380, 470, 820, 18);
    g.fillStyle(0x1e1612, 1).fillRect(400, 488, 18, 72).fillRect(1162, 488, 18, 72);
    g.fillStyle(0x1a1c26, 1).fillRect(1040, 440, 110, 30);
    g.fillStyle(0x2a2c38, 1).fillRect(1040, 440, 110, 4);
    g.lineStyle(4, 0x1a1c26, 1).lineBetween(1060, 440, 1050, 392).lineBetween(1130, 440, 1140, 392);
    [0x30ff7a, 0x30ff7a, 0xffb02a, 0x30ff7a].forEach((c, i) => {
      g.fillStyle(c, Math.sin(t * 7 + i * 2.1) > -0.2 ? 1 : 0.2).fillRect(1056 + i * 22, 452, 8, 4);
    });
    g.lineStyle(4, 0x2f6dff, 1);
    g.beginPath();
    g.moveTo(830, 440);
    for (let i = 1; i <= 12; i++) { const k = i / 12; g.lineTo(830 + k * 210, 440 + Math.sin(k * Math.PI) * 22 + k * 10); }
    g.strokePath();
    // a mug, gone cold
    g.fillStyle(0x6a3a4a, 1).fillRect(470, 444, 30, 26);
    g.lineStyle(4, 0x6a3a4a, 1).strokeCircle(504, 456, 8);

    // monitor: bezel, stand, and the screen's glow on the room
    g.fillStyle(0x0e0f16, 1).fillRect(SX - 18, SY - 18, COLS * CELL + 36, ROWS * CELL + 40);
    g.fillStyle(0x1a1c26, 1).fillRect(SX - 18, SY - 18, COLS * CELL + 36, 4);
    g.fillStyle(0x30ff7a, 1).fillRect(SX + COLS * CELL - 6, SY + ROWS * CELL + 10, 4, 3);
    g.fillStyle(0x0e0f16, 1).fillRect(720, SY + ROWS * CELL + 22, 40, 44).fillRect(670, 466, 140, 6);
    for (let r = 420; r > 0; r -= 60) g.fillStyle(0x4a6aff, 0.025).fillEllipse(740, 330, r * 2.2, r * 1.2);
  }

  // ---------------------------------------------------------------- screen

  /** Screensaver: a night gradient with a slow drifting logo. */
  private cellColor(c: number, r: number, t: number): number {
    const k = r / ROWS;
    let R = 16 + 40 * k, G = 24 + 6 * Math.sin(c * 0.08 + t * 0.6), B = 70 + 30 * (1 - k) + 10 * Math.sin(c * 0.05 - t * 0.4);
    const lx = 6 + Math.abs(((t * 4) % 56) - 28) * 2, ly = 2 + Math.abs(((t * 2.4) % 20) - 10);
    if (c >= lx && c < lx + 14 && r >= ly && r < ly + 6) {
      const hue = (t * 0.1) % 1;
      const col = Phaser.Display.Color.HSVToRGB(hue, 0.6, 0.9) as Phaser.Types.Display.ColorObject;
      R = col.r; G = col.g; B = col.b;
    }
    return (Math.round(R) << 16) | (Math.round(G) << 8) | Math.round(B);
  }

  private drawScreen(g: Phaser.GameObjects.Graphics, t: number, z: number, fx: number, fy: number): void {
    const hw = VW / 2 / z + CELL, hh = VH / 2 / z + CELL;
    const c0 = Math.max(0, Math.floor((fx - hw - SX) / CELL)), c1 = Math.min(COLS - 1, Math.ceil((fx + hw - SX) / CELL));
    const r0 = Math.max(0, Math.floor((fy - hh - SY) / CELL)), r1 = Math.min(ROWS - 1, Math.ceil((fy + hh - SY) / CELL));
    // how far into the close-up we are, in log space so it tracks the zoom evenly:
    // 0 = a flat image, 1 = every pixel resolved into three sub-pixel stripes
    const k = Phaser.Math.Clamp(Math.log(z / 3.5) / Math.log(50 / 3.5), 0, 1);
    const kk = k * k * (3 - 2 * k);
    // the gap between pixels opens up first, then each pixel splits into stripes
    // gaps are whole output pixels, so the grid never shimmers between 0 and 1px lines
    const cellPx = (CELL * z) / PX;
    const gapPx = cellPx >= 5 ? Math.max(1, Math.round(cellPx * 0.08 * Phaser.Math.Clamp(kk * 2.5, 0, 1))) : 0;
    const gap = (gapPx * PX) / z / 2;
    const split = Phaser.Math.Clamp(kk * 1.5 - 0.3, 0, 1);
    // Pix's pixel brightens a touch during the dive, so the eye has somewhere to land
    const lead = smooth(T_ZOOM, T_ZOOM + 1.5, t) * (t < T_FLICKER ? 1 : 0);
    if (k > 0) g.fillStyle(0x040408, 1).fillRect(SX + c0 * CELL, SY + r0 * CELL, (c1 - c0 + 1) * CELL, (r1 - r0 + 1) * CELL);
    const tint = [0xff2a2a, 0x2aff5a, 0x3a6aff];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        let col = this.cellColor(c, r, t);
        const me = c === PIX_COL && r === PIX_ROW;
        const alive = [1, 1, 1];
        if (me) {
          col = Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.IntegerToColor(col), Phaser.Display.Color.IntegerToColor(0x6a7aff), 1, lead)).color;
          if (t >= T_FLICKER && t < T_DEAD && Math.sin(t * 60) > 0.3) alive.fill(0.2);
          // the stripes go out one at a time: red, green, blue
          if (t >= T_DEAD - 0.4) alive[0] = 0;
          if (t >= T_DEAD - 0.2) alive[1] = 0;
          if (t >= T_DEAD) alive[2] = 0;
        }
        const x = SX + c * CELL + gap, y = SY + r * CELL + gap, sz = CELL - gap * 2;
        const ch = [(col >> 16) & 0xff, (col >> 8) & 0xff, col & 0xff];
        if (split < 1) {
          const dim = (alive[0] + alive[1] + alive[2]) / 3;
          if (dim > 0) g.fillStyle(col, (1 - split) * dim).fillRect(x, y, sz, sz);
        }
        if (split > 0) {
          for (let i = 0; i < 3; i++) {
            const lum = (0.25 + 0.75 * (ch[i] / 255)) * alive[i] * split;
            if (lum <= 0.01) continue;
            const sw = sz / 3;
            g.fillStyle(tint[i], lum).fillRect(x + i * sw + sw * 0.1 * split, y + sz * 0.04 * split, sw * (1 - 0.2 * split), sz * (1 - 0.08 * split));
          }
        }
      }
    }
    // scanlines and glass glare while the image is still an image
    const glass = Phaser.Math.Clamp(1 - Math.abs(Math.log(z / 2.5)) / 1.2, 0, 1);
    if (glass > 0 && z > 1.3) {
      for (let y = SY; y < SY + ROWS * CELL; y += 2) g.fillStyle(0x000000, 0.18 * glass).fillRect(SX, y, COLS * CELL, 0.6);
      g.fillStyle(0xffffff, 0.05 * glass).fillTriangle(SX, SY, SX + 160, SY, SX, SY + 120);
    }
  }

  // ---------------------------------------------------------------- pix

  /**
   * Pix pops out of the dead socket, looks around, then leaps into the dark
   * behind the pixel grid: shrinking away into the depth of the screen.
   */
  private drawPix(t: number, _dt: number): void {
    const show = t >= T_PIX && t < T_GONE + 0.2;
    this.pix.setVisible(show);
    if (!show) return;
    const floor = 530;
    let x = 640, y = floor, sx = 9, sy = 9, alpha = 1, frame: number;
    let shade = 0xffffff;
    if (t < T_JUMP) {
      const pop = smooth(T_PIX, T_PIX + 0.25, t);
      sx *= pop;
      y -= Math.abs(Math.sin((t - T_PIX) * 3)) * (t < T_PIX + 1.2 ? 18 : 0);
      // a glance left, a glance right
      this.pix.setFlipX(t > T_PIX + 1.4 && t < T_PIX + 2.0);
      frame = FRAMES.idle[Math.floor(t * 4) % FRAMES.idle.length];
    } else if (t < T_JUMP + 0.12) {
      // crouch
      sx *= 1.2; sy *= 0.8;
      frame = FRAMES.idle[0];
    } else {
      // up, then down and away into the black
      const k = (t - T_JUMP - 0.12) / (T_GONE - T_JUMP - 0.12);
      const up = Math.sin(Math.min(1, k * 2.2) * Math.PI) * 110 * (k < 0.45 ? 1 : 0);
      const depth = Math.pow(Phaser.Math.Clamp((k - 0.25) / 0.75, 0, 1), 1.6);
      const s = 9 * (1 - depth * 0.95);
      sx = s * (k < 0.15 ? 0.85 : 1); sy = s * (k < 0.15 ? 1.2 : 1);
      y = Phaser.Math.Linear(floor - up, 400, depth);
      x = 640;
      alpha = 1 - Math.pow(depth, 3);
      const d = Math.round(255 * (1 - depth * 0.85));
      shade = (d << 16) | (d << 8) | d;
      frame = k < 0.45 ? FRAMES.jump[0] : FRAMES.fall[0];
    }
    this.pix.setFrame(frame)
      .setPosition(Math.round(x / 3) * 3, Math.round(y / 3) * 3)
      .setScale(sx, sy).setAlpha(alpha).setTint(shade);
  }

  // --------------------------------------------------------------- overlay

  private drawOverlay(t: number): void {
    const b = this.bars;
    b.clear();
    // letterbox
    b.fillStyle(0x000000, 1).fillRect(0, 0, VW, 60).fillRect(0, VH - 112, VW, 112);
    if (t < 0.6) b.fillStyle(0x000000, 1 - t / 0.6).fillRect(0, 0, VW, VH);
    if (t >= T_FADE) b.fillStyle(0x000000, Math.min(1, (t - T_FADE) / (T_END - T_FADE - 0.1))).fillRect(0, 0, VW, VH);

    const cap = CAPTIONS.find(([a, z]) => t >= a && t < z);
    if (cap) {
      const [a, z, text] = cap;
      const n = Math.floor((t - a) * 40);
      this.caption.setText(text.slice(0, n)).setAlpha(Math.min(1, (z - t) * 4));
    } else this.caption.setText('');
    this.hint.setAlpha(t > 0.3 ? 0.6 : 0);
  }

  private destroy(): void {
    this.rt.destroy();
    this.g.destroy();
    this.bars.destroy();
    this.pix.destroy();
    this.caption.destroy();
    this.hint.destroy();
  }
}
