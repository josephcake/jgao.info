import Phaser from 'phaser';
import type { RoomDef } from '../gameplay/RoomData';
import type { GameScene } from '../scenes/GameScene';
import { makeCanvas, rng } from './ClayArt';
import { Perception } from './PerceptionPipeline';

const VIEW_W = 1280;
const VIEW_H = 720;
const SPAN = 2048;
const FONT = '"Press Start 2P", monospace';

/** Which device the level takes place inside; picks the landmark buildings. */
export type Device = 'modem' | 'router';

type Ctx = CanvasRenderingContext2D;
const box = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

interface Light { bx: number; y: number; f: number }
/** A world-space light source the scene feeds to the lighting shader. */
export interface Lamp { x: number; y: number; r: number; color: number; k: number }

/** Depth of field: blur a backdrop by shrinking and re-enlarging it with smoothing. */
function soften(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  if (factor <= 1) return src;
  const [sm, sctx] = makeCanvas(Math.ceil(src.width / factor), Math.ceil(src.height / factor));
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, sm.width, sm.height);
  const [out, octx] = makeCanvas(src.width, src.height);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(sm, 0, 0, src.width, src.height);
  return out;
}

function skyTexture(scene: Phaser.Scene): string {
  const key = 'cp_sky';
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = makeCanvas(VIEW_W, VIEW_H);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#05071a');
  g.addColorStop(0.45, '#121a3c');
  g.addColorStop(0.78, '#36204e');
  g.addColorStop(1, '#7a3058');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // the sky is the inside of the case: vent slats with light leaking through
  box(ctx, 0, 0, VIEW_W, 66, '#03040d');
  for (let row = 0; row < 2; row++) {
    for (let x = (row ? 60 : 12); x < VIEW_W; x += 120) box(ctx, x, 12 + row * 27, 84, 12, '#2a3466');
  }
  box(ctx, 0, 66, VIEW_W, 6, '#151a38');
  // a few stars that are definitely satellites
  const r = rng(77);
  ctx.fillStyle = '#8890c0';
  for (let i = 0; i < 30; i++) ctx.fillRect(Math.floor(r() * VIEW_W / 3) * 3, Math.floor(r() * 300 / 3) * 3, 3, 3);
  scene.textures.addCanvas(key, soften(c, 2));
  return key;
}

/** Lit windows, so a component still reads as a building. */
function windows(ctx: Ctx, r: () => number, x: number, top: number, bw: number, H: number, near: boolean): void {
  const ww = 6, wh = near ? 9 : 6;
  const palette = near ? ['#e0a050', '#5ec8d8', '#2a3050'] : ['#8a7040', '#40788a', '#6a3a60'];
  for (let wy = top + 18; wy < H - 20; wy += wh + 9) {
    for (let wx = x + 12; wx < x + bw - 12; wx += ww + 9) {
      if (r() < (near ? 0.9 : 0.8)) continue;
      ctx.fillStyle = palette[Math.floor(r() * palette.length)];
      ctx.fillRect(wx, wy, ww, wh);
    }
  }
}

/** Generic board parts every device has: capacitors, batteries, pin headers, chips. */
function boardPart(ctx: Ctx, r: () => number, x: number, bw: number, bh: number, H: number, near: boolean): number {
  const body = near ? '#0b0e1e' : '#1a1f3c';
  const hi = near ? '#1a2142' : '#262d52';
  const kind = Math.floor(r() * 4);
  const top = H - bh;
  if (kind === 0) {
    // electrolytic capacitor: rounded shoulders, scored top, polarity stripe
    box(ctx, x, top + 12, bw, bh - 12, body);
    box(ctx, x + 6, top, bw - 12, 12, body);
    box(ctx, x + bw * 0.62, top + 15, bw * 0.16, bh - 15, hi);
    box(ctx, x + 6, top + 30, bw - 12, 6, hi);
    windows(ctx, r, x, top + 36, bw * 0.6, H, near);
  } else if (kind === 1) {
    // battery: a nub on top, a band, a plus sign
    box(ctx, x, top, bw, bh, body);
    box(ctx, x + bw * 0.35, top - 15, bw * 0.3, 15, body);
    box(ctx, x, top + bh * 0.22, bw, 9, hi);
    if (near) { box(ctx, x + bw / 2 - 12, top + 30, 24, 6, '#c8903a'); box(ctx, x + bw / 2 - 3, top + 21, 6, 24, '#c8903a'); }
    windows(ctx, r, x, top + bh * 0.22 + 12, bw, H, near);
  } else if (kind === 2) {
    // pin header: a plastic strip with tall posts
    const posts = Math.max(2, Math.floor(bw / 24));
    box(ctx, x, H - 36, posts * 24, 36, body);
    for (let i = 0; i < posts; i++) {
      box(ctx, x + i * 24 + 6, top, 9, bh - 36, body);
      box(ctx, x + i * 24 + 6, top, 9, 6, near ? '#6a5a30' : '#3a3a48');
    }
    return posts * 24;
  } else {
    // chip: a low slab on a skirt of legs, with a pin-1 dot
    const sh = Math.min(bh, 120 + Math.floor(r() * 90));
    const st = H - sh;
    box(ctx, x, st, bw, sh - 18, body);
    for (let lx = x + 6; lx < x + bw - 6; lx += 15) box(ctx, lx, H - 18, 6, 18, hi);
    box(ctx, x + 12, st + 12, 9, 9, hi);
    windows(ctx, r, x, st + 24, bw, H - 18, near);
  }
  return bw;
}

/** Landmarks unique to the device the level is inside. Returns the width used. */
function landmark(ctx: Ctx, kind: number, x: number, H: number, lights: Light[], f: number): number {
  const body = '#0b0e1e', rim = '#1a2142';
  const yOff = VIEW_H - H;
  switch (kind) {
    case 0: case 5: {
      // antenna: a hinge block and a tall ribbed pole
      const h = kind === 0 ? 470 : 420;
      box(ctx, x, H - 60, 90, 60, body);
      box(ctx, x + 24, H - 75, 42, 15, rim);
      box(ctx, x + 27, H - h, 36, h - 75, body);
      box(ctx, x + 30, H - h - 9, 30, 9, body);
      for (let y = H - h + 30; y < H - 90; y += 45) box(ctx, x + 27, y, 36, 6, rim);
      lights.push({ bx: x + 42, y: yOff + H - h - 18, f });
      return 90;
    }
    case 1: {
      // ethernet jack: a block with the jack opening and two LEDs
      box(ctx, x, H - 230, 250, 230, body);
      box(ctx, x + 60, H - 180, 130, 100, '#05060f');
      box(ctx, x + 105, H - 80, 40, 24, '#05060f');
      box(ctx, x + 60, H - 183, 130, 6, '#1f5a6e');
      for (let i = 0; i < 8; i++) box(ctx, x + 72 + i * 15, H - 174, 6, 24, '#6a5a30');
      box(ctx, x + 18, H - 216, 21, 12, '#5aff9a');
      box(ctx, x + 211, H - 216, 21, 12, '#ffb347');
      return 250;
    }
    case 2: {
      // the WiFi chip: a wide tower with a metal lid and a skirt of pins
      box(ctx, x, H - 300, 360, 282, body);
      for (let lx = x + 9; lx < x + 351; lx += 15) box(ctx, lx, H - 18, 6, 18, rim);
      box(ctx, x + 24, H - 324, 312, 30, '#161b34');
      box(ctx, x + 24, H - 324, 312, 6, '#2a3466');
      ctx.fillStyle = '#3ff0ff';
      ctx.font = `24px ${FONT}`;
      ctx.textBaseline = 'top';
      ctx.fillText('WIFI 2.4/5', x + 60, H - 270);
      windows(ctx, rng(x), x, H - 230, 360, H - 18, true);
      return 360;
    }
    case 3: {
      // status tower: power, internet and WiFi icons stacked up the front
      box(ctx, x, H - 400, 150, 400, body);
      const cx = x + 75;
      ctx.strokeStyle = '#2f9aa8';
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(cx, H - 330, 33, -Math.PI * 0.3, Math.PI * 1.3); ctx.stroke();
      box(ctx, cx - 4, H - 375, 9, 45, '#2f9aa8');
      ctx.strokeStyle = '#3f9a68';
      ctx.beginPath(); ctx.arc(cx, H - 220, 33, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, H - 220, 14, 33, 0, 0, Math.PI * 2); ctx.stroke();
      box(ctx, cx - 33, H - 224, 66, 8, '#3f9a68');
      ctx.strokeStyle = '#2f9aa8';
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, H - 70, i * 18, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke(); }
      box(ctx, cx - 6, H - 76, 12, 12, '#2f9aa8');
      return 150;
    }
    case 6: {
      // router antennas: three flat paddles on hinges along a long chassis
      box(ctx, x, H - 70, 330, 70, body);
      box(ctx, x, H - 70, 330, 6, rim);
      for (let i = 0; i < 3; i++) {
        const ax = x + 45 + i * 105, ah = 380 + (i % 2) * 60;
        box(ctx, ax, H - 88, 36, 18, rim);
        box(ctx, ax + 3, H - ah, 30, ah - 88, body);
        box(ctx, ax + 3, H - ah, 30, 6, rim);
        for (let y = H - ah + 40; y < H - 110; y += 60) box(ctx, ax + 3, y, 30, 3, rim);
        lights.push({ bx: ax + 18, y: yOff + H - ah - 12, f });
      }
      for (let i = 0; i < 6; i++) box(ctx, x + 30 + i * 48, H - 40, 18, 6, i % 3 === 2 ? '#ffb347' : '#5aff9a');
      return 330;
    }
    case 7: {
      // the LAN bank: four jacks and a yellow WAN jack, each with its link light
      box(ctx, x, H - 210, 420, 210, body);
      box(ctx, x, H - 210, 420, 6, rim);
      for (let i = 0; i < 5; i++) {
        const jx = x + 24 + i * 78, wan = i === 0;
        box(ctx, jx, H - 160, 60, 54, '#05060f');
        box(ctx, jx + 18, H - 106, 24, 14, '#05060f');
        box(ctx, jx, H - 163, 60, 5, wan ? '#a8862a' : '#1f5a6e');
        for (let k = 0; k < 8; k++) box(ctx, jx + 6 + k * 6, H - 154, 3, 15, '#6a5a30');
        box(ctx, jx + 21, H - 190, 18, 10, wan ? '#ffb347' : '#5aff9a');
      }
      ctx.fillStyle = '#3ff0ff';
      ctx.font = `15px ${FONT}`;
      ctx.textBaseline = 'top';
      ctx.fillText('WAN   LAN 1   2   3   4', x + 30, H - 75);
      return 420;
    }
    case 8: {
      // heat sink: a tower of fins
      box(ctx, x, H - 330, 180, 330, body);
      for (let y = H - 320; y < H - 20; y += 18) box(ctx, x + 12, y, 156, 8, rim);
      box(ctx, x + 60, H - 350, 60, 20, rim);
      return 180;
    }
    case 9: {
      // status panel: rows of blinking-looking LEDs and the band labels
      box(ctx, x, H - 280, 240, 280, body);
      const cols = ['#5aff9a', '#5aff9a', '#ffb347', '#3ff0ff', '#5aff9a', '#ff3fa4'];
      for (let row = 0; row < 7; row++) for (let i = 0; i < 6; i++) box(ctx, x + 24 + i * 34, H - 250 + row * 30, 18, 9, cols[(row * 3 + i) % cols.length]);
      ctx.fillStyle = '#9ff6ff';
      ctx.font = `15px ${FONT}`;
      ctx.textBaseline = 'top';
      ctx.fillText('2.4  5  6GHZ', x + 21, H - 40);
      return 240;
    }
    default: {
      // coax connector: threaded barrel on a hex nut, centre pin on top
      box(ctx, x, H - 60, 150, 60, body);
      box(ctx, x + 24, H - 340, 102, 280, body);
      for (let y = H - 330; y < H - 70; y += 15) box(ctx, x + 24, y, 102, 4, rim);
      box(ctx, x + 72, H - 385, 6, 45, '#6a5a30');
      return 150;
    }
  }
}

function skylineTexture(scene: Phaser.Scene, key: string, seed: number, near: boolean, lights: Light[], f: number, device: Device = 'modem'): string {
  const H = 520;
  const r = rng(seed);
  const [c, ctx] = makeCanvas(SPAN, H);
  // landmarks sit at fixed slots in the near layer; board parts fill the gaps
  const slots = !near ? [] : device === 'router'
    ? [[40, 6], [470, 7], [960, 8], [1220, 9], [1530, 6]]
    : [[60, 0], [330, 1], [700, 2], [1160, 3], [1440, 4], [1800, 5]];
  let x = 0;
  let si = 0;
  while (x < SPAN - 40) {
    if (si < slots.length && x + 60 >= slots[si][0]) {
      x = slots[si][0] + landmark(ctx, slots[si][1], slots[si][0], H, lights, f) + 30;
      si++;
      continue;
    }
    const room = si < slots.length ? slots[si][0] - x - 20 : SPAN - x;
    let bw = near ? 90 + Math.floor(r() * 90) : 60 + Math.floor(r() * 110);
    if (room < 60) { x += room + 20; continue; }
    bw = Math.min(bw, room);
    const bh = near ? 120 + Math.floor(r() * 160) : 200 + Math.floor(r() * 300);
    x += boardPart(ctx, r, x, bw, bh, H, near) + Math.floor(r() * (near ? 40 : 20)) + 6;
  }
  // circuit traces run along the ground like streets
  for (let i = 0; i < 3; i++) box(ctx, 0, H - 9 - i * 12, SPAN, 3, near ? '#1f3a4e' : '#26305a');
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, soften(c, near ? 2.2 : 4));
  return key;
}

/** Soft backdrop textures (sky, far skyline, near skyline) for scenes outside a room. */
export function backdropTextures(scene: Phaser.Scene, device: Device = 'modem'): { sky: string; far: string; near: string } {
  return { sky: skyTexture(scene), far: skylineTexture(scene, 'cp_far', 11, false, [], 0.12), near: skylineTexture(scene, `cp_near_${device}`, 23, true, [], 0.35, device) };
}

/** A horizontal or vertical data lane at one depth of the backdrop, with the packets running along it. */
interface Lane {
  vertical: boolean;
  /** Position across the lane (y for a horizontal lane, x for a vertical one), in backdrop space. */
  at: number;
  /** Parallax factor: smaller is further away. */
  f: number;
  packets: { t: number; speed: number; len: number }[];
}

/** Backdrop colours by mood: sky top and bottom, lane, packet. */
const MOOD = {
  outdoor: { top: [7, 11, 34], bottom: [14, 24, 58], lane: 0x3a6aff, packet: 0x8ad8ff },
  indoor: { top: [16, 7, 16], bottom: [30, 12, 22], lane: 0xff5a6a, packet: 0xffa08a },
  router: { top: [4, 16, 16], bottom: [8, 34, 32], lane: 0x3affc0, packet: 0xa8ffe4 },
} as const;

/** A plain vertical gradient, cached per mood. */
function cleanSkyTexture(scene: Phaser.Scene, mood: keyof typeof MOOD): string {
  const key = `clean_sky_${mood}`;
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = makeCanvas(VIEW_W, VIEW_H);
  const { top, bottom } = MOOD[mood];
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, `rgb(${top.join(',')})`);
  g.addColorStop(1, `rgb(${bottom.join(',')})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  scene.textures.addCanvas(key, c);
  return key;
}

/**
 * The backdrop of a room: a calm gradient with a few faint data lanes at different
 * depths, small packets travelling along them. Mostly empty space on purpose.
 */
export class CityDressing {
  /** World lights the dressing adds to the scene. None: rooms are lit by their ports and by Pix. */
  readonly lamps: Lamp[] = [];
  private readonly lanes: Lane[] = [];
  private readonly mood: (typeof MOOD)[keyof typeof MOOD];
  private g: Phaser.GameObjects.Graphics;
  private readonly indoor: boolean;

  constructor(private w: GameScene, room: RoomDef, device: Device = 'modem') {
    this.indoor = room.bg === 'hall';
    Perception.flash = 0;
    // the modem glows warm red indoors and blue outside; the router runs cooler, teal and green
    const router = device === 'router';
    Perception.ambient = this.indoor ? (router ? [0.26, 0.4, 0.38] : [0.42, 0.26, 0.3]) : router ? [0.3, 0.44, 0.6] : [0.36, 0.42, 0.7];
    Perception.haze = this.indoor ? (router ? [0.03, 0.12, 0.1] : [0.16, 0.04, 0.06]) : router ? [0.03, 0.1, 0.15] : [0.05, 0.08, 0.19];
    const r = rng(room.id.length * 31 + room.width * 7 + room.height);
    const moodKey = router ? 'router' : this.indoor ? 'indoor' : 'outdoor';
    this.mood = MOOD[moodKey];
    w.addBg(w.add.image(0, 0, cleanSkyTexture(w, moodKey)).setOrigin(0).setScrollFactor(0).setDepth(-100));

    // three depths of lanes; a couple across and one or two up and down at each
    for (const f of [0.06, 0.12, 0.2]) {
      const across = 2 + (r() < 0.5 ? 1 : 0), down = 1 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < across + down; i++) {
        const vertical = i >= across;
        const n = 1 + (r() < 0.45 ? 1 : 0);
        const speed = (40 + r() * 50) * (0.6 + f * 3) * (r() < 0.5 ? 1 : -1);
        this.lanes.push({
          vertical,
          at: vertical ? r() * SPAN : 60 + ((i + r() * 0.6) / across) * (VIEW_H - 120),
          f,
          packets: Array.from({ length: n }, () => ({ t: r() * SPAN, speed, len: 10 + r() * 14 })),
        });
      }
    }
    this.g = w.addBg(w.add.graphics().setScrollFactor(0).setDepth(-95));
  }

  update(dt: number, sx: number, sy: number, _roomH: number): void {
    const g = this.g, { lane, packet } = this.mood;
    g.clear();
    const H = VIEW_H + 160;
    const wrap = (v: number, m: number) => ((v % m) + m) % m;
    for (const l of this.lanes) {
      const near = (l.f - 0.06) / 0.14;
      const la = 0.035 + near * 0.035;
      // the lane: a hairline, with a dot every so often like a junction
      let lx = 0, ly = 0;
      if (l.vertical) {
        lx = Math.round(wrap(l.at - sx * l.f, SPAN));
        if (lx > VIEW_W + 40) continue;
        g.fillStyle(lane, la).fillRect(lx, 0, 2, VIEW_H);
      } else {
        ly = Math.round(wrap(l.at - sy * l.f, H) - 80);
        g.fillStyle(lane, la).fillRect(0, ly, VIEW_W, 2);
        const off = wrap(-sx * l.f, 160);
        for (let x = off; x < VIEW_W; x += 160) g.fillStyle(lane, la * 2).fillRect(Math.round(x) - 2, ly - 1, 4, 4);
      }
      // the packets: a soft glow, a bright core and a short fading tail
      for (const p of l.packets) {
        p.t = wrap(p.t + p.speed * dt, SPAN);
        const dir = Math.sign(p.speed);
        const len = p.len * (0.7 + near * 0.6), th = 3 + Math.round(near * 2), a = 0.35 + near * 0.35;
        let px: number, py: number;
        if (l.vertical) { px = lx; py = wrap(p.t - sy * l.f, H) - 80; }
        else { px = wrap(p.t - sx * l.f, SPAN); py = ly; if (px > VIEW_W + 40) continue; }
        const along = (k: number) => (l.vertical ? { x: px, y: py - dir * k } : { x: px - dir * k, y: py });
        for (let k = 1; k <= 3; k++) {
          const c = along(len * 0.6 * k);
          g.fillStyle(packet, a * (0.3 - k * 0.08));
          if (l.vertical) g.fillRect(c.x - 0.5, c.y - len * 0.3, th - 1, len * 0.6);
          else g.fillRect(c.x - len * 0.3, c.y - 0.5, len * 0.6, th - 1);
        }
        g.fillStyle(packet, a * 0.25);
        if (l.vertical) g.fillRect(px - 3, py - len / 2 - 3, th + 6, len + 6);
        else g.fillRect(px - len / 2 - 3, py - 3, len + 6, th + 6);
        g.fillStyle(packet, a);
        if (l.vertical) g.fillRect(px, py - len / 2, th, len);
        else g.fillRect(px - len / 2, py, len, th);
      }
    }
  }
}

