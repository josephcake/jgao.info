import Phaser from 'phaser';
import { T } from '../config/tuning';
import { Audio } from '../core/Audio';
import { gateTexture, liftTexture, PORT_COLORS } from '../render/Textures';
import { overlaps, type Rect, type Solid } from './physics';
import type { EntityDef } from './RoomData';
import { isHue, LENS_COLOR } from './Colours';
import type { GameScene } from '../scenes/GameScene';

export type PortKind = 'anchor' | 'pull' | 'source' | 'consumer' | 'capacitor' | 'data' | 'connector' | 'yank';

/** Something a yank port rides on and can drag/rip toward Pix. */
export interface Yankable {
  /** Perform the yank. `pixX` is Pix's world x, so the host knows which way to go. */
  yank(pixX: number, w: GameScene): void;
  /** A drivable platform stays tethered (cable held) and follows Pix until recalled. */
  readonly drivable?: boolean;
  /** Called when the cable is recalled, so the host can park / stop. */
  release?(w?: GameScene): void;
}

const rgbInt = (c: number[]) => (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);

/** A socket that speaks PKT's protocol. Only perceptible in neon view. */
export class Port {
  readonly kind: PortKind;
  readonly id?: string;
  get x(): number { return this.px; }
  get y(): number { return this.py; }
  readonly needs?: string;
  readonly color: number;
  /** Colour a connector gives back the first time Pix jacks into it. */
  readonly hue?: string;
  /** Capacitor hold time in seconds. */
  private readonly hold: number;
  private lastTick = -1;
  private sprite: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  /** A colour connector: drawn large and in its colour until it has been used. */
  private connectorHue: number | null = null;
  targeted = 0;
  private t = Math.random() * 10;
  /**
   * An on-object yank port (slider/door) carries its owner here. When jacked, the
   * cable asks the owner to perform the yank toward Pix instead of toggling power.
   */
  owner: Yankable | null = null;
  /** Live position, overridable so an on-object port can ride its moving host. */
  px: number;
  py: number;

  constructor(w: GameScene, def: EntityDef, platformPort = false) {
    this.kind = def.type as PortKind;
    this.id = def.id;
    this.needs = def.needs;
    this.px = (def.x + 0.5) * w.tile;
    this.py = (def.y + 0.5) * w.tile;
    this.hue = def.color;
    this.hold = def.hold ?? T.power.capacitorHold;
    // a colour connector is an ordinary blue anchor port; only its first connection is special;
    // a platform yank port is the anchor+power hybrid socket
    const look = this.kind === 'connector' ? 'anchor' : platformPort ? 'yank_platform' : this.kind;
    this.connectorHue = this.kind === 'connector' && isHue(def.color) ? LENS_COLOR[def.color] : null;
    this.color = this.connectorHue ?? rgbInt(PORT_COLORS[look]);
    // connectors sit on Pix's own layer, so they still glow when the world is dark
    const layer = <O extends Phaser.GameObjects.GameObject>(o: O) => (this.kind === 'connector' ? w.addHero(o) : w.addWorld(o));
    this.halo = layer(w.add.image(this.x, this.y, 'exit').setDepth(4).setScale(0.6, 0.25).setTint(this.color).setBlendMode(Phaser.BlendModes.ADD));
    this.sprite = layer(w.add.image(this.x, this.y, `port_${look}`).setDepth(5));
  }

  usable(w: GameScene): boolean {
    if (w.recal > 0.5) return false;
    if (this.needs && !w.power.isOn(this.needs)) return false;
    return true;
  }

  /** Move an on-object port so it rides its host. */
  moveTo(x: number, y: number): void {
    this.px = x;
    this.py = y;
    this.sprite.setPosition(x, y);
    this.halo.setPosition(x, y);
  }

  update(dt: number, w: GameScene): void {
    this.t += dt;
    const dormant = this.needs && !w.power.isOn(this.needs);
    const a = (1 - w.recal) * (dormant ? 0.25 : 1);
    this.sprite.setAlpha(a);
    this.halo.setAlpha(a * (0.35 + 0.15 * Math.sin(this.t * 3)));
    this.halo.setAngle(90);
    this.targeted = Math.max(0, this.targeted - dt * 4);
    // an unused connector is big, tinted and pulsing; once its colour is back it's just a port
    const fresh = this.connectorHue !== null && !w.owned.includes(this.hue as never);
    const base = fresh ? 1.55 : 1;
    const s = base * (1 + this.targeted * 0.18 + Math.sin(this.t * (fresh ? 6 : 4)) * (fresh ? 0.06 : 0.02));
    this.sprite.setScale(s);
    if (this.connectorHue !== null) {
      if (fresh) this.sprite.setTint(this.connectorHue); else this.sprite.clearTint();
      this.halo.setScale(fresh ? 1.4 : 0.6, fresh ? 0.6 : 0.25);
    }
    if (this.kind === 'capacitor' && this.id) {
      const lvl = w.power.level(this.id);
      const plugged = w.power.isPlugged(this.id);
      if (lvl > 0) w.fx.arc(this.x, this.y, 30, lvl, plugged ? 0x30ff9a : 0x10f0d0, a);
      // discharging: a countdown bar over Pix's head, red and blinking in the last seconds
      if (lvl > 0 && !plugged) {
        const secs = lvl * this.hold, low = secs < 3;
        const p = w.player;
        w.fx.bar(p.cx, p.y - 16, 42, lvl, low ? 0xff4a4a : 0x30ffb0, low && Math.sin(this.t * 20) < 0 ? 0.45 : 1);
        const tick = Math.ceil(secs);
        if (low && tick !== this.lastTick) { this.lastTick = tick; Audio.play('type'); }
      } else this.lastTick = -1;
    }
  }
}

/** A door that slides up into the ceiling when powered. */
export class Gate {
  readonly solid: Solid;
  private open = 0;
  private sprite: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Image;
  private wasPowered = false;
  private readonly top: number;
  private readonly fullH: number;

  constructor(w: GameScene, private def: EntityDef) {
    const t = w.tile;
    const gw = t * 0.8;
    this.top = def.y * t;
    this.fullH = (def.h ?? 3) * t;
    this.solid = { x: def.x * t + (t - gw) / 2, y: this.top, w: gw, h: this.fullH, active: true, tag: 'gate' };
    w.solids.push(this.solid);
    this.sprite = w.addWorld(w.add.image(this.solid.x, this.top, gateTexture(w, gw, this.fullH)).setOrigin(0, 0).setDepth(-2));
    this.light = w.addWorld(w.add.image(this.solid.x + gw / 2, this.top + this.fullH - 10, 'px').setDisplaySize(12, 6).setDepth(-1));
    this.wasPowered = this.powered(w);
    this.open = this.wasPowered ? 1 : 0;
    this.apply();
  }

  private powered(w: GameScene): boolean {
    return w.power.evaluate(this.def.inputs ?? [], 'any', this.def.invert ?? false);
  }

  update(dt: number, w: GameScene): void {
    const p = this.powered(w);
    if (p !== this.wasPowered) {
      Audio.play('gate');
      w.juice.shake(3, 0.2);
      this.wasPowered = p;
    }
    const speed = T.devices.gateSpeed / this.fullH;
    this.open = Phaser.Math.Clamp(this.open + (p ? speed : -speed * 1.6) * dt, 0, 1);
    this.apply();
    this.light.setTint(p ? 0x30ff6a : 0xff2a2a);
  }

  private apply(): void {
    const h = this.fullH * (1 - this.open);
    this.solid.h = Math.max(0, h);
    this.solid.active = h > 4;
    this.sprite.setY(this.top - this.fullH * this.open);
    this.light.setY(this.top + h - 10);
  }
}

/**
 * A platform that travels to (`toX`, `toY`) while its inputs are on, and back when
 * not. A 'slider' is the yankable kind: it runs off a yank port, moves fast and
 * wears orange chevrons.
 */
export class Lift implements Yankable {
  readonly solid: Solid;
  private sprite: Phaser.GameObjects.Image;
  private readonly y0: number;
  private readonly y1: number;
  private readonly x0: number;
  private readonly x1: number;
  private readonly isYankKind: boolean;
  /** A 'pull to me' slider: when yanked, it slides along its rail to stop under Pix. */
  private readonly toPix: boolean;
  /** This slider carries its own yank port — tether to it and drive it, no wiring. */
  private readonly selfYank: boolean;
  /** A self-yank slider stays tethered and follows Pix until recalled. */
  readonly drivable: boolean;
  /** For a self-yank slider: is the cable currently tethered to it. */
  tethered = false;
  /** The on-board yank port, if this slider carries one. */
  readonly port: Port | null;
  private chain: Phaser.GameObjects.Graphics;

  constructor(w: GameScene, private def: EntityDef) {
    const t = w.tile;
    this.y0 = def.y * t;
    this.y1 = (def.toY ?? def.y) * t;
    this.x0 = def.x * t;
    this.x1 = (def.toX ?? def.x) * t;
    this.isYankKind = def.type === 'slider';
    this.toPix = !!def.toPix || !!def.yankable;
    this.selfYank = this.isYankKind && !!def.yankable;
    this.drivable = this.selfYank;
    const lw = (def.w ?? 3) * t;
    this.solid = { x: def.x * t, y: this.y0, w: lw, h: 20, active: true, tag: 'lift', dx: 0, dy: 0 };
    w.solids.push(this.solid);
    this.sprite = w.addWorld(w.add.image(this.solid.x, this.y0, liftTexture(w, lw, this.isYankKind)).setOrigin(0, 0).setDepth(2));
    this.chain = w.addWorld(w.add.graphics().setDepth(-3));
    if (this.selfYank) {
      // the yank port sits on the deck, at the centre (anchor + power hybrid look)
      this.port = new Port(w, { ...def, type: 'yank' }, true);
      this.port.owner = this;
      this.port.moveTo(this.solid.x + this.solid.w / 2, this.solid.y - 6);
    } else {
      this.port = null;
    }
  }

  /** The cable jacked our on-board port: it is now tethered and drivable. */
  yank(_pixX: number, w: GameScene): void {
    this.tethered = true;
    Audio.play('plug');
    w.juice.shake(3, 0.2);
    w.fx.pixelBurst(this.port!.x, this.port!.y, 10, 0xff8a1e, 200);
    w.toast('TETHERED. MOVE TO STEER. X TO LET GO.', 0xff8a1e);
  }

  /** The cable was recalled: park the platform where it is. */
  release(w?: GameScene): void {
    this.tethered = false;
    if (w && w.player.driving === this.solid) w.player.driving = null;
  }

  update(dt: number, w: GameScene): void {
    if (this.selfYank) {
      // tethered and standing on it: left/right drives it and Pix rides. Tethered but off it:
      // it slides along its rail to Pix's column. Released: it parks.
      const p = w.player;
      const lo = Math.min(this.x0, this.x1), hi = Math.max(this.x0, this.x1);
      const atEnd = (p.moveInput > 0 && this.solid.x >= hi - 0.5) || (p.moveInput < 0 && this.solid.x <= lo + 0.5);
      const riding = this.tethered && p.ground === this.solid && !atEnd;
      p.driving = riding ? this.solid : p.driving === this.solid ? null : p.driving;
      let targetX = this.solid.x;
      if (riding) targetX = Phaser.Math.Clamp(this.solid.x + p.moveInput * this.solid.w, lo, hi);
      else if (this.tethered) targetX = Phaser.Math.Clamp(p.cx - this.solid.w / 2, lo, hi);
      const prevX = this.solid.x;
      const step = T.devices.liftSpeed * dt * 2.2;
      this.solid.x = prevX < targetX ? Math.min(prevX + step, targetX) : Math.max(prevX - step, targetX);
      this.solid.dx = this.solid.x - prevX;
      this.solid.dy = 0;
      this.sprite.setPosition(this.solid.x, this.solid.y);
      // keep the port glued to the platform; GameScene's port loop handles its own update()
      this.port!.moveTo(this.solid.x + this.solid.w / 2, this.solid.y - 6);
      this.chain.clear();
      this.chain.lineStyle(3, 0xff8a1e, this.tethered ? 0.6 : 0.35);
      const cy = this.y0 + 10;
      this.chain.lineBetween(this.x0 + this.solid.w / 2, cy, this.x1 + this.solid.w / 2, cy);
      return;
    }
    const p = w.power.evaluate(this.def.inputs ?? []);
    const target = p ? this.y1 : this.y0;
    // a 'pull to me' slider homes to Pix's column when yanked, clamped to its rail
    let targetX = p ? this.x1 : this.x0;
    if (p && this.toPix) {
      const lo = Math.min(this.x0, this.x1), hi = Math.max(this.x0, this.x1);
      targetX = Phaser.Math.Clamp(w.player.cx - this.solid.w / 2, lo, hi);
    }
    const prev = this.solid.y, prevX = this.solid.x;
    const step = T.devices.liftSpeed * dt * (p ? 1 : 1.4) * (this.isYankKind ? 2.2 : 1);
    this.solid.y = prev < target ? Math.min(prev + step, target) : Math.max(prev - step, target);
    this.solid.x = prevX < targetX ? Math.min(prevX + step, targetX) : Math.max(prevX - step, targetX);
    this.solid.dy = this.solid.y - prev;
    this.solid.dx = this.solid.x - prevX;
    this.sprite.setPosition(this.solid.x, this.solid.y);
    this.chain.clear();
    if (this.isYankKind) {
      // a rail along the travel path, so you can see where it will go
      this.chain.lineStyle(3, 0xff8a1e, 0.35);
      const cy = Math.min(this.y0, this.y1) + 10, cy2 = Math.max(this.y0, this.y1) + 10;
      this.chain.lineBetween(this.x0 + this.solid.w / 2, cy, this.x1 + this.solid.w / 2, cy2);
      return;
    }
    this.chain.lineStyle(4, 0x4a4440, 1);
    const top = Math.min(this.y1, this.y0) - 60;
    for (const ox of [16, this.solid.w - 16]) this.chain.lineBetween(this.solid.x + ox, top, this.solid.x + ox, this.solid.y);
  }
}

/** Clay CRT with a witty message. */
export class Terminal {
  readonly x: number;
  readonly y: number;
  private sign: Phaser.GameObjects.Image;
  /** Where the sign hovers, so bobbing stays centred on it. */
  private readonly hoverY: number;
  private t = Math.random() * 5;

  constructor(w: GameScene, readonly text: string, def: EntityDef) {
    this.x = (def.x + 0.5) * w.tile;
    this.y = (def.y + 1) * w.tile;
    // a small floating sign hovering a little above the glyph's tile
    this.hoverY = this.y - w.tile * 0.9;
    this.sign = w.addWorld(w.add.image(this.x, this.hoverY, 'terminal').setOrigin(0.5, 0.5).setDepth(3).setBlendMode(Phaser.BlendModes.ADD));
  }

  near(px: number, py: number): boolean {
    return Math.abs(px - this.x) < 70 && Math.abs(py - this.hoverY) < 90;
  }

  update(dt: number): void {
    this.t += dt;
    // gentle bob + a soft pulse so it reads as a hologram, not a solid screen
    this.sign.setY(this.hoverY + Math.sin(this.t * 1.6) * 3);
    this.sign.setAlpha(0.7 + Math.sin(this.t * 3) * 0.12 + (Math.sin(this.t * 13) > 0.94 ? 0.18 : 0));
  }
}

/** Level exit: a column of light. */
export class Exit {
  readonly zone: Rect;
  private beam: Phaser.GameObjects.Image;
  private t = 0;

  constructor(w: GameScene, r: number[]) {
    const t = w.tile;
    this.zone = { x: r[0] * t, y: r[1] * t, w: r[2] * t, h: r[3] * t };
    this.beam = w.addWorld(
      w.add.image(this.zone.x + this.zone.w / 2, this.zone.y + this.zone.h, 'exit').setOrigin(0.5, 1).setDisplaySize(this.zone.w * 1.2, this.zone.h + 80).setBlendMode(Phaser.BlendModes.ADD).setDepth(6),
    );
  }

  update(dt: number, w: GameScene): void {
    this.t += dt;
    this.beam.setAlpha(0.55 + Math.sin(this.t * 5) * 0.2);
    if (Math.random() < 0.3) w.fx.pixelBurst(this.zone.x + Math.random() * this.zone.w, this.zone.y + this.zone.h, 1, 0x8ff8ff, 60, -160);
    if (overlaps(w.player, this.zone)) w.nextRoom();
  }
}
