/**
 * Verlet rope pinned at both ends. Purely visual: gameplay constraints
 * (swing radius, tether length) live in Cable.
 */
export class Rope {
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;

  constructor(readonly count: number, x = 0, y = 0) {
    this.xs = new Float32Array(count);
    this.ys = new Float32Array(count);
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.reset(x, y, x, y);
  }

  /** Lay the rope in a straight line from a to b. */
  reset(ax: number, ay: number, bx: number, by: number): void {
    for (let i = 0; i < this.count; i++) {
      const t = i / (this.count - 1);
      this.xs[i] = this.px[i] = ax + (bx - ax) * t;
      this.ys[i] = this.py[i] = ay + (by - ay) * t;
    }
  }

  /**
   * Advance the simulation. `length` is the total rest length; if the ends are
   * further apart than that, the rope simply goes taut.
   */
  step(dt: number, ax: number, ay: number, bx: number, by: number, length: number, gravity = 1400, iterations = 10): void {
    const n = this.count;
    const damp = 0.985;
    for (let i = 1; i < n - 1; i++) {
      const vx = (this.xs[i] - this.px[i]) * damp;
      const vy = (this.ys[i] - this.py[i]) * damp;
      this.px[i] = this.xs[i];
      this.py[i] = this.ys[i];
      this.xs[i] += vx;
      this.ys[i] += vy + gravity * dt * dt;
    }
    const seg = Math.max(length, Math.hypot(bx - ax, by - ay)) / (n - 1);
    for (let k = 0; k < iterations; k++) {
      this.xs[0] = ax;
      this.ys[0] = ay;
      this.xs[n - 1] = bx;
      this.ys[n - 1] = by;
      for (let i = 0; i < n - 1; i++) {
        const dx = this.xs[i + 1] - this.xs[i];
        const dy = this.ys[i + 1] - this.ys[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - seg) / d;
        const wa = i === 0 ? 0 : 0.5;
        const wb = i + 1 === n - 1 ? 0 : 0.5;
        const sum = wa + wb || 1;
        this.xs[i] += dx * diff * (wa / sum);
        this.ys[i] += dy * diff * (wa / sum);
        this.xs[i + 1] -= dx * diff * (wb / sum);
        this.ys[i + 1] -= dy * diff * (wb / sum);
      }
    }
    const dist = Math.hypot(bx - ax, by - ay);
    const taut = Math.min(1, Math.max(0, (dist - length * 0.9) / (length * 0.1 + 0.0001)));
    if (taut > 0) {
      for (let i = 1; i < n - 1; i++) {
        const t = i / (n - 1);
        this.xs[i] += (ax + (bx - ax) * t - this.xs[i]) * taut;
        this.ys[i] += (ay + (by - ay) * t - this.ys[i]) * taut;
      }
    }
    this.xs[0] = ax;
    this.ys[0] = ay;
    this.xs[n - 1] = bx;
    this.ys[n - 1] = by;
  }

  /** Teleport a point (no velocity). */
  place(i: number, x: number, y: number): void {
    this.xs[i] = this.px[i] = x;
    this.ys[i] = this.py[i] = y;
  }

  /** Current polyline length. */
  length(): number {
    let l = 0;
    for (let i = 0; i < this.count - 1; i++) l += Math.hypot(this.xs[i + 1] - this.xs[i], this.ys[i + 1] - this.ys[i]);
    return l;
  }
}
