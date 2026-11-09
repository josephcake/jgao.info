import Phaser from 'phaser';
import { makeCanvas } from './ClayArt';

/** PKT: one RGB pixel, 16x20 frames. Red, green and blue sub-pixel stripes; no limbs, no face. */
export const HERO_W = 16;
export const HERO_H = 20;
export const HERO_SCALE = 3;

const O = '#0a0d24';
/** A stripe whose colour Pix hasn't recovered: dark glass. */
const HOLLOW = ['#121428', '#1e2240', '#2c3058'];
/** Per sub-pixel: dim, base, bright. */
const SUB = [
  ['#8a1a34', '#ff3a5a', '#ff9aaa'],
  ['#14803c', '#3aff7a', '#b8ffcc'],
  ['#1a2c9a', '#3a7aff', '#b0ccff'],
];

interface Pose {
  /** Body size in pixels. */
  w: number;
  h: number;
  /** Lift off the ground (hops), in pixels. */
  lift?: number;
  /** How far the top row leans forward. */
  lean?: number;
  /** Bright scanline row inside the body (from the top), -1 for none. */
  scan?: number;
  /** Per-stripe brightness: 0 dim, 1 normal, 2 lit. */
  glow?: [number, number, number];
  /** Colour-fringe ghosts behind the body. */
  trail?: number;
  /** Squish the leading side flat against a wall. */
  flat?: boolean;
  /** Torn rows and swapped stripes. */
  glitch?: boolean;
  /** Horizontal offset in the frame. */
  dx?: number;
}

export const FRAMES = {
  idle: [0, 1, 2, 3],
  run: [4, 5, 6, 7, 8, 9],
  jump: [10],
  fall: [11],
  dash: [12],
  wall: [13],
  swing: [14],
  hurt: [15],
};

const POSES: Pose[] = [
  // idle: a slow breath and a scanline drifting down the screen
  { w: 12, h: 12, scan: 1 },
  { w: 12, h: 12, scan: 4 },
  { w: 13, h: 11, scan: 7 },
  { w: 12, h: 12, scan: 9 },
  // run: hop, hop, hop
  { w: 14, h: 10, lean: 1, trail: 1 },
  { w: 11, h: 13, lift: 2, lean: 1, trail: 1 },
  { w: 11, h: 13, lift: 4, lean: 1, trail: 2, scan: 3 },
  { w: 12, h: 12, lift: 3, lean: 1, trail: 2 },
  { w: 12, h: 12, lift: 1, lean: 1, trail: 1 },
  { w: 14, h: 10, lean: 0, trail: 1 },
  // jump: stretched tall, all stripes lit
  { w: 10, h: 15, lift: 1, glow: [2, 2, 2] },
  // fall: wide and a bit worried
  { w: 13, h: 11, glow: [1, 1, 1], scan: 2 },
  // dash: a smear with colour fringing
  { w: 15, h: 9, lean: 2, trail: 3, glow: [2, 1, 2], dx: 1 },
  // wall: squished flat
  { w: 10, h: 13, flat: true, scan: 6 },
  // swing: tucked small
  { w: 11, h: 11, lift: 2, glow: [1, 2, 1] },
  // hurt: glitched
  { w: 13, h: 11, glitch: true },
];

/** Texels of each stripe (0 red, 1 green, 2 blue) per frame, as [x, y], for effects that stay inside a stripe. */
export const STRIPE_TEXELS: [number, number][][][] = [[], [], []];

/** `only` draws just one stripe (0 red, 1 green, 2 blue) in its pure base colour, for glow overlays. */
function drawPose(ctx: CanvasRenderingContext2D, ox: number, p: Pose, lit: boolean[], only = -1, texels?: [number, number][]): void {
  const px = (x: number, y: number, c: string) => {
    if (only >= 0) return;
    if (x < 0 || x >= HERO_W || y < 0 || y >= HERO_H) return;
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, y, 1, 1);
  };
  const bottom = HERO_H - 1 - (p.lift ?? 0);
  const top = bottom - p.h + 1;
  const left = Math.round(HERO_W / 2 - p.w / 2) + (p.dx ?? 0);
  const lean = p.lean ?? 0;
  const shiftAt = (y: number) => Math.round(lean * (1 - (y - top) / Math.max(1, p.h - 1)));
  // the glitch tears a couple of rows sideways
  const tear = (y: number) => (p.glitch ? [0, 0, 2, 0, -1, 0, 0, 1, 0, -2, 0, 0, 0, 0, 0][y - top] ?? 0 : 0);
  const order = p.glitch ? [2, 0, 1] : [0, 1, 2];
  const glow = p.glow ?? [1, 1, 1];

  // interior split into three stripes with 1px dark gaps
  const iw = p.w - 2;
  const sw = Math.floor((iw - 2) / 3);
  const extra = iw - 2 - sw * 3;
  const widths = [sw + (extra > 1 ? 1 : 0), sw + (extra > 0 ? 1 : 0), sw];

  // colour-fringe ghosts: red, green and blue copies smeared behind
  for (let i = (p.trail ?? 0); i >= 1; i--) {
    const gx = left - i * 2;
    const c = (lit[(i - 1) % 3] ? SUB : [HOLLOW, HOLLOW, HOLLOW])[(i - 1) % 3][1];
    for (let y = top + 2; y <= bottom - 1; y += 2) px(gx + shiftAt(y), y, c);
  }

  for (let y = top; y <= bottom; y++) {
    const row = y - top;
    const sx = left + shiftAt(y) + tear(y);
    for (let i = 0; i < p.w; i++) {
      const x = sx + i;
      const corner = (i === 0 || i === p.w - 1) && (row === 0 || row === p.h - 1);
      if (corner) continue;
      const edge = i === 0 || i === p.w - 1 || row === 0 || row === p.h - 1;
      if (p.flat && i === p.w - 1) { px(x, y, O); continue; }
      if (edge) { px(x, y, O); continue; }
      // which stripe is this column in?
      let c = i - 1;
      let s = -1;
      for (let k = 0; k < 3; k++) {
        if (c < widths[k]) { s = k; break; }
        c -= widths[k];
        if (c === 0 && k < 2) { s = -2; break; }
        c -= 1;
      }
      if (s === -2 || s < 0) { px(x, y, O); continue; }
      if (only >= 0) {
        if (order[s] === only && x >= 0 && x < HERO_W && y >= 0 && y < HERO_H) { ctx.fillStyle = SUB[only][1]; ctx.fillRect(ox + x, y, 1, 1); texels?.push([x, y]); }
        continue;
      }
      const sub = lit[order[s]] ? SUB[order[s]] : HOLLOW;
      let lvl = glow[s];
      if (row === 1) lvl = Math.min(2, lvl + 1);
      if (row === p.h - 2) lvl = Math.max(0, lvl - 1);
      if (p.scan !== undefined && p.scan >= 0 && row === p.scan + 1) lvl = 2;
      if (p.glitch && (row === 3 || row === 7)) { px(x, y, '#ffffff'); continue; }
      px(x, y, row === 1 && i === 1 && !p.glitch && lit.some(Boolean) ? '#ffffff' : sub[lvl]);
    }
  }
}

/**
 * Build the 'pkt' texture with numbered frames. Nearest-neighbour filtered.
 * `lit` is [red, green, blue]: stripes Pix has its colour back for. The rest are hollow.
 */
export function makeHeroTexture(scene: Phaser.Scene, lit: boolean[] = [true, true, true]): void {
  const [c, ctx] = makeCanvas(HERO_W * POSES.length, HERO_H);
  POSES.forEach((p, i) => drawPose(ctx, i * HERO_W, p, lit));
  // one stripe at a time, frame-for-frame with 'pkt', for the in-a-zone glow
  ['pkt_glow_red', 'pkt_glow_green', 'pkt_glow_blue'].forEach((key, k) => {
    const [gc, gctx] = makeCanvas(HERO_W * POSES.length, HERO_H);
    STRIPE_TEXELS[k] = POSES.map(() => []);
    POSES.forEach((p, i) => drawPose(gctx, i * HERO_W, p, lit, k, STRIPE_TEXELS[k][i]));
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const gt = scene.textures.addCanvas(key, gc)!;
    POSES.forEach((_, i) => gt.add(i, 0, i * HERO_W, 0, HERO_W, HERO_H));
    gt.setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
  if (scene.textures.exists('pkt')) scene.textures.remove('pkt');
  const tex = scene.textures.addCanvas('pkt', c)!;
  POSES.forEach((_, i) => tex.add(i, 0, i * HERO_W, 0, HERO_W, HERO_H));
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);

  // one-pixel white texture for pixel particles and HUD blocks
  const [pc, pctx] = makeCanvas(1, 1);
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 1, 1);
  if (!scene.textures.exists('px')) scene.textures.addCanvas('px', pc)!.setFilter(Phaser.Textures.FilterMode.NEAREST);

  // pixel RJ45 plug for the cable tip at PKT's end of the world
  const PLUG: Record<string, string> = { O, L: '#dcffff', Y: '#ffd23f' };
  const [rc, rctx] = makeCanvas(7, 5);
  const plug = ['OOOOOO.', 'OLLLLOO', 'OLYYLOO', 'OLLLLOO', 'OOOOOO.'];
  plug.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.') { rctx.fillStyle = PLUG[k]; rctx.fillRect(x, y, 1, 1); } }));
  if (!scene.textures.exists('rj45')) scene.textures.addCanvas('rj45', rc)!.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
