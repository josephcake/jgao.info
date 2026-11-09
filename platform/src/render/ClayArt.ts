/**
 * Procedural "true world" art: claymation blobs (baked normal-lit height fields with
 * fingerprint ridges) and low-poly faceted shapes. Everything is authored in muted
 * analog colours; PKT's perception shader turns it neon at runtime.
 */
export type RGB = [number, number, number];

function hash(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise in [0,1]. */
export function vnoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = src[row] * (r + 1);
    for (let x = 0; x < r; x++) acc += src[row + Math.min(x, w - 1)];
    for (let x = 0; x < w; x++) {
      acc += src[row + Math.min(x + r, w - 1)] - src[row + Math.max(x - r - 1, 0)];
      dst[row + x] = acc * iarr;
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    let acc = src[x] * (r + 1);
    for (let y = 0; y < r; y++) acc += src[Math.min(y, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      acc += src[Math.min(y + r, h - 1) * w + x] - src[Math.max(y - r - 1, 0) * w + x];
      dst[y * w + x] = acc * iarr;
    }
  }
}

/** Approximate gaussian blur (3 box passes). Returns a new array. */
export function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const a = src.slice();
  const b = new Float32Array(src.length);
  const rr = Math.max(1, Math.round(r / 1.7));
  for (let i = 0; i < 3; i++) {
    boxBlurH(a, b, w, h, rr);
    boxBlurV(b, a, w, h, rr);
  }
  return a;
}

export interface ClayOpts {
  base: RGB;
  base2?: RGB;
  /** Corner rounding radius in px (blur + threshold). */
  round?: number;
  /** Edge wobble amount (0..0.4). */
  wobble?: number;
  /** Bevel radius in px. */
  bevel?: number;
  /** Fingerprint ridge strength. */
  fingerprint?: number;
  shine?: number;
  seed?: number;
  /** Lumpy sculpt noise strength. */
  lumps?: number;
  /** Scale of colour variation noise. */
  colorScale?: number;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

/** Bake a clay object: `draw` paints the silhouette in any opaque colour. */
export function bakeClay(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, o: ClayOpts): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  draw(ctx);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;
  const n = W * H;
  const seed = o.seed ?? 1;
  let alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = img.data[i * 4 + 3] / 255;

  if (o.round && o.round > 0) {
    const b = blur(alpha, W, H, o.round);
    const wob = o.wobble ?? 0.15;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const nz = vnoise(x / 18, y / 18, seed) - 0.5;
        alpha[i] = Math.min(1, Math.max(0, (b[i] + nz * wob - 0.5) * 6 + 0.5));
      }
    }
  }

  const bevel = o.bevel ?? 8;
  const hf = blur(alpha, W, H, bevel);
  const fp = o.fingerprint ?? 0.5;
  const lumps = o.lumps ?? 0.5;
  if (fp > 0 || lumps > 0) {
    const cell = 150;
    const r = rng(seed * 9973);
    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    const centers: { x: number; y: number; on: boolean }[] = [];
    for (let i = 0; i < cols * rows; i++) {
      const cx = (i % cols) * cell + 35 + r() * (cell - 70);
      const cy = Math.floor(i / cols) * cell + 35 + r() * (cell - 70);
      centers.push({ x: cx, y: cy, on: r() < 0.55 });
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (alpha[i] <= 0) continue;
        let add = (vnoise(x / 26, y / 26, seed + 3) - 0.5) * 0.12 * lumps;
        add += (vnoise(x / 5, y / 5, seed + 5) - 0.5) * 0.015 * lumps;
        if (fp > 0) {
          const c = centers[Math.floor(y / cell) * cols + Math.floor(x / cell)];
          if (c && c.on) {
            const d = Math.hypot(x - c.x, (y - c.y) * 1.3);
            if (d < 34) add += Math.sin(d * 1.1) * 0.012 * fp * (1 - d / 34);
          }
        }
        hf[i] += add * alpha[i];
      }
    }
  }

  const base = o.base;
  const base2 = o.base2 ?? base;
  const shine = o.shine ?? 0.35;
  const cs = o.colorScale ?? 60;
  const strength = 2.2 * Math.max(4, bevel);
  const L = [-0.45, -0.75, 0.55];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = Math.hypot(hx, hy, hz);
  hx /= hl; hy /= hl; hz /= hl;
  const out = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = alpha[i];
      if (a <= 0.003) {
        out[i * 4 + 3] = 0;
        continue;
      }
      const xl = x > 0 ? hf[i - 1] : hf[i];
      const xr = x < W - 1 ? hf[i + 1] : hf[i];
      const yu = y > 0 ? hf[i - W] : hf[i];
      const yd = y < H - 1 ? hf[i + W] : hf[i];
      let nx = (xl - xr) * strength;
      let ny = (yu - yd) * strength;
      let nzz = 1;
      const nl = Math.hypot(nx, ny, nzz);
      nx /= nl; ny /= nl; nzz /= nl;
      const diff = Math.max(0, nx * lx + ny * ly + nzz * lz);
      const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nzz * hz), 28) * shine;
      const t = vnoise(x / cs, y / cs, seed + 11);
      const shade = 0.38 + diff * 0.82;
      const occl = 0.75 + 0.25 * Math.min(1, hf[i] * 1.6);
      for (let k = 0; k < 3; k++) {
        const bc = base[k] + (base2[k] - base[k]) * t;
        out[i * 4 + k] = Math.min(255, (bc * shade * occl + spec) * 255);
      }
      out[i * 4 + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const css = (c: RGB, mul = 1, a = 1) =>
  `rgba(${Math.round(Math.min(1, c[0] * mul) * 255)},${Math.round(Math.min(1, c[1] * mul) * 255)},${Math.round(Math.min(1, c[2] * mul) * 255)},${a})`;

/** Fill a rect with flat-shaded jittered triangles (low-poly look). */
export function lowPoly(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: RGB, seed: number, cell = 22, contrast = 0.35): void {
  const r = rng(seed);
  const cols = Math.max(1, Math.round(w / cell));
  const rows = Math.max(1, Math.round(h / cell));
  const pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: [number, number][] = [];
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols;
      const edgeY = j === 0 || j === rows;
      const jx = edgeX ? 0 : (r() - 0.5) * (w / cols) * 0.7;
      const jy = edgeY ? 0 : (r() - 0.5) * (h / rows) * 0.7;
      row.push([x + (i / cols) * w + jx, y + (j / rows) * h + jy]);
    }
    pts.push(row);
  }
  const tri = (a: [number, number], b: [number, number], c: [number, number], vert: number) => {
    const m = 1 - contrast / 2 + r() * contrast + (0.5 - vert) * 0.25;
    ctx.fillStyle = css(base, m);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p00 = pts[j][i], p10 = pts[j][i + 1], p01 = pts[j + 1][i], p11 = pts[j + 1][i + 1];
      const v = j / rows;
      if ((i + j) % 2) {
        tri(p00, p10, p11, v);
        tri(p00, p11, p01, v);
      } else {
        tri(p00, p10, p01, v);
        tri(p10, p11, p01, v);
      }
    }
  }
}

/** Low-poly polygon: draw a convex-ish outline and facet it by fanning from jittered interior points. */
export function lowPolyPoly(ctx: CanvasRenderingContext2D, pts: [number, number][], base: RGB, seed: number, contrast = 0.4): void {
  const r = rng(seed);
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ix = cx + (mx - cx) * 0.45 + (r() - 0.5) * 6, iy = cy + (my - cy) * 0.45 + (r() - 0.5) * 6;
    const facing = -((b[0] - a[0]) * 0.3 + (a[1] + b[1] - 2 * cy) * -0.01);
    for (const [p, q] of [[a, b], [a, [ix, iy] as [number, number]]] as [[number, number], [number, number]][]) {
      const m = 0.8 + r() * contrast + Math.max(-0.2, Math.min(0.2, facing * 0.004));
      ctx.fillStyle = css(base, m);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.lineTo(i % 2 ? ix : cx, i % 2 ? iy : cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = css(base, 0.85 + r() * contrast);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(ix, iy);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  }
}

export const PAL = {
  clay: [0.17, 0.19, 0.27] as RGB,
  clay2: [0.21, 0.2, 0.3] as RGB,
  moss: [0.3, 0.78, 0.9] as RGB,
  plank: [0.5, 0.33, 0.28] as RGB,
  stone: [0.62, 0.58, 0.5] as RGB,
  metal: [0.4, 0.42, 0.44] as RGB,
  rust: [0.62, 0.26, 0.17] as RGB,
  eye: [1.0, 0.36, 0.08] as RGB,
  boss: [0.6, 0.44, 0.46] as RGB,
};

export { css, rng };
