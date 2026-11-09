import Phaser from 'phaser';
import { pointInRect } from '../gameplay/physics';
import type { Player } from '../gameplay/Player';
import type { GameScene } from '../scenes/GameScene';

/** Rain in front of the world. Off: rooms keep a calm backdrop. */
const RAIN = false;
import { HERO_SCALE } from './PixelHero';

interface PixelP { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; g: number }
interface Chunk { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; life: number; stuck: boolean; rot: number }
interface Drop { x: number; y: number; len: number; speed: number }
interface Decal { x: number; y: number; life: number; w: number }
interface FloatText { t: Phaser.GameObjects.Text; life: number; vy: number }
interface Ghost { img: Phaser.GameObjects.Image; life: number }
interface Ring { x: number; y: number; r: number; life: number; color: number; pixel: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number }
interface Sparkle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: number; phase: number }

/**
 * Two particle worlds: pixel FX on PKT's unfiltered camera, smooth clay FX in
 * the perceived world.
 */
export class Fx {
  private pix: PixelP[] = [];
  private chunks: Chunk[] = [];
  private drops: Drop[] = [];
  private decals: Decal[] = [];
  private texts: FloatText[] = [];
  private ghosts: Ghost[] = [];
  private rings: Ring[] = [];
  private sparkList: Spark[] = [];
  private sparkleList: Sparkle[] = [];
  private gPix: Phaser.GameObjects.Graphics;
  private gBar: Phaser.GameObjects.Graphics;
  private gWorld: Phaser.GameObjects.Graphics;
  private gTrans: Phaser.GameObjects.Graphics;
  private gDecal: Phaser.GameObjects.Graphics;
  private gRain: Phaser.GameObjects.Graphics;
  private ghostCd = 0;

  constructor(private w: GameScene) {
    this.gDecal = w.addWorld(w.add.graphics().setDepth(0.5));
    // attack detail (sparks, beams, charge arcs) stays fine and unsnapped on PKT's camera
    this.gWorld = w.addHero(w.add.graphics().setDepth(53).setBlendMode(Phaser.BlendModes.ADD));
    this.gTrans = w.addHero(w.add.graphics().setDepth(51).setBlendMode(Phaser.BlendModes.ADD));
    this.gRain = w.addWorld(w.add.graphics().setDepth(30));
    this.gPix = w.addHero(w.add.graphics().setDepth(55));
    this.gBar = w.addHero(w.add.graphics().setDepth(56));
    for (let i = 0; i < 170; i++) this.drops.push({ x: Math.random() * 1400, y: Math.random() * 800, len: 10 + Math.random() * 18, speed: 700 + Math.random() * 500 });
  }

  beginStep(): void {
    this.gTrans.clear();
    this.gBar.clear();
  }

  // ------------------------------------------------------------- pixel side

  pixelBurst(x: number, y: number, n: number, color: number, speed: number, vyBias = -60): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.25 + Math.random() * 0.35;
      this.pix.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + vyBias, life, max: life, color, size: Math.random() < 0.3 ? 6 : 3, g: 600 });
    }
  }

  footstep(x: number, y: number, facing: number): void {
    for (let i = 0; i < 2; i++) {
      this.pix.push({ x: x + (Math.random() - 0.5) * 6, y: y - 2, vx: -facing * (30 + Math.random() * 50), vy: -40 - Math.random() * 60, life: 0.35, max: 0.35, color: Math.random() < 0.5 ? 0x4ff3ff : 0x1fa6d1, size: 3, g: 300 });
    }
    this.decals.push({ x, y, life: 2.5, w: 9 });
  }

  landDust(x: number, y: number, impact: number): void {
    const n = Math.min(16, 4 + Math.floor(impact / 80));
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      this.pix.push({ x: x + dir * 6, y: y - 2, vx: dir * (80 + Math.random() * 160), vy: -30 - Math.random() * 80, life: 0.4, max: 0.4, color: 0xbffbff, size: 3, g: 200 });
    }
    this.decals.push({ x: x - 8, y, life: 3, w: 12 });
    this.decals.push({ x: x + 8, y, life: 3, w: 12 });
  }

  ring(x: number, y: number, color: number, pixel = true): void {
    this.rings.push({ x, y, r: 6, life: 0.35, color, pixel });
  }

  afterimage(p: Player): void {
    this.ghostCd -= 1;
    if (this.ghostCd > 0) return;
    this.ghostCd = 2;
    const src = this.w.heroSprite;
    const img = this.w.addHero(this.w.add.image(src.x, src.y, 'pkt', src.frame.name).setOrigin(src.originX, src.originY).setScale(src.scaleX, src.scaleY).setFlipX(src.flipX).setDepth(45).setTintFill(0xff2bd6).setAlpha(0.6));
    this.ghosts.push({ img, life: 0.22 });
    void p;
  }

  pixelText(x: number, y: number, text: string, color: number): void {
    const t = this.w.addHero(this.w.add.text(x, y, text, { fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#0a0d24', strokeThickness: 4 }).setOrigin(0.5).setDepth(70));
    this.texts.push({ t, life: 0.8, vy: -70 });
  }

  hackGlyphs(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const t = this.w.addHero(this.w.add.text(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, Math.random() < 0.5 ? '0' : '1', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ff4fd8' }).setOrigin(0.5).setDepth(70));
      this.texts.push({ t, life: 0.5 + Math.random() * 0.4, vy: -90 - Math.random() * 80 });
    }
  }

  // ------------------------------------------------------------- clay side

  clayChunks(x: number, y: number, n: number, tint: number, spread = 6): void {
    for (let i = 0; i < n; i++) {
      if (this.chunks.length > 220) this.chunks.shift()?.img.destroy();
      const img = this.w.addWorld(this.w.add.image(x, y, 'chunk').setTint(tint).setDepth(19).setScale(0.6 + Math.random() * 0.9));
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const s = 150 + Math.random() * 380;
      this.chunks.push({ img, x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 2.5 + Math.random() * 2, stuck: false, rot: (Math.random() - 0.5) * 12 });
    }
  }

  sparks(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 200 + Math.random() * 400;
      this.sparkList.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.2 + Math.random() * 0.2 });
    }
  }

  /** Twinkling four-point stars that pop out, drift up and wink out. */
  sparkles(x: number, y: number, n: number, colors: number[] = [0xffffff, 0x9ff6ff, 0xfff36a, 0xff9ae6], spread = 40): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const s = 120 + Math.random() * 380;
      const life = 0.5 + Math.random() * 0.6;
      this.sparkleList.push({
        x: x + (Math.random() - 0.5) * spread, y: y - Math.random() * 10,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
        size: Math.random() < 0.3 ? 15 : 9, color: colors[Math.floor(Math.random() * colors.length)], phase: Math.random() * 6,
      });
    }
  }

  flyingDebris(x: number, y: number, tex: string, dir: number): void {
    const img = this.w.addWorld(this.w.add.image(x, y, tex).setDepth(19));
    this.chunks.push({ img, x, y, vx: dir * (300 + Math.random() * 200), vy: -500, life: 2.2, stuck: false, rot: dir * 8 });
  }

  laser(x0: number, y0: number, x1: number, y1: number, color: number, k: number): void {
    this.gTrans.lineStyle(2 + k * 6, color, 0.15 + k * 0.25);
    this.gTrans.lineBetween(x0, y0, x1, y1);
    this.gTrans.lineStyle(1 + k, 0xffffff, 0.4 + k * 0.5);
    this.gTrans.lineBetween(x0, y0, x1, y1);
  }

  /** A small pixel meter centred on (x, y): dark backing, `frac` of it filled. Redrawn every step. */
  bar(x: number, y: number, w: number, frac: number, color: number, alpha = 1): void {
    const snap = (v: number) => Math.round(v / 3) * 3;
    const h = 6, x0 = snap(x - w / 2), y0 = snap(y - h / 2);
    this.gBar.fillStyle(0x0a0d24, 0.85 * alpha).fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    this.gBar.fillStyle(color, alpha).fillRect(x0, y0, snap(w * Math.max(0, Math.min(1, frac))), h);
  }

  arc(x: number, y: number, r: number, frac: number, color: number, alpha: number): void {
    this.gTrans.lineStyle(2, color, alpha);
    this.gTrans.beginPath();
    this.gTrans.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    this.gTrans.strokePath();
  }

  // ------------------------------------------------------------- update/render

  update(dt: number): void {
    for (const p of this.pix) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.pix = this.pix.filter((p) => p.life > 0);

    for (const c of this.chunks) {
      c.life -= dt;
      if (!c.stuck) {
        c.vy += 1500 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (this.w.solids.some((s) => s.active && pointInRect(c.x, c.y + 4, s))) {
          if (Math.abs(c.vy) > 300 && Math.random() < 0.5) { c.vy *= -0.3; c.vx *= 0.5; }
          else { c.stuck = true; c.img.setScale(c.img.scaleX * 1.2, c.img.scaleY * 0.6); }
        }
        c.img.rotation += c.rot * dt;
      }
      c.img.setPosition(c.x, c.y).setAlpha(Math.min(1, c.life));
    }
    this.chunks = this.chunks.filter((c) => {
      if (c.life > 0) return true;
      c.img.destroy();
      return false;
    });

    for (const s of this.sparkList) { s.life -= dt; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparkList = this.sparkList.filter((s) => s.life > 0);
    for (const s of this.sparkleList) {
      s.life -= dt;
      s.vx *= Math.pow(0.08, dt);
      s.vy = s.vy * Math.pow(0.08, dt) - 40 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.phase += dt * 22;
    }
    this.sparkleList = this.sparkleList.filter((s) => s.life > 0);

    for (const t of this.texts) {
      t.life -= dt;
      t.t.y += t.vy * dt;
      t.vy *= 0.94;
      t.t.setAlpha(Math.min(1, t.life * 3));
    }
    this.texts = this.texts.filter((t) => {
      if (t.life > 0) return true;
      t.t.destroy();
      return false;
    });

    for (const g of this.ghosts) { g.life -= dt; g.img.setAlpha(Math.max(0, g.life / 0.22) * 0.55); }
    this.ghosts = this.ghosts.filter((g) => {
      if (g.life > 0) return true;
      g.img.destroy();
      return false;
    });

    for (const r of this.rings) { r.life -= dt; r.r += dt * 220; }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter((d) => d.life > 0);
  }

  render(cam: Phaser.Cameras.Scene2D.Camera, dt: number): void {
    const g = this.gPix;
    g.clear();
    for (const p of this.pix) {
      const s = p.size;
      g.fillStyle(p.color, Math.min(1, (p.life / p.max) * 1.5));
      g.fillRect(Math.round(p.x / 3) * 3 - s / 2, Math.round(p.y / 3) * 3 - s / 2, s, s);
    }
    for (const r of this.rings) {
      const a = r.life / 0.35;
      g.lineStyle(3, r.color, a);
      const rr = Math.round(r.r / 3) * 3;
      g.strokeRect(Math.round(r.x / 3) * 3 - rr, Math.round(r.y / 3) * 3 - rr * 0.5, rr * 2, rr);
    }

    const gw = this.gWorld;
    gw.clear();
    for (const s of this.sparkList) {
      gw.lineStyle(3, 0xff9a40, Math.min(0.5, s.life * 2.5));
      gw.lineBetween(s.x, s.y, s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      gw.lineStyle(1, 0xfffbe0, Math.min(1, s.life * 5));
      gw.lineBetween(s.x, s.y, s.x - s.vx * 0.03, s.y - s.vy * 0.03);
    }

    for (const s of this.sparkleList) {
      const k = s.life / s.max;
      const tw = 0.55 + 0.45 * Math.sin(s.phase);
      const arm = Math.max(3, Math.round((s.size * tw * Math.min(1, k * 2)) / 3) * 3);
      const x = Math.round(s.x / 3) * 3, y = Math.round(s.y / 3) * 3;
      gw.fillStyle(s.color, Math.min(1, k * 2));
      gw.fillRect(x - 1.5, y - arm, 3, arm * 2);
      gw.fillRect(x - arm, y - 1.5, arm * 2, 3);
      gw.fillStyle(0xffffff, Math.min(1, k * 2));
      gw.fillRect(x - 3, y - 3, 6, 6);
    }

    // clay imprints of pixel feet: dark squares pressed into the smooth world
    const gd = this.gDecal;
    gd.clear();
    for (const d of this.decals) {
      gd.fillStyle(0x1a1410, Math.min(0.55, d.life * 0.3));
      gd.fillRect(Math.round(d.x / HERO_SCALE) * HERO_SCALE - d.w / 2, d.y - 3, d.w, 4);
    }

    // rain: smooth droplets in the world; they pixelate when they hit PKT
    const gr = this.gRain;
    gr.clear();
    if (!RAIN || this.w.room.bg === 'hall') return;
    gr.lineStyle(2, 0x9fb8e8, 0.28);
    const p = this.w.player;
    const view = cam.worldView;
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x += d.speed * 0.18 * dt;
      let wx = view.x + ((d.x % 1400) + 1400) % 1400 - 60;
      let wy = view.y + ((d.y % 800) + 800) % 800 - 40;
      if (!p.dead && wx > p.x - 4 && wx < p.x + p.w + 4 && wy > p.y - 18 && wy < p.y + 10) {
        this.pix.push({ x: wx, y: p.y - 16, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 60, life: 0.25, max: 0.25, color: 0x9ff6ff, size: 3, g: 700 });
        d.y += 300 + Math.random() * 300;
        continue;
      }
      gr.lineBetween(wx, wy, wx - d.len * 0.18, wy - d.len);
      void wx; void wy;
      wx = 0; wy = 0;
    }
  }
}
