import { T } from '../config/tuning';
import type { Intent } from '../core/Input';
import { Audio } from '../core/Audio';
import { groundUnder, moveBody, overlaps, wallBeside, type Body, type Solid } from './physics';
import type { GameScene } from '../scenes/GameScene';

export type PlayerMode = 'normal' | 'swing' | 'zip';

const P = T.player;

function approach(v: number, target: number, amount: number): number {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

/** PKT's body and movement. Cable-driven modes (swing, zip) are integrated here but steered by Cable. */
export class Player implements Body {
  x: number;
  y: number;
  w = P.width;
  h = P.height;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  mode: PlayerMode = 'normal';
  onGround = false;
  ground: Solid | null = null;
  /** A tethered platform Pix is steering: standing on it, left/right drives it instead of walking. */
  driving: Solid | null = null;
  /** Last held horizontal input, read by a platform Pix is driving. */
  moveInput = 0;
  coyote = 0;
  jumpBuffer = 0;
  canDouble = true;
  canAirDash = true;
  dashTime = 0;
  dashCd = 0;
  dashDir = 1;
  /** Dash direction, 8-way and normalised. */
  dashX = 1;
  dashY = 0;
  wallDir: -1 | 0 | 1 = 0;
  lastWallDir: -1 | 0 | 1 = 0;
  wallLock = 0;
  jumpCutDone = true;
  invuln = 0;
  dead = false;
  squashX = 1;
  squashY = 1;
  landedFrom = 0;
  safeX: number;
  safeY: number;
  private safeTimer = 0;
  stepTimer = 0;
  animTime = 0;
  dropTimer = 0;

  constructor(spawnX: number, spawnY: number) {
    this.x = spawnX - this.w / 2;
    this.y = spawnY - this.h;
    this.safeX = this.x;
    this.safeY = this.y;
  }

  get cx(): number { return this.x + this.w / 2; }
  get cy(): number { return this.y + this.h / 2; }
  get dashing(): boolean { return this.dashTime > 0; }

  refreshAir(): void {
    this.canDouble = true;
    this.canAirDash = true;
    this.lastWallDir = 0;
  }

  update(dt: number, input: Intent, w: GameScene): void {
    if (this.dead) return;
    this.animTime += dt;
    this.moveInput = input.move;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.wallLock = Math.max(0, this.wallLock - dt);
    this.squashX += (1 - this.squashX) * Math.min(1, dt * 14);
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 14);

    // ride moving platforms
    if (this.ground && (this.ground.dx || this.ground.dy)) {
      moveBody(this, this.ground.dx ?? 0, 0, w.solids);
      this.y += this.ground.dy ?? 0;
    }

    if (input.move !== 0 && this.mode === 'normal' && this.wallLock <= 0) this.facing = input.move > 0 ? 1 : -1;
    this.jumpBuffer = input.jumpPressed ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);
    if (input.down && input.jumpPressed && this.onGround && this.ground?.oneWay) {
      this.dropTimer = 0.18;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.ground = null;
    }

    if (this.mode === 'normal') this.normalMotion(dt, input, w);
    else if (this.mode === 'swing') this.swingMotion(dt, input);
    // zip: velocity is set by Cable each step

    const prevVy = this.vy;
    const res = moveBody(this, this.vx * dt, this.vy * dt, w.solids, this.dropTimer > 0);
    if (res.hitBottom && this.vy > 0) {
      if (prevVy > 500) {
        this.squashX = 1.3;
        this.squashY = 0.72;
        Audio.play('land');
        w.fx.landDust(this.cx, this.y + this.h, prevVy);
        if (prevVy > 900) w.react('sweat');
      }
      this.vy = 0;
    }
    if (res.hitTop && this.vy < 0) this.vy = 0;
    if (res.hitLeft || res.hitRight) {
      if (this.dashing) this.dashTime = 0;
      this.vx = 0;
    }

    this.ground = this.vy >= 0 ? groundUnder(this, w.solids) : null;
    if (this.dropTimer > 0 && this.ground?.oneWay) this.ground = null;
    const wasGround = this.onGround;
    this.onGround = this.ground !== null && this.mode !== 'zip';
    if (this.onGround) {
      this.coyote = P.coyoteTime;
      this.refreshAir();
      this.jumpCutDone = true;
      if (!wasGround) this.landedFrom = 0;
      this.safeTimer += dt;
      if (this.safeTimer > 0.25 && this.ground?.tag === 'clay' && !(this.ground.dx || this.ground.dy)) {
        const probe = { x: this.x - 30, y: this.y, w: this.w + 60, h: this.h + 10 };
        if (!w.hazards.some((hz) => overlaps(probe, hz))) {
          this.safeX = this.x;
          this.safeY = this.y;
        }
        this.safeTimer = 0;
      }
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }
    this.wallDir = wallBeside(this, -1, w.solids) ? -1 : wallBeside(this, 1, w.solids) ? 1 : 0;

    // footsteps: pixel dust + clay imprints
    if (this.onGround && Math.abs(this.vx) > 80) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.11;
        w.fx.footstep(this.cx - this.facing * 6, this.y + this.h, this.facing);
      }
    }
  }

  private normalMotion(dt: number, input: Intent, w: GameScene): void {
    if (this.dashing) {
      this.dashTime -= dt;
      this.vx = this.dashX * P.dashSpeed;
      this.vy = this.dashY * P.dashSpeed;
      w.fx.afterimage(this);
      if (this.dashTime <= 0) { this.vx *= 0.55; this.vy *= 0.55; }
      return;
    }

    const riding = this.onGround && this.driving !== null && this.ground === this.driving;
    const target = riding ? 0 : input.move * P.runSpeed;
    if (this.wallLock <= 0) {
      if (!this.onGround && Math.abs(this.vx) > P.runSpeed && Math.sign(this.vx) === Math.sign(input.move || this.vx)) {
        this.vx = approach(this.vx, target, P.airFriction * dt);
      } else {
        const accel = this.onGround ? (input.move !== 0 ? P.groundAccel : P.groundFriction) : input.move !== 0 ? P.airAccel : P.airFriction;
        this.vx = approach(this.vx, target, accel * dt);
      }
    }

    // floaty apex: holding jump near the top of the arc, gravity eases off
    const apex = !this.onGround && input.jumpHeld && Math.abs(this.vy) < P.apexSpeed;
    this.vy += P.gravity * (apex ? P.apexGravity : 1) * dt;
    const usableWall = this.wallDir !== 0 && this.wallDir !== this.lastWallDir && !this.onGround;
    // grabbing a wall gives the dash back
    if (this.wallDir !== 0 && !this.onGround) { this.canAirDash = true; this.dashCd = 0; }
    if (usableWall && this.vy > 0 && input.move === this.wallDir) {
      this.vy = Math.min(this.vy, P.wallSlideSpeed);
      if (Math.random() < 0.3) w.fx.pixelBurst(this.cx + this.wallDir * 11, this.y + this.h - 8, 1, 0x9ff6ff, 40);
    }
    this.vy = Math.min(this.vy, P.maxFall);

    // variable jump height
    if (!input.jumpHeld && this.vy < 0 && !this.jumpCutDone) {
      this.vy *= P.jumpCut;
      this.jumpCutDone = true;
    }

    if (this.jumpBuffer > 0) {
      if (this.onGround || this.coyote > 0) {
        this.vy = -P.jumpVelocity;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpCutDone = false;
        this.squashX = 0.75;
        this.squashY = 1.3;
        this.onGround = false;
        Audio.play('jump');
        w.fx.pixelBurst(this.cx, this.y + this.h, 6, 0xbffbff, 90);
      } else if (usableWall) {
        this.vy = -P.wallJumpY;
        this.vx = -this.wallDir * P.wallJumpX;
        this.facing = this.wallDir > 0 ? -1 : 1;
        this.wallLock = P.wallJumpLock;
        this.lastWallDir = this.wallDir;
        this.canAirDash = true;
        this.jumpBuffer = 0;
        this.jumpCutDone = false;
        Audio.play('jump');
        w.fx.pixelBurst(this.cx + this.wallDir * 11, this.cy, 8, 0xbffbff, 120);
      } else if (this.canDouble) {
        this.vy = -P.doubleJumpVelocity;
        this.canDouble = false;
        this.jumpBuffer = 0;
        this.jumpCutDone = false;
        this.squashX = 0.8;
        this.squashY = 1.25;
        Audio.play('djump');
        w.fx.ring(this.cx, this.y + this.h, 0xff2bd6);
      }
    }

    if (input.dashPressed && this.dashCd <= 0 && (this.onGround || this.canAirDash)) {
      // any of 8 directions; no direction held dashes the way Pix faces. On the ground a
      // downward dash would go nowhere, so it flattens to sideways.
      let dx = input.dirX, dy = input.dirY;
      if (this.onGround && dy > 0) dy = 0;
      if (dx === 0 && dy === 0) dx = this.facing;
      const l = Math.hypot(dx, dy);
      this.dashX = dx / l;
      this.dashY = dy / l;
      this.dashDir = dx !== 0 ? Math.sign(dx) : this.facing;
      this.facing = this.dashDir > 0 ? 1 : -1;
      if (dy < 0) this.onGround = false;
      // dashing gives the wall-jump back, even off the wall you just left
      this.lastWallDir = 0;
      this.dashTime = P.dashTime;
      this.dashCd = P.dashCooldown;
      this.invuln = Math.max(this.invuln, P.dashTime + 0.05);
      if (!this.onGround) this.canAirDash = false;
      Audio.play('dash');
    }
  }

  private swingMotion(dt: number, input: Intent): void {
    this.vy += P.gravity * dt;
    this.vx += input.move * T.cable.swingPump * dt;
    if (input.move !== 0) this.facing = input.move > 0 ? 1 : -1;
  }

  /** Return to the last safe ground after a pit or spikes. */
  respawnSafe(): void {
    this.x = this.safeX;
    this.y = this.safeY;
    this.vx = 0;
    this.vy = 0;
    this.mode = 'normal';
    this.dashTime = 0;
  }
}
