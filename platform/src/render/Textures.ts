import Phaser from 'phaser';
import { bakeClay, css, lowPoly, lowPolyPoly, makeCanvas, PAL, rng, type RGB } from './ClayArt';
import { currentTiles, type RoomDef } from '../gameplay/RoomData';

const add = (scene: Phaser.Scene, key: string, c: HTMLCanvasElement) => {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
};

export const PORT_COLORS: Record<string, RGB> = {
  anchor: [0.15, 0.45, 1.0],
  pull: [1.0, 0.78, 0.08],
  source: [0.15, 1.0, 0.35],
  consumer: [0.1, 0.85, 0.4],
  capacitor: [0.05, 0.95, 0.75],
  data: [1.0, 0.12, 0.85],
  yank: [1.0, 0.5, 0.1],
  // platform yank port: anchor + charge/power hybrid; halo/reticle use a blue-teal blend
  yank_platform: [0.1, 0.7, 0.85],
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, a = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(c, 1.2, a));
  g.addColorStop(0.35, css(c, 1, a * 0.8));
  g.addColorStop(1, css(c, 1, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Generate all fixed textures once at boot. */
export function makeStaticTextures(scene: Phaser.Scene): void {
  // ports: clay housing + RJ45 socket glowing in its protocol colour
  for (const [kind, col] of Object.entries(PORT_COLORS)) {
    const s = 56;
    const housing = bakeClay(s, s, (ctx) => roundRect(ctx, 6, 6, s - 12, s - 12, 12), {
      base: PAL.metal, base2: PAL.clay, round: 3, bevel: 6, fingerprint: 0.6, seed: kind.length * 7,
    });
    const [c, ctx] = makeCanvas(s, s);
    glowDot(ctx, s / 2, s / 2, s / 2, col, 0.55);
    ctx.drawImage(housing, 0, 0);
    ctx.fillStyle = 'rgba(10,8,14,1)';
    roundRect(ctx, s / 2 - 11, s / 2 - 9, 22, 18, 3);
    ctx.fill();
    ctx.strokeStyle = css(col, 1.1);
    ctx.lineWidth = 3;
    roundRect(ctx, s / 2 - 11, s / 2 - 9, 22, 18, 3);
    ctx.stroke();
    ctx.fillStyle = css(col, 1);
    if (kind === 'anchor') { ctx.beginPath(); ctx.arc(s / 2, s / 2, 5, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === 'pull') { ctx.beginPath(); ctx.moveTo(s / 2 - 6, s / 2 + 4); ctx.lineTo(s / 2, s / 2 - 5); ctx.lineTo(s / 2 + 6, s / 2 + 4); ctx.fill(); }
    else if (kind === 'yank') { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s / 2, s / 2 + 2, 5, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(s / 2 - 1.5, s / 2 - 8, 3, 6); }
    else if (kind === 'source') { ctx.fillRect(s / 2 - 2, s / 2 - 6, 4, 12); ctx.fillRect(s / 2 - 6, s / 2 - 2, 12, 4); }
    else if (kind === 'consumer') { ctx.fillRect(s / 2 - 6, s / 2 - 2, 12, 4); }
    else if (kind === 'capacitor') { ctx.fillRect(s / 2 - 7, s / 2 - 4, 4, 8); ctx.fillRect(s / 2 + 3, s / 2 - 6, 4, 12); }
    else { for (let i = 0; i < 4; i++) ctx.fillRect(s / 2 - 8 + i * 4.5, s / 2 - 3, 2.5, 7); }
    add(scene, `port_${kind}`, c);
  }

  // yank-platform port: anchor + charge/power combined. A split housing glowing blue
  // (anchor) on the left and teal (power) on the right, with a ring-and-bolt glyph.
  {
    const s = 56;
    const blue = PORT_COLORS.anchor, teal = PORT_COLORS.capacitor;
    const housing = bakeClay(s, s, (ctx) => roundRect(ctx, 6, 6, s - 12, s - 12, 12), {
      base: PAL.metal, base2: PAL.clay, round: 3, bevel: 6, fingerprint: 0.6, seed: 97,
    });
    const [c, ctx] = makeCanvas(s, s);
    // two-tone outer glow: blue left, teal right
    glowDot(ctx, s / 2 - 9, s / 2, s / 2, blue, 0.5);
    glowDot(ctx, s / 2 + 9, s / 2, s / 2, teal, 0.5);
    ctx.drawImage(housing, 0, 0);
    // socket, split fill
    ctx.fillStyle = 'rgba(10,8,14,1)';
    roundRect(ctx, s / 2 - 11, s / 2 - 9, 22, 18, 3);
    ctx.fill();
    ctx.save();
    roundRect(ctx, s / 2 - 11, s / 2 - 9, 22, 18, 3);
    ctx.clip();
    ctx.fillStyle = css(blue, 1, 0.9); ctx.fillRect(s / 2 - 11, s / 2 - 9, 11, 18);
    ctx.fillStyle = css(teal, 1, 0.9); ctx.fillRect(s / 2, s / 2 - 9, 11, 18);
    ctx.restore();
    ctx.strokeStyle = css(blue, 1.1); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s / 2 - 11, s / 2 - 9); ctx.lineTo(s / 2 - 11, s / 2 + 9); ctx.lineTo(s / 2, s / 2 + 9); ctx.stroke();
    ctx.strokeStyle = css(teal, 1.1);
    ctx.beginPath(); ctx.moveTo(s / 2 + 11, s / 2 - 9); ctx.lineTo(s / 2 + 11, s / 2 + 9); ctx.lineTo(s / 2, s / 2 + 9); ctx.stroke();
    // glyph: anchor ring (left) + power bolt (right)
    ctx.strokeStyle = 'rgba(235,245,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s / 2 - 5, s / 2, 3.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(210,255,235,0.95)';
    ctx.beginPath();
    ctx.moveTo(s / 2 + 6, s / 2 - 6); ctx.lineTo(s / 2 + 2, s / 2 + 1); ctx.lineTo(s / 2 + 5, s / 2 + 1); ctx.lineTo(s / 2 + 3, s / 2 + 6);
    ctx.lineTo(s / 2 + 8, s / 2 - 2); ctx.lineTo(s / 2 + 5, s / 2 - 2); ctx.closePath(); ctx.fill();
    add(scene, 'port_yank_platform', c);
  }

  // terminal: a small FLOATING holo-sign. No post, no housing — just a hovering
  // glowing screen with a soft outline and a few scanlines, drawn centred.
  {
    const w = 44, h = 36;
    const [c, ctx] = makeCanvas(w, h);
    // soft outer glow
    glowDot(ctx, w / 2, h / 2, w / 2, [0.19, 1.0, 0.5], 0.5);
    // the floating panel
    const g = ctx.createLinearGradient(0, 6, 0, h - 6);
    g.addColorStop(0, 'rgba(40,230,110,0.92)');
    g.addColorStop(1, 'rgba(10,140,60,0.92)');
    ctx.fillStyle = g;
    roundRect(ctx, 6, 6, w - 12, h - 12, 6);
    ctx.fill();
    // bright edge
    ctx.strokeStyle = 'rgba(200,255,210,0.9)';
    ctx.lineWidth = 2;
    roundRect(ctx, 6, 6, w - 12, h - 12, 6);
    ctx.stroke();
    // text scanlines
    ctx.fillStyle = 'rgba(210,255,220,0.85)';
    for (let i = 0; i < 3; i++) ctx.fillRect(11, 12 + i * 6, 10 + ((i * 13) % 16), 3);
    add(scene, 'terminal', c);
  }

  // exit beacon
  {
    const w = 90, h = 220;
    const [c, ctx] = makeCanvas(w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(40,230,255,0)');
    g.addColorStop(0.5, 'rgba(120,250,255,0.85)');
    g.addColorStop(1, 'rgba(40,230,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(w / 2 - 2, 0, 4, h);
    add(scene, 'exit', c);
  }

  // clay chunk for particles (tinted at runtime)
  {
    const ball = bakeClay(18, 18, (x) => { x.beginPath(); x.ellipse(9, 9, 7, 5.5, 0.5, 0, Math.PI * 2); x.fill(); }, { base: [0.85, 0.85, 0.85], round: 1, bevel: 3, fingerprint: 0, seed: 4 });
    add(scene, 'chunk', ball);
  }

  // shockwave
  {
    const [c, ctx] = makeCanvas(60, 40);
    const ball = bakeClay(60, 40, (x) => { x.beginPath(); x.ellipse(30, 30, 26, 12, 0, Math.PI, 0); x.fill(); x.fillRect(4, 28, 52, 10); }, { base: [0.6, 0.35, 0.25], round: 3, bevel: 5, fingerprint: 0, seed: 12 });
    glowDot(ctx, 30, 30, 30, [1, 0.4, 0.1], 0.5);
    ctx.drawImage(ball, 0, 0);
    add(scene, 'shock', c);
  }

  // foreground low-poly silhouette strip
  {
    const w = 2048, h = 380;
    const [c, ctx] = makeCanvas(w, h);
    const r = rng(55);
    let x = 0;
    while (x < w) {
      const bw = 60 + r() * 140;
      const bh = 120 + r() * 240;
      lowPoly(ctx, x, h - bh, bw, bh, [0.2, 0.19, 0.18], Math.floor(r() * 9999), 26, 0.5);
      for (let i = 0; i < 6; i++) {
        if (r() < 0.5) continue;
        ctx.fillStyle = 'rgba(150,140,110,0.8)';
        ctx.fillRect(x + 10 + r() * (bw - 24), h - bh + 16 + r() * (bh - 40), 6, 8);
      }
      x += bw + r() * 20;
    }
    add(scene, 'silhouette', c);
  }
}

/** Terrain texel size in world px. Terrain is baked at 1/S resolution and shown at S x. */
export const TERRAIN_TEXEL = 3;

function th(x: number, y: number, k = 0): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

type C3 = [number, number, number];
const mixc = (a: C3, b: C3, t: number): C3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (h: string): C3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Bake a room's static terrain as pixel art: circuit board with traces and chips, lit edges and occlusion. */
export function bakeTerrain(scene: Phaser.Scene, room: RoomDef, tile: number): string {
  const key = `terrain_${room.id}`;
  if (scene.textures.exists(key)) return key;
  const S = TERRAIN_TEXEL;
  const W = Math.ceil((room.width * tile) / S);
  const H = Math.ceil((room.height * tile) / S);
  const q = (v: number) => Math.round((v * tile) / S);
  const mask = new Uint8Array(W * H);
  for (const [x, y, w, h] of room.solids) {
    for (let yy = q(y); yy < q(y + h); yy++) for (let xx = q(x); xx < q(x + w); xx++) if (xx >= 0 && xx < W && yy >= 0 && yy < H) mask[yy * W + xx] = 1;
  }
  const solid = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? 1 : mask[y * W + x]);

  // distance (in texels, capped) to the nearest open texel above / below / sideways
  const CAP = 40;
  const dTop = new Uint8Array(W * H);
  const dBot = new Uint8Array(W * H);
  const dSide = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let d = CAP;
    for (let y = 0; y < H; y++) { d = mask[y * W + x] ? (y === 0 ? CAP : Math.min(CAP, d + 1)) : -1; if (d >= 0) dTop[y * W + x] = d; }
    d = CAP;
    for (let y = H - 1; y >= 0; y--) { d = mask[y * W + x] ? (y === H - 1 ? CAP : Math.min(CAP, d + 1)) : -1; if (d >= 0) dBot[y * W + x] = d; }
  }
  for (let y = 0; y < H; y++) {
    const row = new Uint8Array(W).fill(CAP);
    let d = CAP;
    for (let x = 0; x < W; x++) { d = mask[y * W + x] ? (x === 0 ? CAP : Math.min(CAP, d + 1)) : -1; row[x] = d < 0 ? 0 : d; }
    d = CAP;
    for (let x = W - 1; x >= 0; x--) { d = mask[y * W + x] ? (x === W - 1 ? CAP : Math.min(CAP, d + 1)) : -1; if (d >= 0) row[x] = Math.min(row[x], d); }
    dSide.set(row, y * W);
  }

  const indoor = room.bg === 'hall';
  // a circuit board: solder mask (blue outside, dark red indoors, so the yellow current still
  // reads), traces under it, copper vias and pads, gold edge connectors on walkable tops
  const P = indoor
    ? { a: hex('#2c1624'), b: hex('#331a2a'), trace: hex('#4c2638'), pad: hex('#d09a48'), seam: hex('#1a0c14'), edge: hex('#f0b0a0'), cap: hex('#6a3a4c'), deep: hex('#0e060c'), gold: hex('#e0b050'), goldDark: hex('#6a4a1c') }
    : { a: hex('#18224a'), b: hex('#1c2856'), trace: hex('#2e3e7c'), pad: hex('#d09a48'), seam: hex('#0e1430'), edge: hex('#b8e4ff'), cap: hex('#4a5c98'), deep: hex('#080b1c'), gold: hex('#e0b050'), goldDark: hex('#6a4a1c') };

  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      let col = mixc(P.a, P.b, th(Math.floor(x / 24), Math.floor(y / 16), 3) * 0.6);
      // per-texel dither noise
      const n = (th(x, y, 1) - 0.5) * 0.06;
      col = mixc(col, n > 0 ? P.cap : P.seam, Math.abs(n));
      // traces on a routing grid, with a via where some of them meet
      const gx = x % 8, gy = y % 8, cx = Math.floor(x / 8), cy = Math.floor(y / 8);
      const hT = gy === 4 && th(cx, cy, 11) < 0.38;
      const vT = gx === 4 && th(cx, cy, 12) < 0.32;
      if (hT || vT) col = P.trace;
      if ((hT || vT) && Math.abs(gx - 4) <= 1 && Math.abs(gy - 4) <= 1 && th(cx, cy, 13) < 0.3) col = gx === 4 && gy === 4 ? P.seam : P.pad;
      // ambient occlusion deep inside big masses
      const dt = dTop[i];
      const inner = Math.min(dt, dBot[i], dSide[i] * 1.5);
      col = mixc(col, P.deep, Math.min(1, Math.max(0, (inner - 6) / 26)) * 0.75);
      // walkable tops: a lit edge over a row of gold contact fingers
      if (dt === 0) col = P.edge;
      else if (dt <= 2) col = x % 4 < 3 ? (dt === 1 ? P.gold : P.goldDark) : P.seam;
      else if (dt === 3) col = P.seam;
      // undersides and exposed sides
      if (dBot[i] === 0) col = P.deep;
      else if (dSide[i] === 0 && dt > 0) col = mixc(col, P.cap, 0.5);
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const R = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

  // components: CPUs, GPUs, RAM, sensors, coin cells, pin headers, capacitors and resistors,
  // set into the board near its visible surfaces
  const taken = new Uint8Array(W * H);
  const fits = (x0: number, y0: number, w: number, h: number) => {
    let near = false;
    for (let y = y0 - 2; y < y0 + h + 2; y++) for (let x = x0 - 2; x < x0 + w + 2; x++) {
      if (!solid(x, y) || x < 0 || y < 0 || x >= W || y >= H || taken[y * W + x]) return false;
      const k = y * W + x;
      if (dTop[k] < 5 || dBot[k] < 2 || dSide[k] < 2) return false;
      if (Math.min(dTop[k], dBot[k], dSide[k]) < 14) near = true;
    }
    return near;
  };
  const KINDS = [
    { w: 12, h: 12, kind: 'cpu' }, { w: 18, h: 10, kind: 'gpu' }, { w: 14, h: 5, kind: 'ram' }, { w: 6, h: 6, kind: 'sensor' },
    { w: 10, h: 10, kind: 'battery' }, { w: 13, h: 3, kind: 'header' }, { w: 13, h: 6, kind: 'header2' },
    { w: 6, h: 8, kind: 'cap' }, { w: 9, h: 3, kind: 'resistor' },
  ] as const;
  /** Chip-style packages get pins; the other parts draw their own legs. */
  const CHIPS = new Set(['cpu', 'gpu', 'ram', 'sensor']);
  for (let y0 = 4; y0 < H - 8; y0 += 9) {
    for (let x0 = 4; x0 < W - 8; x0 += 11) {
      const pick = th(x0, y0, 21);
      if (pick > 0.55) continue;
      const k = KINDS[Math.floor(th(x0, y0, 22) * KINDS.length)];
      const ox = x0 + Math.floor(th(x0, y0, 23) * 4), oy = y0 + Math.floor(th(x0, y0, 24) * 3);
      if (!fits(ox, oy, k.w, k.h)) continue;
      for (let y = oy - 2; y < oy + k.h + 2; y++) for (let x = ox - 2; x < ox + k.w + 2; x++) taken[y * W + x] = 1;
      const pin = indoor ? '#c8a050' : '#a8b4c8';
      if (!CHIPS.has(k.kind)) {
        if (k.kind === 'battery') {
          // a coin cell: a silver disc with a highlight and an engraved +
          for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) {
            const dx = x - (k.w - 1) / 2, dy = y - (k.h - 1) / 2, r = Math.hypot(dx, dy);
            if (r > k.w / 2) continue;
            R(ox + x, oy + y, 1, 1, r > k.w / 2 - 1 ? '#4a505e' : dx + dy < -3 ? '#e8ecf4' : '#a8b0c0');
          }
          R(ox + 4, oy + 3, 2, 4, '#6a7080'); R(ox + 3, oy + 4, 4, 2, '#6a7080');
          R(ox + k.w - 1, oy + 4, 2, 2, pin);
        } else if (k.kind === 'header' || k.kind === 'header2') {
          // a pin header: black plastic, one or two rows of square gold-tipped pins
          R(ox, oy, k.w, k.h, '#0a0b10');
          for (let row = 0; row < (k.kind === 'header2' ? 2 : 1); row++) {
            for (let x = ox + 1; x < ox + k.w - 1; x += 3) {
              const y = oy + 1 + row * 3;
              R(x, y, 1, 1, '#e0b050'); R(x + 1, y, 1, 1, '#8a6a2a');
            }
          }
        } else if (k.kind === 'cap') {
          // an electrolytic can: a cylinder with a polarity stripe and a scored top
          R(ox + 1, oy, k.w - 2, k.h, indoor ? '#24203a' : '#1a2a5a');
          R(ox, oy + 1, k.w, k.h - 2, indoor ? '#24203a' : '#1a2a5a');
          R(ox + 1, oy + 1, 1, k.h - 2, '#c8ccd8');
          R(ox + 2, oy + 2, k.w - 3, k.h - 4, indoor ? '#3a3456' : '#2a3e7a');
          R(ox + 3, oy + 3, 1, 2, '#a8b0c0'); R(ox + 2, oy + 4, 3, 1, '#a8b0c0');
          R(ox + 2, oy + k.h, 1, 1, pin); R(ox + k.w - 3, oy + k.h, 1, 1, pin);
        } else {
          // a resistor: leads either side of a tan body with colour bands
          R(ox, oy + 1, k.w, 1, pin);
          R(ox + 2, oy, k.w - 4, k.h, '#c8a878');
          R(ox + 3, oy, 1, k.h, '#8a3a2a'); R(ox + 4, oy, 1, k.h, '#202020'); R(ox + 6, oy, 1, k.h, '#d0a040');
        }
        continue;
      }
      // pins along the long sides (all four sides for a CPU)
      for (let x = ox + 1; x < ox + k.w - 1; x += 2) { R(x, oy - 1, 1, 1, pin); R(x, oy + k.h, 1, 1, pin); }
      if (k.kind === 'cpu' || k.kind === 'sensor') for (let y = oy + 1; y < oy + k.h - 1; y += 2) { R(ox - 1, y, 1, 1, pin); R(ox + k.w, y, 1, 1, pin); }
      // the package
      R(ox, oy, k.w, k.h, '#07080e');
      R(ox, oy, k.w, 1, '#262a38');
      if (k.kind === 'cpu') {
        R(ox + 2, oy + 2, k.w - 4, k.h - 4, '#565c6c');
        R(ox + 2, oy + 2, k.w - 4, 1, '#8a90a0');
        R(ox + 3, oy + 3, 2, 1, '#e0b050');
        R(ox + 4, oy + 6, k.w - 8, 1, '#3a3e4c');
      } else if (k.kind === 'gpu') {
        R(ox + 2, oy + 2, 6, 6, '#20232e');
        R(ox + 4, oy + 3, 2, 4, '#3a3e4c'); R(ox + 3, oy + 4, 4, 2, '#3a3e4c');
        for (let x = ox + 10; x < ox + k.w - 2; x += 2) R(x, oy + 3, 1, 4, '#262a38');
        R(ox + k.w - 3, oy + 2, 1, 1, indoor ? '#ff5a6a' : '#3ff0ff');
      } else if (k.kind === 'ram') {
        for (let x = ox + 1; x < ox + k.w - 1; x += 4) R(x, oy + 1, 3, k.h - 2, '#1a1d28');
      } else {
        R(ox + 1, oy + 1, k.w - 2, k.h - 2, '#102a3a');
        R(ox + 2, oy + 2, 2, 2, '#3ff0ff');
      }
      R(ox + 1, oy + k.h - 2, 1, 1, '#c8ccd8');
    }
  }
  // one-way platforms: thin daughter boards on brass standoffs, gold contacts on top
  for (const [x, y, w] of room.oneway) {
    const x0 = q(x), x1 = q(x + w), y0 = q(y);
    R(x0, y0, x1 - x0, 1, indoor ? '#f0b0a0' : '#b8e4ff');
    R(x0, y0 + 1, x1 - x0, 3, indoor ? '#3a1e2e' : '#22306a');
    for (let xx = x0 + 1; xx < x1 - 1; xx += 4) R(xx, y0 + 1, 2, 1, '#e0b050');
    R(x0 + 1, y0 + 2, x1 - x0 - 2, 1, indoor ? '#5a2e40' : '#34468c');
    R(x0, y0 + 4, x1 - x0, 1, '#0c0e1c');
    for (let xx = x0 + 2; xx < x1 - 2; xx += 12) { R(xx, y0 + 5, 1, 4, '#b08840'); R(xx + 1, y0 + 5, 1, 4, '#5a4420'); }
  }
  // currents: a charred contact strip along the surface the voltage runs on. The live
  // zigzag is drawn on top every frame. Surface space: u runs along the surface, v away from it.
  const WIRE = { rim: '#05050f', dark: '#1a1a38', ember: '#7a6420', hot: '#ffe14a' };
  for (const { x, y, side } of currentTiles(room)) {
    const L = q(x + 1) - q(x);
    const px = (u: number, v: number): [number, number] => {
      if (side === 'ceil') return [q(x) + u, q(y) + v];
      if (side === 'left') return [q(x) + v, q(y) + u];
      if (side === 'right') return [q(x + 1) - 1 - v, q(y) + u];
      return [q(x) + u, q(y + 1) - 1 - v];
    };
    const dot = (u: number, v: number, col: string) => { const [a, b] = px(u, v); R(a, b, 1, 1, col); };
    const seed = (x * 73856093) ^ (y * 19349663);
    const hash = (n: number) => { const s = Math.sin(seed * 0.0001 + n * 12.9898) * 43758.5453; return s - Math.floor(s); };
    // scorch: the surface under the arc is burnt, dark at the contact and fading in
    const into = (u: number, v: number, col: string) => {
      const [a, b] = px(u, -v);
      if (solid(a, b)) R(a, b, 1, 1, col);
    };
    for (let u = -3; u < L + 3; u++) {
      const edge = u < 0 ? -u : u >= L ? u - L + 1 : 0;
      const depth = 3 + Math.round(hash(60 + u) * 3) - edge;
      for (let v = 1; v <= depth; v++) {
        if (hash(100 + u * 7 + v * 13) < 0.9 - v * 0.12) into(u, v, v <= 1 ? WIRE.rim : v === 2 ? WIRE.dark : '#232338');
      }
    }
    // the contact strip, with a glowing stud every few pixels
    for (let u = 0; u < L; u++) {
      dot(u, 0, WIRE.rim);
      dot(u, 1, WIRE.dark);
      if (u % 6 === 3) { dot(u, 1, WIRE.ember); dot(u, 2, WIRE.hot); }
    }
  }

  add(scene, key, c);
  return key;
}

/** Neon-only data block: exists only in PKT's perception. */
export function neonBlockTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `neon_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const pad = 10;
  const [c, ctx] = makeCanvas(w + pad * 2, h + pad * 2);
  ctx.shadowColor = 'rgba(255,40,220,1)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(120,10,110,0.65)';
  ctx.fillRect(pad, pad, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,60,230,1)';
  ctx.lineWidth = 3;
  ctx.strokeRect(pad + 1.5, pad + 1.5, w - 3, h - 3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,120,240,0.7)';
  for (let x = pad + 10; x < pad + w; x += 10) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + h); ctx.stroke(); }
  for (let y = pad + 10; y < pad + h; y += 10) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + w, y); ctx.stroke(); }
  add(scene, key, c);
  return key;
}

/** True-only ledge: plain beige low-poly stone that PKT can't perceive. */
/**
 * A colour ledge: a projected, holographic circuit board. Drawn in white and tinted by
 * its colour at runtime: a see-through panel with scanlines, a bright top edge to stand
 * on, corner brackets, a few traces with vias, and a chip outline on wider ones.
 */
export function trueLedgeTexture(scene: Phaser.Scene, w: number, h: number, seed: number): string {
  const key = `true_${w}x${h}_${seed}`;
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = makeCanvas(w, h);
  const P = 3;
  const R = (x: number, y: number, ww: number, hh: number, a: number) => { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(x, y, ww, hh); };
  const r = rng(seed * 977 + w * 13 + h);
  // the panel and its scanlines
  R(0, 0, w, h, 0.26);
  for (let y = P * 2; y < h; y += P * 2) R(P, y, w - P * 2, 1, 0.12);
  // edges: a bright surface to stand on, a thin underside, faint sides
  R(0, 0, w, P, 1);
  R(0, P, w, 1, 0.55);
  R(0, h - P + 1, w, P - 1, 0.6);
  R(0, 0, 1, h, 0.5); R(w - 1, 0, 1, h, 0.5);
  // projection-frame brackets at the corners
  const b = Math.min(P * 4, Math.floor(w / 4));
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) {
    R(sx > 0 ? x : x - b, sy > 0 ? y : y - P, b, P, 0.95);
    R(sx > 0 ? x : x - P, sy > 0 ? y : y - b, P, b, 0.95);
  }
  // traces with a via at each end
  const rows = Math.max(1, Math.floor((h - P * 4) / (P * 3)));
  for (let i = 0; i < rows; i++) {
    const y = P * 2 + Math.round(((i + 0.5) / rows) * (h - P * 4) / P) * P;
    const x0 = P * (2 + Math.floor(r() * 3)), x1 = w - P * (2 + Math.floor(r() * 3));
    if (x1 - x0 < P * 4) continue;
    R(x0, y, x1 - x0, 1, 0.7);
    R(x0 - 1, y - 1, P, P, 0.95); R(x1 - 2, y - 1, P, P, 0.95);
  }
  // a chip outline in the middle of a wide ledge
  if (w >= 80 && h >= 30) {
    const cw = P * 6, chh = Math.min(P * 4, h - P * 4), cx = Math.round((w - cw) / 2 / P) * P, cy = Math.round((h - chh) / 2 / P) * P;
    R(cx, cy, cw, chh, 0.35);
    R(cx, cy, cw, 1, 0.9); R(cx, cy + chh - 1, cw, 1, 0.9); R(cx, cy, 1, chh, 0.9); R(cx + cw - 1, cy, 1, chh, 0.9);
    for (let x = cx + P; x < cx + cw - 1; x += P) { R(x, cy - 2, 1, 2, 0.8); R(x, cy + chh, 1, 2, 0.8); }
  }
  add(scene, key, c);
  return key;
}

export function gateTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `gate_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = makeCanvas(w, h);
  // a roll-down security shutter: dark frame, ribbed slats, a hazard band at the foot
  const px = (x: number, y: number, ww: number, hh: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
  px(0, 0, w, h, '#14161f');
  px(3, 0, w - 6, h, '#3a4152');
  for (let y = 0; y < h - 14; y += 9) {
    px(3, y, w - 6, 2, '#5a6378');
    px(3, y + 6, w - 6, 2, '#262b38');
  }
  for (let x = 3; x < w - 3; x += 6) px(x, h - 12, 3, 12, (x / 6) % 2 ? '#ffc21a' : '#1a1410');
  px(0, h - 14, w, 2, '#14161f');
  px(w / 2 - 3, h - 24, 6, 6, '#14161f');
  add(scene, key, c);
  return key;
}

export function liftTexture(scene: Phaser.Scene, w: number, yankable = false): string {
  const key = `lift_${w}${yankable ? 'y' : ''}`;
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = makeCanvas(w, 34);
  lowPoly(ctx, 0, 0, w, 20, [0.62, 0.6, 0.6], w, 16, 0.4);
  ctx.fillStyle = 'rgba(255,250,235,0.95)';
  ctx.fillRect(0, 0, w, 4);
  ctx.fillStyle = 'rgba(40,36,34,0.9)';
  for (let x = 12; x < w - 12; x += 24) ctx.fillRect(x, 9, 12, 4);
  const legs = bakeClay(w, 34, (p) => {
    p.fillRect(10, 16, 14, 16);
    p.fillRect(w - 24, 16, 14, 16);
  }, { base: PAL.clay, round: 3, bevel: 4, fingerprint: 0.5, seed: 8 });
  ctx.drawImage(legs, 0, 0);
  if (yankable) {
    // yankable platforms wear orange hazard chevrons
    ctx.fillStyle = 'rgba(255,130,30,0.95)';
    for (let x = 6; x < w - 14; x += 22) { ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x + 8, 5); ctx.lineTo(x + 14, 12); ctx.lineTo(x + 6, 12); ctx.fill(); }
  }
  add(scene, key, c);
  return key;
}
