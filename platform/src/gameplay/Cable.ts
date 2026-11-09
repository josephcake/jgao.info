import Phaser from 'phaser';
import { T } from '../config/tuning';
import { Audio } from '../core/Audio';
import { fillKeys } from '../core/Bindings';
import { hasAbility } from './Abilities';
import type { Intent } from '../core/Input';
import { moveBody, raycast, segmentRect } from './physics';
import { Rope } from './Rope';
import type { Port } from './Devices';
import type { GameScene } from '../scenes/GameScene';

export type CableState = 'idle' | 'shoot' | 'swing' | 'zip' | 'tether' | 'placed' | 'hack' | 'retract' | 'drive';

export type JackTarget = { kind: 'port'; port: Port; x: number; y: number };

const C = T.cable;
const PIXEL_LEN = 46;

interface Aim {
  x: number;
  y: number;
  /** Cosine of the cone half-angle. */
  cos: number;
}

/**
 * PKT's ethernet cable: grappling hook, power conduit and data line.
 * preStep() runs before the player integrates, postStep() after.
 */
export class Cable {
  state: CableState = 'idle';
  readonly rope = new Rope(C.ropeSegments);
  tipX = 0;
  tipY = 0;
  private tipVX = 0;
  private tipVY = 0;
  private t = 0;
  target: JackTarget | null = null;
  aimTarget: JackTarget | null = null;
  /** A drivable platform the cable is tethered to and steering. */
  private driven: Port | null = null;
  swingLen = 0;
  source: Port | null = null;
  consumer: Port | null = null;
  private aim: Aim = { x: 1, y: 0, cos: 0.5 };
  private retractFromX = 0;
  private retractFromY = 0;
  private shootMax = 0;
  private shootDirX = 1;
  private shootDirY = 0;
  private zipStall = 0;
  /** How long the cable stays in a hacked/connected port before coming back. */
  private hackHold = 0.22;
  pulse = 0;
  handX = 0;
  handY = 0;

  private gPix: Phaser.GameObjects.Graphics;
  private gSmooth: Phaser.GameObjects.Graphics;
  private plugPix: Phaser.GameObjects.Image;
  private reticle: Phaser.GameObjects.Graphics;

  constructor(w: GameScene) {
    this.gSmooth = w.addWorld(w.add.graphics().setDepth(15));
    this.gPix = w.addHero(w.add.graphics().setDepth(49));
    this.plugPix = w.addHero(w.add.image(0, 0, 'rj45').setScale(3).setDepth(50));
    this.reticle = w.addHero(w.add.graphics().setDepth(60));
    const p = w.player;
    this.handX = p.cx;
    this.handY = p.cy;
    this.tipX = p.cx;
    this.tipY = p.cy + 20;
    this.rope.reset(this.handX, this.handY, this.tipX, this.tipY);
  }

  get live(): boolean { return this.state === 'tether' || this.state === 'placed' || this.state === 'drive' || (this.state === 'shoot' && this.source !== null); }
  get busy(): boolean { return this.state === 'placed' || this.state === 'tether' || this.state === 'drive'; }

  private isDriving(port: Port): boolean { return !!port.owner?.drivable; }

  private updateHand(w: GameScene): void {
    const p = w.player;
    this.handX = p.cx - p.facing * 5;
    this.handY = p.cy + 6;
  }

  // ---------------------------------------------------------------- targeting

  /**
   * Resolve the held 8-way direction into an aim ray and cone. Keyboard aim is
   * coarse, so cones are wide and a bare sideways hold leans upward, where
   * anchors usually are.
   */
  private resolveAim(input: Intent, facing: number): Aim {
    const { dirX, dirY } = input;
    const A = C.aim;
    let x: number, y: number, cone: number;
    if (dirX === 0 && dirY === 0) { x = facing; y = -A.idleLift; cone = A.idleConeDeg; }
    else if (dirY === 0) { x = dirX; y = -A.sideLift; cone = A.sideConeDeg; }
    else if (dirX === 0) { x = 0; y = dirY; cone = A.vertConeDeg; }
    else { x = dirX; y = dirY; cone = A.diagConeDeg; }
    const l = Math.hypot(x, y);
    return { x: x / l, y: y / l, cos: Math.cos((cone * Math.PI) / 180) };
  }

  private findTarget(w: GameScene, aim: Aim): JackTarget | null {
    const hx = this.handX, hy = this.handY;
    const aimX = aim.x, aimY = aim.y;
    const cosCone = aim.cos;
    const tethered = this.state === 'tether';
    const can = (a: Parameters<typeof hasAbility>[1]) => hasAbility(w.levelIndex, a);
    let best: JackTarget | null = null;
    let bestScore = Infinity;
    const consider = (t: JackTarget, penalty = 0) => {
      const dx = t.x - hx, dy = t.y - hy;
      const d = Math.hypot(dx, dy);
      if (d > C.jackRange || d < 8) return;
      const dot = (dx * aimX + dy * aimY) / d;
      if (dot < cosCone) return;
      const tt = raycast(hx, hy, t.x, t.y, w.solids);
      if (tt < (d - 26) / d) return;
      const score = (1 - dot) / (1 - cosCone) * 0.6 + (d / C.jackRange) * 0.4 + penalty;
      if (score < bestScore) { bestScore = score; best = t; }
    };
    for (const port of w.ports) {
      if (!port.usable(w)) continue;
      if ((port.kind === 'source' || port.kind === 'consumer' || port.kind === 'capacitor') && !can('power')) continue;
      if (port.kind === 'data' && !can('hack')) continue;
      if (port.kind === 'yank' && !can('yank')) continue;
      const plug = port.kind === 'consumer' || port.kind === 'capacitor';
      if (tethered && !plug) continue;
      consider({ kind: 'port', port, x: port.x, y: port.y }, plug && !tethered ? 0.35 : 0);
    }
    return best;
  }

  // ---------------------------------------------------------------- simulation

  preStep(dt: number, input: Intent, w: GameScene): void {
    const p = w.player;
    this.updateHand(w);
    this.pulse += dt * (this.live ? 3 : 0);
    if (p.dead) return;

    const canAim = this.state === 'idle' || this.state === 'retract' || this.state === 'tether';
    this.aim = this.resolveAim(input, p.facing);
    this.aimTarget = canAim ? this.findTarget(w, this.aim) : null;
    if (this.aimTarget?.kind === 'port') this.aimTarget.port.targeted = 1;

    // while the cable is out, jack pulls it back (except jacking onward from a live tether)
    const out = this.state !== 'idle' && this.state !== 'retract';
    const plugOnward = this.state === 'tether' && input.jackPressed && this.aimTarget !== null;
    if (out && !plugOnward && input.jackPressed) {
      this.recall(w);
      return;
    }

    this.t += dt;
    switch (this.state) {
      case 'idle':
      case 'retract':
        if (this.state === 'retract' && this.t >= 0.14) this.state = 'idle';
        if (input.jackPressed) this.startShoot(w, input);
        break;
      case 'shoot':
        this.stepShoot(dt, w, input);
        break;
      case 'swing':
        if (!input.jackHeld || input.jumpPressed) {
          this.releaseSwing(w, input.jumpPressed);
          break;
        }
        if (input.up) this.swingLen = Math.max(C.swingMin, this.swingLen - C.reelSpeed * dt);
        if (input.down) this.swingLen = Math.min(C.swingMax, this.swingLen + C.reelSpeed * dt);
        break;
      case 'zip':
        this.stepZip(dt, w, input);
        break;
      case 'tether':
        if (input.jackPressed) this.startShoot(w, input);
        break;
      case 'hack':
        if (this.t >= this.hackHold) this.beginRetract();
        break;
      case 'drive':
        // stay tethered to the platform; the platform follows Pix on its own. X (handled
        // above) recalls and parks it. If the platform vanished, let go.
        if (!this.driven) this.beginRetract();
        break;
    }
  }

  postStep(dt: number, w: GameScene): void {
    const p = w.player;
    this.updateHand(w);
    if (this.state === 'swing' && this.target) this.constrain(w, this.target.x, this.target.y, this.swingLen, true);
    if (this.state === 'tether' && this.source) this.constrain(w, this.source.x, this.source.y, C.tetherLength, false);
    if (this.state === 'shoot' && this.source) this.constrain(w, this.source.x, this.source.y, C.tetherLength, false);
    if (this.state === 'drive' && this.driven) this.constrain(w, this.driven.x, this.driven.y, C.tetherLength, true);
    this.updateHand(w);
    this.simRope(dt, w);
    void p;
  }

  private constrain(w: GameScene, ax: number, ay: number, len: number, swing: boolean): void {
    const p = w.player;
    const dx = p.cx - ax, dy = p.cy - ay;
    const d = Math.hypot(dx, dy);
    if (d <= len || d < 1) return;
    const nx = dx / d, ny = dy / d;
    const tx = ax + nx * len - p.w / 2, ty = ay + ny * len - p.h / 2;
    moveBody(p, tx - p.x, 0, w.solids);
    moveBody(p, 0, ty - p.y, w.solids);
    const vr = p.vx * nx + p.vy * ny;
    if (vr > 0) {
      p.vx -= vr * nx;
      p.vy -= vr * ny;
      if (swing) {
        // keep energy in the swing: redirect a bit of the lost radial speed tangentially
        const tx2 = -ny, ty2 = nx;
        const s = Math.sign(p.vx * tx2 + p.vy * ty2) || 1;
        p.vx += tx2 * s * vr * 0.08;
        p.vy += ty2 * s * vr * 0.08;
      }
    }
  }

  // ---------------------------------------------------------------- jack

  private startShoot(w: GameScene, _input: Intent): void {
    this.target = this.aimTarget;
    this.state = 'shoot';
    this.t = 0;
    if (this.state === 'shoot' && !this.source) {
      this.tipX = this.handX;
      this.tipY = this.handY;
    } else {
      this.tipX = this.handX;
      this.tipY = this.handY;
    }
    this.shootDirX = this.aim.x;
    this.shootDirY = this.aim.y;
    const reach = C.jackRange * 0.85;
    this.shootMax = reach * raycast(this.handX, this.handY, this.handX + this.aim.x * reach, this.handY + this.aim.y * reach, w.solids);
    Audio.play('jack');
  }

  private stepShoot(dt: number, w: GameScene, input: Intent): void {
    const step = C.jackSpeed * dt;
    if (this.target) {
      const dx = this.target.x - this.tipX, dy = this.target.y - this.tipY;
      const d = Math.hypot(dx, dy);
      if (d <= step) {
        this.tipX = this.target.x;
        this.tipY = this.target.y;
        this.connect(w, input);
      } else {
        this.tipX += (dx / d) * step;
        this.tipY += (dy / d) * step;
      }
    } else {
      const d = Math.hypot(this.tipX - this.handX, this.tipY - this.handY);
      if (d + step >= this.shootMax) {
        w.fx.pixelBurst(this.tipX, this.tipY, 4, 0x6aa8ff, 80);
        this.beginRetract();
        if (this.source) this.state = 'tether';
      } else {
        this.tipX += this.shootDirX * step;
        this.tipY += this.shootDirY * step;
      }
    }
  }

  private connect(w: GameScene, input: Intent): void {
    const p = w.player;
    const tgt = this.target!;
    this.t = 0;
    const port = tgt.port;
    Audio.play('plug');
    w.react('note');
    w.fx.ring(port.x, port.y, port.color);
    switch (port.kind) {
      case 'connector':
        // the first connection gives Pix the colour back; after that it's a plain anchor
        if (port.hue && !w.owned.includes(port.hue as never)) {
          w.connectColour(port.hue);
          this.state = 'hack';
          this.hackHold = 2.4;
          return;
        }
        // anchors (swing and fling) belong to stage 2; before that a used connector does nothing
        if (!hasAbility(w.levelIndex, 'swing')) { this.beginRetract(); return; }
      // falls through
      case 'anchor': {
        if (!input.jackHeld) {
          const dx = port.x - p.cx, dy = port.y - p.cy;
          const d = Math.hypot(dx, dy) || 1;
          p.vx += (dx / d) * 520;
          p.vy = Math.min(p.vy, 0) + (dy / d) * 520;
          p.refreshAir();
          this.beginRetract();
          return;
        }
        const d = Math.hypot(p.cx - port.x, p.cy - port.y);
        this.swingLen = Phaser.Math.Clamp(d, C.swingMin, C.swingMax);
        this.state = 'swing';
        p.mode = 'swing';
        p.dashTime = 0;
        p.refreshAir();
        return;
      }
      case 'pull':
        this.state = 'zip';
        p.mode = 'zip';
        p.dashTime = 0;
        this.zipStall = 0;
        Audio.play('zip');
        return;
      case 'source':
        this.source = port;
        this.state = 'tether';
        w.toast('LIVE. FIND SOMETHING THAT WANTS POWER.', 0x30ff7a);
        return;
      case 'consumer':
      case 'capacitor':
        if (!this.source) {
          w.toast('NO CARRIER. JACK A SOURCE FIRST.', 0xff6a6a);
          Audio.play('nocarrier');
          this.beginRetract();
          return;
        }
        if (Math.hypot(port.x - this.source.x, port.y - this.source.y) > C.tetherLength + 40) {
          w.toast('CABLE TOO SHORT. PHYSICS: STILL UNDEFEATED.', 0xff6a6a);
          Audio.play('nocarrier');
          this.state = 'tether';
          return;
        }
        this.consumer = port;
        this.state = 'placed';
        if (port.id) w.power.setPlugged(port.id, true);
        w.toast(port.kind === 'capacitor' ? fillKeys('CHARGING... ({recall} WHEN FULL)') : 'POWERED. YOU ARE NOW INFRASTRUCTURE.', 0x30ff7a);
        w.fx.pixelBurst(port.x, port.y, 14, 0x30ff7a, 220);
        return;
      case 'yank':
        // an on-object port: hand the yank to its host (drives a platform / rips a door)
        if (port.owner) {
          port.owner.yank(p.cx, w);
          // a drivable platform stays tethered: hold the cable on it until recalled (X)
          if (this.isDriving(port)) {
            this.driven = port;
            this.state = 'drive';
            return;
          }
          this.state = 'hack';
          this.hackHold = 0.4;
          return;
        }
        // legacy standalone lever: one hard pull flips whatever it's wired to
        if (port.id) {
          const on = w.power.toggle(port.id);
          Audio.play('gate');
          w.juice.shake(4, 0.25);
          w.fx.pixelBurst(port.x, port.y, 10, 0xff8a1e, 200);
          w.toast(on ? 'YANKED.' : 'YANKED BACK.', 0xff8a1e);
        }
        this.state = 'hack';
        this.hackHold = 0.4;
        return;
      case 'data':
        if (port.id) {
          w.power.toggle(port.id);
          Audio.play('hack');
          w.fx.hackGlyphs(port.x, port.y);
        }
        this.state = 'hack';
        this.hackHold = 0.22;
        return;
    }
  }

  private stepZip(dt: number, w: GameScene, input: Intent): void {
    const p = w.player;
    const tgt = this.target!;
    const dx = tgt.x - p.cx, dy = tgt.y - p.cy;
    const d = Math.hypot(dx, dy);
    const prev = { x: p.x, y: p.y };
    p.vx = (dx / (d || 1)) * C.zipSpeed;
    p.vy = (dy / (d || 1)) * C.zipSpeed;
    w.fx.afterimage(p);
    if (d < 30 || input.jumpPressed) {
      p.mode = 'normal';
      p.vx *= 0.35;
      p.vy = input.jumpPressed ? -T.player.jumpVelocity * 0.9 : -420;
      p.refreshAir();
      p.squashX = 0.75;
      p.squashY = 1.3;
      this.beginRetract();
      return;
    }
    void prev;
    this.zipStall += dt;
    if (this.zipStall > 0.9) {
      p.mode = 'normal';
      this.beginRetract();
    }
  }

  private releaseSwing(w: GameScene, jumped: boolean): void {
    const p = w.player;
    p.mode = 'normal';
    p.vx *= C.swingReleaseBoost;
    p.vy *= C.swingReleaseBoost;
    if (jumped) p.vy = Math.min(p.vy, 0) - 380;
    // letting go on the rising side gets a little extra lift, so the release window is forgiving
    else if (p.vy < 0) p.vy -= C.swingReleaseLift;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > C.maxReleaseSpeed) { p.vx *= C.maxReleaseSpeed / sp; p.vy *= C.maxReleaseSpeed / sp; }
    p.refreshAir();
    p.jumpCutDone = true;
    Audio.play('unplug');
    this.beginRetract();
  }

  private beginRetract(): void {
    this.state = 'retract';
    this.t = 0;
    this.retractFromX = this.tipX;
    this.retractFromY = this.tipY;
    this.target = null;
  }

  /** Q: pull the cable back from wherever it is. */
  recall(w: GameScene): void {
    const p = w.player;
    if (this.consumer?.id) w.power.setPlugged(this.consumer.id, false);
    if (this.state === 'placed' && this.consumer) { this.tipX = this.consumer.x; this.tipY = this.consumer.y; }
    if (this.state === 'tether' && this.source) { this.tipX = this.source.x; this.tipY = this.source.y; }
    if (this.state === 'drive' && this.driven) {
      this.tipX = this.driven.x; this.tipY = this.driven.y;
      this.driven.owner?.release?.(w);
      this.driven = null;
    }
    this.source = null;
    this.consumer = null;
    if (p.mode !== 'normal') p.mode = 'normal';
    Audio.play('unplug');
    this.beginRetract();
  }

  /** Forced drop, e.g. when PKT is hurt. A placed cable stays placed. */
  drop(w: GameScene, _reason: string): void {
    if (this.state === 'placed' || this.state === 'idle' || this.state === 'retract') return;
    if (this.state === 'drive' || this.state === 'tether' || (this.state === 'shoot' && this.source)) { this.recall(w); return; }
    w.player.mode = 'normal';
    this.beginRetract();
  }

  /** Room reset. */
  reset(w: GameScene): void {
    this.state = 'idle';
    this.source = null;
    this.consumer = null;
    this.driven?.owner?.release?.(w);
    this.driven = null;
    this.target = null;
    this.updateHand(w);
    this.tipX = this.handX;
    this.tipY = this.handY + 20;
    this.rope.reset(this.handX, this.handY, this.tipX, this.tipY);
  }

  // ---------------------------------------------------------------- rope + render

  /** Which end of the rope PKT holds: 'a', 'b' or none (placed cable). */
  private handEnd: 'a' | 'b' | null = 'a';

  private simRope(dt: number, w: GameScene): void {
    const p = w.player;
    const n = this.rope.count;
    let ax = this.handX, ay = this.handY, bx = this.tipX, by = this.tipY, len = 0;
    this.handEnd = 'a';
    switch (this.state) {
      case 'idle': {
        const restX = this.handX - p.facing * 24 - p.vx * 0.03;
        const restY = this.handY + 22 - p.vy * 0.02;
        this.tipVX += ((restX - this.tipX) * 160 - this.tipVX * 12) * dt;
        this.tipVY += ((restY - this.tipY) * 160 - this.tipVY * 12 + 600) * dt;
        this.tipX += this.tipVX * dt;
        this.tipY += this.tipVY * dt;
        const dx = this.tipX - this.handX, dy = this.tipY - this.handY;
        const d = Math.hypot(dx, dy);
        if (d > 44) { this.tipX = this.handX + (dx / d) * 44; this.tipY = this.handY + (dy / d) * 44; }
        bx = this.tipX; by = this.tipY; len = 48;
        break;
      }
      case 'retract': {
        const k = Math.min(1, this.t / 0.14);
        this.tipX = this.retractFromX + (this.handX - this.retractFromX) * k;
        this.tipY = this.retractFromY + (this.handY + 18 - this.retractFromY) * k;
        this.tipVX = 0; this.tipVY = 0;
        bx = this.tipX; by = this.tipY;
        len = Math.hypot(bx - ax, by - ay) * 1.05 + 10;
        break;
      }
      case 'swing':
      case 'zip':
        bx = this.target!.x; by = this.target!.y;
        len = Math.max(this.swingLen, 1) * (this.state === 'zip' ? 0 : 1);
        break;
      case 'tether':
        ax = this.source!.x; ay = this.source!.y;
        bx = this.handX; by = this.handY;
        this.handEnd = 'b';
        len = Math.min(C.tetherLength, Math.hypot(bx - ax, by - ay) * 1.25 + 30);
        break;
      case 'drive':
        // a loose, slack cable from PKT's hand to the platform port; purely cosmetic
        ax = this.driven!.x; ay = this.driven!.y;
        bx = this.handX; by = this.handY;
        this.handEnd = 'b';
        len = Math.hypot(bx - ax, by - ay) * 1.3 + 40;
        break;
      case 'placed':
        ax = this.source!.x; ay = this.source!.y;
        bx = this.consumer!.x; by = this.consumer!.y;
        this.handEnd = null;
        len = Math.hypot(bx - ax, by - ay) * 1.12 + 24;
        break;
      case 'shoot':
        if (this.source) { ax = this.source.x; ay = this.source.y; this.handEnd = null; }
        len = Math.hypot(bx - ax, by - ay) * 1.03;
        break;
      default:
        len = Math.hypot(bx - ax, by - ay) * 1.02;
    }
    this.rope.step(dt, ax, ay, bx, by, len, 1400, 8);
  }

  /** Draw: pixel-chunky near PKT, smooth glowing tube further away. */
  render(w: GameScene): void {
    const gP = this.gPix, gS = this.gSmooth;
    gP.clear();
    gS.clear();
    this.reticle.clear();
    const n = this.rope.count;
    const xs = this.rope.xs, ys = this.rope.ys;
    if (w.player.dead) { this.plugPix.setVisible(false); return; }

    // distance from PKT's end along the rope
    const order: number[] = [];
    if (this.handEnd === 'b') for (let i = n - 1; i >= 0; i--) order.push(i);
    else for (let i = 0; i < n; i++) order.push(i);
    const dist = new Float32Array(n);
    let acc = 0;
    for (let k = 1; k < n; k++) {
      acc += Math.hypot(xs[order[k]] - xs[order[k - 1]], ys[order[k]] - ys[order[k - 1]]);
      dist[k] = acc;
    }
    const pixLen = this.handEnd === null ? 0 : PIXEL_LEN;
    const live = this.live;

    // smooth part (world camera, perceived)
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k < n; k++) if (dist[k] >= pixLen - 8) pts.push({ x: xs[order[k]], y: ys[order[k]] });
    if (pts.length >= 2) {
      if (live) {
        gS.lineStyle(16, 0x30ff7a, 0.18);
        gS.strokePoints(pts, false);
      }
      gS.lineStyle(7, 0x0b2a8a, 1);
      gS.strokePoints(pts, false);
      gS.lineStyle(4, 0x2f6dff, 1);
      gS.strokePoints(pts, false);
      gS.lineStyle(1.5, 0xa8d4ff, 0.9);
      gS.strokePoints(pts.map((p) => ({ x: p.x - 1, y: p.y - 1 })), false);
      if (live) {
        const total = acc;
        for (let j = 0; j < 4; j++) {
          const target = ((this.pulse * 120 + (j * total) / 4) % Math.max(1, total));
          for (let k = 1; k < n; k++) {
            if (dist[k] >= target) {
              const f = (target - dist[k - 1]) / Math.max(0.001, dist[k] - dist[k - 1]);
              const x = xs[order[k - 1]] + (xs[order[k]] - xs[order[k - 1]]) * f;
              const y = ys[order[k - 1]] + (ys[order[k]] - ys[order[k - 1]]) * f;
              gS.fillStyle(0xb8ffcc, 1);
              gS.fillCircle(x, y, 4);
              break;
            }
          }
        }
      }
    }

    // pixel part (hero camera, unfiltered)
    if (pixLen > 0) {
      const G = 3;
      for (let k = 1; k < n && dist[k - 1] < pixLen; k++) {
        const x0 = xs[order[k - 1]], y0 = ys[order[k - 1]], x1 = xs[order[k]], y1 = ys[order[k]];
        const segLen = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(segLen / G));
        for (let s = 0; s <= steps; s++) {
          const dAlong = dist[k - 1] + (segLen * s) / steps;
          if (dAlong > pixLen) break;
          const x = Math.round((x0 + ((x1 - x0) * s) / steps) / G) * G;
          const y = Math.round((y0 + ((y1 - y0) * s) / steps) / G) * G;
          gP.fillStyle(0x0a0d24, 1);
          const o = 9;
          gP.fillRect(x - o / 2, y - o / 2, o, o);
        }
        for (let s = 0; s <= steps; s++) {
          const dAlong = dist[k - 1] + (segLen * s) / steps;
          if (dAlong > pixLen) break;
          const x = Math.round((x0 + ((x1 - x0) * s) / steps) / G) * G;
          const y = Math.round((y0 + ((y1 - y0) * s) / steps) / G) * G;
          gP.fillStyle(live ? 0x3aff8a : 0x2f6dff, 1);
          gP.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }

    // plug at the tip
    const tipIdx = this.handEnd === 'b' ? 0 : n - 1;
    const prevIdx = this.handEnd === 'b' ? 1 : n - 2;
    const tx = xs[tipIdx], ty = ys[tipIdx];
    const ang = Math.atan2(ty - ys[prevIdx], tx - xs[prevIdx]);
    const tipPixel = this.handEnd !== null && dist[n - 1] < pixLen + 4;
    this.plugPix.setVisible(tipPixel);
    if (tipPixel) this.plugPix.setPosition(Math.round(tx / 3) * 3, Math.round(ty / 3) * 3).setRotation(Math.round(ang / (Math.PI / 4)) * (Math.PI / 4));
    else {
      const c = Math.cos(ang), s = Math.sin(ang);
      const quad = (l: number, wdt: number, ox: number) => [
        { x: tx + c * ox - s * -wdt, y: ty + s * ox + c * -wdt },
        { x: tx + c * (ox + l) - s * -wdt, y: ty + s * (ox + l) + c * -wdt },
        { x: tx + c * (ox + l) - s * wdt, y: ty + s * (ox + l) + c * wdt },
        { x: tx + c * ox - s * wdt, y: ty + s * ox + c * wdt },
      ];
      gS.fillStyle(0xe8f0ff, 0.95);
      gS.fillPoints(quad(14, 6, -6), true);
      gS.fillStyle(0xffd23f, 1);
      gS.fillPoints(quad(4, 4, 6), true);
    }

    // reticle on the current jack target (PKT's HUD, pixel style)
    const tg = this.aimTarget;
    if (tg && (this.state === 'idle' || this.state === 'retract' || this.state === 'tether')) {
      const color = tg.kind === 'port' ? tg.port.color : 0xff4a4a;
      const r = 26 + Math.sin(w.simTime * 10) * 2;
      this.reticle.lineStyle(3, color, 1);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = Math.round((tg.x + sx * r) / 3) * 3, cy = Math.round((tg.y + sy * r) / 3) * 3;
        this.reticle.lineBetween(cx, cy, cx - sx * 9, cy);
        this.reticle.lineBetween(cx, cy, cx, cy - sy * 9);
      }
    }
  }
}
