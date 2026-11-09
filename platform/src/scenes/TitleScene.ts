import Phaser from 'phaser';
import { Audio } from '../core/Audio';
import { Controls } from '../core/Bindings';
import { Save } from '../core/Save';
import { PadEdge, readPad } from '../core/Input';
import { makeHeroTexture } from '../render/PixelHero';
import { LEVELS } from '../gameplay/RoomData';

type Item = { label: string; action: 'new' | 'load' | 'select' | 'training' | 'settings' };

/** The main menu. New Game asks for a mode first. */
const MENU: Item[] = [
  { label: 'NEW GAME', action: 'new' },
  { label: 'LOAD GAME', action: 'load' },
  { label: 'LEVEL SELECT', action: 'select' },
  { label: 'TRAINING', action: 'training' },
  { label: 'SETTINGS', action: 'settings' },
];

const MODES: { label: string; hard: boolean }[] = [
  { label: 'NORMAL', hard: false },
  { label: 'HARD', hard: true },
];

const FONT = '"Press Start 2P", monospace';
const W = 1280, H = 720;
const MENU_Y = 430, ROW = 40;
/** Level Select: a scrolling list, this many rows at a time. */
const SELECT_Y = 410, SELECT_ROW = 30, VISIBLE = 8;
const PKT_SCALE = 5;

/** Seconds of menu inactivity before the gameplay video starts. */
const IDLE_SECONDS = 15;
/** Looked up in `public/`. If the file is missing the attract mode quietly does nothing. */
const ATTRACT_SRC = `${import.meta.env.BASE_URL}attract.mp4`;

/** Where the i's dot was, in logo texture pixels: the beating stripes go there. */
let logoDot: { x: number; y: number; w: number; h: number } | null = null;

/**
 * The "Dead Pixel" logo: black text with a white outline, with the dot of the i cleared
 * away. The title draws a tiny beating Pix there instead (see `drawDot`).
 */
function logoTexture(scene: Phaser.Scene): string {
  const key = 'title_logo';
  if (scene.textures.exists(key)) return key;
  const text = 'Dead Pixel', fs = 64, stroke = 10, pad = 16;
  const font = `${fs}px ${FONT}`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const tw = Math.ceil(probe.measureText(text).width);
  const cw = tw + pad * 2, ch = fs + pad * 2;
  // a fill-only pass to find the i's dot: the first run of filled rows in its column
  const scan = document.createElement('canvas');
  scan.width = cw; scan.height = ch;
  const sx = scan.getContext('2d')!;
  sx.font = font; sx.textBaseline = 'top'; sx.fillStyle = '#000';
  sx.fillText(text, pad, pad);
  const i0 = pad + Math.floor(probe.measureText('Dead P').width), i1 = pad + Math.ceil(probe.measureText('Dead Pi').width);
  const px = sx.getImageData(0, 0, cw, ch).data;
  const filled = (x: number, y: number) => px[(y * cw + x) * 4 + 3] > 128;
  let dotTop = -1, dotBot = -1, dotL = cw, dotR = -1;
  for (let y = 0; y < ch; y++) {
    let any = false;
    for (let x = i0; x < i1; x++) if (filled(x, y)) { any = true; if (dotBot < 0) { dotL = Math.min(dotL, x); dotR = Math.max(dotR, x); } }
    if (any && dotTop < 0) dotTop = y;
    if (!any && dotTop >= 0 && dotBot < 0) { dotBot = y; break; }
  }
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.font = font; ctx.textBaseline = 'top'; ctx.lineJoin = 'miter';
  ctx.lineWidth = stroke; ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, pad, pad);
  ctx.fillStyle = '#000000';
  ctx.fillText(text, pad, pad);
  if (dotTop >= 0 && dotBot > dotTop) {
    // clear the dot and its outline, down to half way through the gap above the stem
    ctx.clearRect(i0, 0, i1 - i0, dotBot + 2);
    logoDot = { x: dotL, y: dotTop, w: dotR + 1 - dotL, h: dotBot - dotTop };
  }
  scene.textures.addCanvas(key, c);
  return key;
}

/** A faint data lane with a packet or two gliding along it. */
interface Lane { y: number; a: number; packets: { x: number; speed: number; len: number }[] }

export class TitleScene extends Phaser.Scene {
  private t = 0;
  private started = false;
  private pad = new PadEdge();
  private padY = 0;
  private sel = 0;
  /** Which list is up: the main menu, New Game's mode pick, Level Select's levels, or a level's rooms. */
  private screen: 'main' | 'mode' | 'levels' | 'select' = 'main';
  /** Level Select's levels: story levels with at least one finished room. */
  private levels: { label: string; level: number }[] = [];
  /** The rooms of the chosen level that have been finished at least once, in story order. */
  private done: { label: string; room: number }[] = [];
  private pickedLevel = 1;
  private more!: Phaser.GameObjects.Text;
  private items: Phaser.GameObjects.Text[] = [];
  private marker!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private heading!: Phaser.GameObjects.Text;
  private pkt!: Phaser.GameObjects.Image;
  private g!: Phaser.GameObjects.Graphics;
  private logo!: Phaser.GameObjects.Image;
  private dot!: Phaser.GameObjects.Graphics;
  private beatPhase = 0;
  private lanes: Lane[] = [];
  private idle = 0;
  private video: HTMLVideoElement | null = null;
  private videoFailed = false;

  constructor() {
    super('title');
  }

  create(data: { sel?: number } = {}): void {
    this.started = false;
    this.idle = 0;
    this.screen = 'main';
    this.video = null;
    this.events.once('shutdown', () => this.stopVideo());
    this.cameras.main.setBackgroundColor(0x05071a);

    // a calm backdrop: a few faint data lanes, packets drifting along them
    this.g = this.add.graphics();
    this.lanes = [];
    for (let i = 0; i < 7; i++) {
      const n = 1 + (i % 3 === 0 ? 1 : 0);
      this.lanes.push({
        y: 70 + i * 92 + ((i * 37) % 23),
        a: 0.03 + (i % 3) * 0.015,
        packets: Array.from({ length: n }, (_, k) => ({ x: ((i * 311 + k * 640) % W), speed: (24 + ((i * 17) % 30)) * (i % 2 ? 1 : -1), len: 10 + ((i * 7) % 14) })),
      });
    }

    // logo: black letters, white outline, the i dotted with Pix's three colours. Drawn once
    // the pixel font is ready, so the dot is found from the real glyph.
    const logo = this.add.image(W / 2, 170, '__DEFAULT').setVisible(false);
    this.logo = logo;
    this.dot = this.add.graphics();
    const draw = () => { if (logo.active) logo.setTexture(logoTexture(this)).setVisible(true); };
    if (document.fonts?.load) document.fonts.load(`64px ${FONT}`).then(draw, draw); else draw();
    this.add.text(W / 2, 236, 'ONE DEAD PIXEL. 2,073,599 LIVES ON THE LINE.', { fontFamily: FONT, fontSize: '11px', color: '#8a86b0' }).setOrigin(0.5);

    // Pix, small, showing the colours recovered so far
    makeHeroTexture(this, [Save.hasColour('red'), Save.hasColour('green'), Save.hasColour('blue')]);
    this.pkt = this.add.image(W / 2, 360, 'pkt', 0).setOrigin(0.5, 1).setScale(PKT_SCALE);

    this.heading = this.add.text(W / 2, MENU_Y - 46, '', { fontFamily: FONT, fontSize: '10px', color: '#6a6890' }).setOrigin(0.5);
    this.items = Array.from({ length: VISIBLE }, () => this.add.text(W / 2, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5));
    this.more = this.add.text(W / 2 + 230, SELECT_Y + (VISIBLE - 1) * SELECT_ROW, '', { fontFamily: FONT, fontSize: '10px', color: '#4a4870' }).setOrigin(0.5);
    this.marker = this.add.text(0, 0, '>', { fontFamily: FONT, fontSize: '16px', color: '#4ff3ff' }).setOrigin(0.5);
    this.footer = this.add.text(W / 2, H - 40, '', { fontFamily: FONT, fontSize: '10px', color: '#4a4870' }).setOrigin(0.5);

    this.sel = Phaser.Math.Clamp(data.sel ?? 0, 0, MENU.length - 1);
    if (!this.enabled(this.sel)) this.sel = 0;

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      this.idle = 0;
      if (this.video) { this.stopVideo(); return; }
      if (e.repeat) return;
      if (e.code === 'ArrowUp' || Controls.has('up', e.code)) this.move(-1);
      else if (e.code === 'ArrowDown' || Controls.has('down', e.code)) this.move(1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || Controls.has('jump', e.code)) this.go();
      else if (e.code === 'Escape') this.back();
    });
  }

  private list(): { label: string }[] {
    return this.screen === 'mode' ? MODES : this.screen === 'levels' ? this.levels : this.screen === 'select' ? this.done : MENU;
  }

  /** Load Game needs a game to load; Level Select needs a finished room. */
  private enabled(i: number): boolean {
    if (this.screen !== 'main') return true;
    const a = MENU[i].action;
    if (a === 'load') return Save.progress !== null;
    if (a === 'select') return Save.completed.length > 0;
    return true;
  }

  private move(d: number): void {
    if (this.started) return;
    const n = this.list().length;
    if (!n) return;
    do this.sel = (this.sel + d + n) % n; while (!this.enabled(this.sel));
    Audio.play('select');
  }

  private back(): void {
    if (this.screen === 'main' || this.started) return;
    if (this.screen === 'select') {
      this.screen = 'levels';
      this.sel = Math.max(0, this.levels.findIndex((l) => l.level === this.pickedLevel));
    } else {
      this.sel = MENU.findIndex((m) => m.action === (this.screen === 'mode' ? 'new' : 'select'));
      this.screen = 'main';
    }
    Audio.play('select');
  }

  /** The rooms of a story level that have been finished, for Level Select. */
  private finishedRooms(level: number): { label: string; room: number }[] {
    const ids = new Set(Save.completed);
    return LEVELS[level].rooms.map((r, i) => ({ label: r.name, room: i, id: r.id })).filter((e) => ids.has(e.id)).map(({ label, room }) => ({ label, room }));
  }

  private start(level: number, room: number, intro: boolean): void {
    this.started = true;
    Audio.play('exit');
    this.cameras.main.fadeOut(400, 5, 7, 26);
    this.time.delayedCall(420, () => this.scene.start('game', { level, room, intro }));
  }

  private go(): void {
    if (this.started) return;
    Audio.unlock();
    if (this.screen === 'mode') {
      Save.resetProgress();
      Save.setHard(MODES[this.sel].hard);
      this.start(1, 0, true);
      return;
    }
    if (this.screen === 'levels') {
      this.pickedLevel = this.levels[this.sel].level;
      this.done = this.finishedRooms(this.pickedLevel);
      this.screen = 'select';
      this.sel = 0;
      Audio.play('select');
      return;
    }
    if (this.screen === 'select') {
      this.start(this.pickedLevel, this.done[this.sel].room, false);
      return;
    }
    const item = MENU[this.sel];
    if (!this.enabled(this.sel)) return;
    if (item.action === 'new') {
      this.screen = 'mode';
      this.sel = Save.hard ? 1 : 0;
      Audio.play('select');
    } else if (item.action === 'select') {
      this.levels = LEVELS.map((l, i) => ({ label: `${l.name}  (${this.finishedRooms(i).length}/${l.rooms.length})`, level: i }))
        .filter((l) => l.level >= 1 && this.finishedRooms(l.level).length > 0);
      this.screen = 'levels';
      this.sel = 0;
      Audio.play('select');
    } else if (item.action === 'load') {
      const p = Save.progress!;
      this.start(p.level, p.room, false);
    } else if (item.action === 'training') {
      this.start(0, 0, false);
    } else {
      this.started = true;
      Audio.play('select');
      this.scene.start('controls', { from: 'title' });
    }
  }

  /**
   * The i's dot is a tiny Pix: three skinny red, green and blue stripes with dark gaps,
   * in a white outline, beating lub-dub like his stripes do in a colour zone.
   */
  private drawDot(dt: number): void {
    const g = this.dot;
    g.clear();
    if (!logoDot || !this.logo.visible) return;
    this.beatPhase = (this.beatPhase + dt * 0.9) % 1;
    const bump = (c: number, w: number) => Math.exp(-(((this.beatPhase - c) / w) ** 2));
    const beat = Math.max(bump(0.1, 0.06), 0.6 * bump(0.32, 0.06));
    const ox = this.logo.x - this.logo.width / 2, oy = this.logo.y - this.logo.height / 2;
    const stripe = 4, gap = 1, o = 3;
    const w = stripe * 3 + gap * 2, h = Math.round(logoDot.h * 1.35);
    const x0 = Math.round(ox + logoDot.x + logoDot.w / 2 - w / 2), y0 = Math.round(oy + logoDot.y + logoDot.h - h);
    const cols = [0xff3a4a, 0x30ff7a, 0x3a8aff], lit = [0xffa0a8, 0xb0ffd0, 0xa8ccff];
    // a soft glow on the beat
    g.fillStyle(0xffffff, 0.12 * beat).fillRect(x0 - o - 6, y0 - o - 6, w + (o + 6) * 2, h + (o + 6) * 2);
    g.fillStyle(0xffffff, 1).fillRect(x0 - o, y0 - o, w + o * 2, h + o * 2);
    g.fillStyle(0x0a0d24, 1).fillRect(x0, y0, w, h);
    cols.forEach((c, k) => {
      const x = x0 + k * (stripe + gap);
      g.fillStyle(c, 1).fillRect(x, y0, stripe, h);
      g.fillStyle(lit[k], beat).fillRect(x, y0, stripe, h);
    });
  }

  private startVideo(): void {
    if (this.video || this.videoFailed || this.started) return;
    const v = document.createElement('video');
    v.src = ATTRACT_SRC;
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:10;';
    v.addEventListener('error', () => { this.videoFailed = true; this.stopVideo(); });
    v.addEventListener('ended', () => { this.stopVideo(); this.idle = 0; });
    document.body.appendChild(v);
    this.video = v;
    v.play().catch(() => { this.videoFailed = true; this.stopVideo(); });
  }

  private stopVideo(): void {
    if (!this.video) return;
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.remove();
    this.video = null;
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    this.t += dt;
    const pad = readPad();
    const padActive = pad.stickX * pad.stickX + pad.stickY * pad.stickY > 0.16;
    if (this.pad.anyPressed()) {
      this.idle = 0;
      if (this.video) this.stopVideo();
      else this.go();
    } else if (padActive) {
      this.idle = 0;
      this.stopVideo();
    } else if (!this.video) {
      this.idle += dt;
      if (this.idle >= IDLE_SECONDS) this.startVideo();
    }
    const py = pad.down(12) || pad.stickY < -0.5 ? -1 : pad.down(13) || pad.stickY > 0.5 ? 1 : 0;
    if (py !== 0 && py !== this.padY) this.move(py);
    this.padY = py;

    // the menu: the selected row bright with a marker, the rest dim, unavailable ones dimmer.
    // Level Select scrolls, a window of rows around the selection.
    const list = this.list();
    const picking = this.screen === 'select' || this.screen === 'levels';
    const top = picking ? Phaser.Math.Clamp(this.sel - 3, 0, Math.max(0, list.length - VISIBLE)) : 0;
    const y0 = picking ? SELECT_Y : MENU_Y, row = picking ? SELECT_ROW : ROW;
    this.items.forEach((it, r) => {
      const i = top + r;
      if (i >= list.length) { it.setVisible(false); return; }
      const on = i === this.sel, ok = this.enabled(i);
      it.setVisible(true).setY(y0 + r * row).setFontSize(picking ? 13 : 16).setText(list[i].label).setColor(on ? '#ffffff' : ok ? '#6a6890' : '#2e2c4a');
    });
    const cur = this.items[this.sel - top];
    this.marker.setVisible(!!cur).setFontSize(picking ? 13 : 16);
    if (cur) this.marker.setPosition(cur.x - cur.width / 2 - 26 + Math.sin(this.t * 5) * 2, cur.y);
    const above = top > 0, below = top + VISIBLE < list.length;
    this.more.setText(picking && (above || below) ? `${above ? 'MORE ^' : ''}${above && below ? '  ' : ''}${below ? 'MORE v' : ''}` : '');
    const headings = { main: '', mode: 'NEW GAME  //  PICK A MODE', levels: 'LEVEL SELECT  //  PICK A LEVEL', select: `${LEVELS[this.pickedLevel].name}  //  PICK A ROOM` };
    this.heading.setY((picking ? SELECT_Y : MENU_Y) - 46).setText(headings[this.screen]);
    const keys = `${Controls.label('jump')} / ENTER`;
    const verb = this.screen === 'main' || this.screen === 'levels' ? 'SELECT' : 'START';
    this.footer.setText(`UP/DOWN  CHOOSE     ${keys}  ${verb}${this.screen === 'main' ? '' : '     ESC  BACK'}`);

    this.drawDot(dt);

    // Pix idles: the bits circle slowly
    this.pkt.setFrame([0, 1, 2, 3][Math.floor(this.t * 3) % 4]);

    const g = this.g;
    g.clear();
    for (const l of this.lanes) {
      g.fillStyle(0x3a6aff, l.a).fillRect(0, l.y, W, 2);
      for (const p of l.packets) {
        p.x = (((p.x + p.speed * dt) % W) + W) % W;
        g.fillStyle(0x8ad8ff, l.a * 3).fillRect(p.x - p.len / 2 - 3, l.y - 3, p.len + 6, 8);
        g.fillStyle(0x8ad8ff, Math.min(0.6, l.a * 9)).fillRect(p.x - p.len / 2, l.y - 1, p.len, 4);
      }
    }
  }
}
