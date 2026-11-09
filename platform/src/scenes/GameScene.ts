import Phaser from 'phaser';
import { T } from '../config/tuning';
import { Audio } from '../core/Audio';
import { InputMap, readPad } from '../core/Input';
import { Juice } from '../core/Juice';
import { CurrentArcs } from '../gameplay/Current';
import { Chip, Slot } from '../gameplay/Items';
import { Packet } from '../gameplay/Packet';
import { DARK, HUES, LENS_COLOR, LENS_TINT, WHITE_DRAIN, isHue, ownedHues, sightFor, whiteAvailable, zoneAt, type Hue, type Lens } from '../gameplay/Colours';
import { makeHeroTexture, STRIPE_TEXELS } from '../render/PixelHero';
import { FOCI, generatedLevel } from '../gameplay/RoomGen';
import { Save } from '../core/Save';
import { hasAbility } from '../gameplay/Abilities';
import { Controls, type Action } from '../core/Bindings';
import { Cable } from '../gameplay/Cable';
import { Exit, Gate, Lift, Port, Terminal } from '../gameplay/Devices';
import { depenetrate, overlaps, raycast, type Rect, type Solid } from '../gameplay/physics';
import { Player } from '../gameplay/Player';
import { PowerGraph } from '../gameplay/PowerGraph';
import { buildGeometry, LEVELS, type LevelDef, type RoomDef } from '../gameplay/RoomData';
import { IntroCutscene } from '../render/IntroCutscene';
import { Fx } from '../render/Fx';
import { CityDressing } from '../render/CityDressing';
import { Perception, pushLight } from '../render/PerceptionPipeline';
import { FRAMES, HERO_SCALE, HERO_W, HERO_H } from '../render/PixelHero';
import { Reaction, type ReactionKind } from '../render/Reaction';
import { bakeTerrain, neonBlockTexture, TERRAIN_TEXEL, trueLedgeTexture } from '../render/Textures';
import { PauseMenu } from '../ui/PauseMenu';
import { Hud } from '../ui/Hud';

export interface GameData {
  level?: number;
  room?: number;
  deaths?: number;
  runTime?: number;
  /** Play the opening cutscene before the room starts (a fresh start of Level 1). */
  intro?: boolean;
  /** Restarting after a death: skip the room title and come back fast. */
  respawn?: boolean;
}

/** The trip between devices, played when a stage starts fresh. */
const VIEW_W = 1280;
const VIEW_H = 720;

/** One room of Lowtown Grid. Restarted on room change and on death. */
export class GameScene extends Phaser.Scene {
  readonly tile = T.tile;
  levelIndex = 1;
  level!: LevelDef;
  roomIndex = 0;
  room!: RoomDef;
  roomW = 0;
  roomH = 0;
  solids: Solid[] = [];
  hazards: Rect[] = [];
  private neonSolids: Solid[] = [];
  private trueSolids: Solid[] = [];
  /** Secret walls, and their art drawn over the terrain. */
  private secretSolids: Solid[] = [];
  private secretImg: Phaser.GameObjects.Image | null = null;
  private chips: Chip[] = [];
  private slots: Slot[] = [];
  private neonImgs: Phaser.GameObjects.Image[] = [];
  private trueImgs: Phaser.GameObjects.Image[] = [];
  power!: PowerGraph;
  player!: Player;
  cable!: Cable;
  ports: Port[] = [];
  private gates: Gate[] = [];
  private lifts: Lift[] = [];
  private terminals: Terminal[] = [];
  private packets: Packet[] = [];
  private currentArcs: CurrentArcs | null = null;
  /** Brightness of the world, rising after a colour comes back. */
  private sightLevel = 1;
  private bgMatrix: Phaser.FX.ColorMatrix | null = null;
  /** Colours Pix has back. */
  owned: Hue[] = [];
  /**
   * Hard mode: a colour is only real while the lens is held in its zone, on the lens budget.
   * Normal mode: Pix sees a colour automatically inside its zone, and there's no budget.
   */
  hard = false;
  /** Normal mode: the colour zone Pix is in right now, if he has that colour. */
  private zoneHue: Hue | null = null;
  /** Normal mode: how far each colour's ledges have faded in. */
  private zoneShow: Record<Hue, number> = { blue: 0, green: 0, red: 0 };
  /** Colour picked up when the lens was pressed; kept while held (null = lens off). */
  lens: Lens | null = null;
  private lensHeld = false;
  /** The lens colour the view is showing, kept through the fade-out. */
  private viewLens: Lens = 'white';
  private fizzleQuip = 0;
  /** Pix's stripe of the zone colour he's standing in, glowing over the sprite. */
  private stripeGlow!: Phaser.GameObjects.Sprite;
  private glowAmt = 0;
  /** Beat flashes drawn over the glowing stripe. */
  private gSpark!: Phaser.GameObjects.Graphics;
  private beatPhase = 0;
  private beatBurst = 0;
  private beatHue: Hue | null = null;
  private exit: Exit | null = null;
  /** Freezes the simulation while it runs; `update` returns false when finished. */
  cutscene: { update(dt: number, skip: boolean): boolean } | null = null;
  fx!: Fx;
  juice!: Juice;
  hud!: Hud;
  private inputMap!: InputMap;
  private playIntro = false;
  private respawning = false;
  heroSprite!: Phaser.GameObjects.Sprite;
  private heroShadow!: Phaser.GameObjects.Graphics;
  private reaction!: Reaction;
  private idleT = 0;
  private heroCam!: Phaser.Cameras.Scene2D.Camera;
  private bgCam!: Phaser.Cameras.Scene2D.Camera;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private city!: CityDressing;
  recal = 0;
  recalEnergy = T.recalibrate.maxEnergy;
  recalLocked = false;
  private trueView = false;
  /** True while the player holds true view. */
  get seeingTrue(): boolean { return this.trueView; }
  simTime = 0;
  runTime = 0;
  deaths = 0;
  private acc = 0;
  /** True once the player has reached the exit and the room is fading out. */
  transitioning = false;
  private paused = false;
  private pauseMenu!: PauseMenu;
  /** Last pad direction on the pause menu, so a held stick moves one row. */
  private pausePadY = 0;
  private skipKey = false;
  private camX = 0;
  private camY = 0;
  /** Camera lead, eased toward where Pix is heading. */
  private lookX = 0;
  private lookY = 0;

  constructor() {
    super('game');
  }

  init(data: GameData): void {
    const params = new URLSearchParams(window.location.search);
    const ql = params.get('level');
    const qr = params.get('room');
    this.levelIndex = Phaser.Math.Clamp(data.level ?? (ql ? parseInt(ql, 10) : 1), 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    const gen = params.get('gen');
    if (gen !== null) {
      // dev: play generated drafts; the level index still decides which abilities are unlocked
      const pick = <T extends string>(k: string, ok: readonly T[]) => (ok.includes(params.get(k) as T) ? (params.get(k) as T) : undefined);
      // ?stage=N plays with that stage's moves and colours, and drafts the whole stage when no focus is given
      const stage = params.get('stage') !== null ? Phaser.Math.Clamp(parseInt(params.get('stage')!, 10) || 1, 0, 8) : undefined;
      if (stage !== undefined) this.levelIndex = stage;
      this.level = generatedLevel({ seed: Number(gen) || 1, stage, focus: pick('focus', FOCI), difficulty: pick('diff', ['1', '2', '3'] as const) ? (Number(params.get('diff')) as 1 | 2 | 3) : undefined, flow: pick('flow', ['right', 'up'] as const), hue: pick('hue', HUES) });
    }
    this.roomIndex = Phaser.Math.Clamp(data.room ?? (qr ? parseInt(qr, 10) - 1 : 0), 0, this.level.rooms.length - 1);
    this.deaths = data.deaths ?? 0;
    this.playIntro = data.intro === true;
    this.respawning = data.respawn === true;
    this.runTime = data.runTime ?? 0;
    this.ports = [];
    this.gates = [];
    this.lifts = [];
    this.terminals = [];
    this.packets = [];
    this.chips = [];
    this.slots = [];
    this.secretSolids = [];
    this.secretImg = null;
    this.bgMatrix = null;
    this.lens = null;
    this.lensHeld = false;
    this.hard = Save.hard;
    this.zoneHue = null;
    this.zoneShow = { blue: 0, green: 0, red: 0 };
    this.neonImgs = [];
    this.trueImgs = [];
    this.exit = null;
    this.cutscene = null;
    this.transitioning = false;
    this.paused = false;
    this.recal = 0;
    this.recalEnergy = T.recalibrate.maxEnergy;
    this.recalLocked = false;
    this.trueView = false;
    this.acc = 0;
    this.simTime = 0;
  }

  // camera routing: world objects are perceived, hero objects are not
  addWorld<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.bgCam.ignore(o);
    this.heroCam.ignore(o);
    this.uiCam.ignore(o);
    return o;
  }

  /** Soft, unsnapped backdrop behind the lit world (the depth-of-field layer). */
  addBg<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.cameras.main.ignore(o);
    this.heroCam.ignore(o);
    this.uiCam.ignore(o);
    return o;
  }

  addHero<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.bgCam.ignore(o);
    this.cameras.main.ignore(o);
    this.uiCam.ignore(o);
    return o;
  }

  addUi<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.bgCam.ignore(o);
    this.cameras.main.ignore(o);
    this.heroCam.ignore(o);
    return o;
  }

  create(): void {
    const t = this.tile;
    this.room = this.level.rooms[this.roomIndex];
    this.roomW = this.room.width * t;
    this.roomH = this.room.height * t;

    const main = this.cameras.main;
    main.transparent = true;
    main.setPostPipeline('Perception');
    this.bgCam = this.cameras.add(0, 0, VIEW_W, VIEW_H).setBackgroundColor(0x05071a);
    const cams = this.cameras.cameras;
    cams.splice(cams.indexOf(this.bgCam), 1);
    cams.unshift(this.bgCam);
    this.heroCam = this.cameras.add(0, 0, VIEW_W, VIEW_H);
    this.uiCam = this.cameras.add(0, 0, VIEW_W, VIEW_H);

    // geometry
    const geo = buildGeometry(this.room, t);
    this.solids = geo.solids;
    this.hazards = geo.hazards;
    this.neonSolids = geo.neon;
    this.trueSolids = geo.truth;
    this.secretSolids = geo.secret;
    this.power = new PowerGraph(T.power);

    // backdrop
    this.city = new CityDressing(this, this.room, this.level.device);

    // terrain
    this.addWorld(this.add.image(0, 0, bakeTerrain(this, this.room, t)).setOrigin(0).setScale(TERRAIN_TEXEL).setDepth(0));
    // secret walls get the same board art, on top, so they can fade in true view
    this.secretImg = this.room.secret?.length
      ? this.addWorld(this.add.image(0, 0, bakeTerrain(this, { ...this.room, id: `${this.room.id}_secret`, solids: this.room.secret, oneway: [], spikes: [], neon: [], true: [], trueColor: [], entities: [] }, t)).setOrigin(0).setScale(TERRAIN_TEXEL).setDepth(0.1))
      : null;
    for (const s of this.neonSolids) this.neonImgs.push(this.addWorld(this.add.image(s.x - 10, s.y - 10, neonBlockTexture(this, s.w, s.h)).setOrigin(0).setDepth(1)));
    this.trueSolids.forEach((s, i) => this.trueImgs.push(this.addWorld(this.add.image(s.x, s.y, trueLedgeTexture(this, s.w, s.h, i + 3)).setOrigin(0).setDepth(1)
      .setTint(LENS_COLOR[(s.color as Hue) ?? 'blue']))));
    // lens colour zones: a faint wash and a dashed edge, so you know where a colour can be picked up
    const gz = this.addWorld(this.add.graphics().setDepth(0.6));
    for (const z of this.room.zones ?? []) {
      const c = LENS_COLOR[z.color], zx = z.x * t, zy = z.y * t, zw = z.w * t, zh = z.h * t;
      gz.fillStyle(c, 0.05).fillRect(zx, zy, zw, zh);
      gz.fillStyle(c, 0.35);
      for (let x = zx; x < zx + zw; x += 24) { gz.fillRect(x, zy, 12, 3); gz.fillRect(x, zy + zh - 3, 12, 3); }
      for (let y = zy; y < zy + zh; y += 24) { gz.fillRect(zx, y, 3, 12); gz.fillRect(zx + zw - 3, y, 3, 12); }
    }

    // Pix's stripes: lit for colours it has back, hollow for the rest
    // the story remembers the furthest room reached, for Load Game (replaying an earlier room doesn't move it back)
    if (this.levelIndex >= 1 && this.level.id !== 'gen') {
      const p = Save.progress;
      if (!p || this.levelIndex > p.level || (this.levelIndex === p.level && this.roomIndex > p.room)) Save.setProgress(this.levelIndex, this.roomIndex);
    }
    this.owned = this.level.id === 'gen' ? [...HUES] : ownedHues(this.level, this.levelIndex, this.roomIndex);
    this.rebuildHero();
    this.sightLevel = sightFor(this.owned).level;

    // player first (systems reference it)
    const [sx, sy] = this.room.spawn;
    this.player = new Player((sx + 0.5) * t, (sy + 1) * t);

    this.juice = new Juice();
    this.fx = new Fx(this);

    // entities
    for (const e of this.room.entities) {
      switch (e.type) {
        case 'anchor':
        case 'pull':
        case 'source':
        case 'consumer':
        case 'capacitor':
        case 'connector':
        case 'yank':
        case 'data': {
          if (e.id) this.power.add(e.id, e.type === 'data' || e.type === 'yank' ? 'toggle' : (e.type as 'source' | 'consumer' | 'capacitor'), false, e.hold);
          this.ports.push(new Port(this, e));
          break;
        }
        case 'gate': this.gates.push(new Gate(this, e)); break;
        case 'lift':
        case 'slider': {
          const lift = new Lift(this, e);
          this.lifts.push(lift);
          // a yankable slider carries its own port; make it jackable (it updates itself)
          if (lift.port) this.ports.push(lift.port);
          break;
        }
        case 'chip': this.chips.push(new Chip(this, e)); break;
        case 'slot': this.slots.push(new Slot(this, e)); break;
        case 'terminal': this.terminals.push(new Terminal(this, this.modeText(e.text ?? ''), e)); break;
        case 'packet': this.packets.push(new Packet(this, e)); break;
      }
    }
    if (this.room.exit[2] > 0) this.exit = new Exit(this, this.room.exit);
    this.currentArcs = new CurrentArcs(this);

    this.heroShadow = this.addHero(this.add.graphics().setDepth(47));
    this.heroSprite = this.addHero(this.add.sprite(0, 0, 'pkt', 0).setOrigin(0.5, 1).setScale(HERO_SCALE).setDepth(48));
    this.stripeGlow = this.addHero(this.add.sprite(0, 0, 'pkt_glow_blue', 0).setOrigin(0.5, 1).setScale(HERO_SCALE).setDepth(48.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    this.glowAmt = 0;
    this.beatHue = null;
    this.beatBurst = 0;
    this.gSpark = this.addHero(this.add.graphics().setDepth(48.6).setBlendMode(Phaser.BlendModes.ADD));
    this.reaction = new Reaction(this);
    this.addHero(this.reaction.object);
    this.idleT = 0;
    this.cable = new Cable(this);
    this.hud = new Hud(this);
    this.pauseMenu = new PauseMenu(this);
    this.inputMap = new InputMap(this);

    if (!this.respawning) this.showBanner();
    this.hud.fadeAlpha = this.respawning ? 0.6 : 1;
    this.hud.fadeTarget = 0;
    if (this.playIntro) {
      const after = () => {
        this.hud.fadeAlpha = 1;
        this.hud.fadeTarget = 0;
        this.showBanner();
      };
      if (this.levelIndex === 1) this.cutscene = new IntroCutscene(this, after);
    }

    // camera start
    this.lookX = 0;
    this.lookY = 0;
    this.camX = Phaser.Math.Clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, this.roomW - VIEW_W));
    this.camY = Phaser.Math.Clamp(this.player.cy - VIEW_H / 2, 0, Math.max(0, this.roomH - VIEW_H));

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => { if (this.cutscene) this.skipKey = true; });
    kb.on('keydown-M', () => this.toast(Audio.toggleMute() ? 'AUDIO: MUTED' : 'AUDIO: ON'));
    kb.on('keydown-R', () => { if (this.paused) this.restartRoom(); });
    kb.on('keydown-Q', () => { if (this.paused) this.scene.start('title'); });
    kb.on('keydown-K', () => {
      if (!this.paused) return;
      this.scene.pause();
      this.scene.launch('controls', { from: 'game' });
    });
    const onResume = () => {
      this.inputMap.clear();
      if (this.paused) this.showPause();
    };
    this.events.on('resume', onResume);
    this.events.once('shutdown', () => this.events.off('resume', onResume));
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (!this.paused) return;
      if (ev.code === 'ArrowUp' || Controls.has('up', ev.code)) { this.pauseMenu.move(-1); Audio.play('select'); return; }
      if (ev.code === 'ArrowDown' || Controls.has('down', ev.code)) { this.pauseMenu.move(1); Audio.play('select'); return; }
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { this.choosePause(); return; }
      const n = parseInt(ev.key, 10);
      if (n >= 1 && n <= this.level.rooms.length) this.gotoRoom(n - 1);
    });
    Audio.startMusic();
    (window as unknown as { __game: GameScene }).__game = this;
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) this.showPause(); else this.pauseMenu.hide();
    Audio.play('select');
  }

  /** The pause menu's controls reference, for the abilities and mode in play. */
  private pauseHelp(): string {
    const k = (a: Action) => Controls.label(a);
    const lens = this.hard ? (this.owned.length ? `${k('recal')}  LENS` : '') : this.owned.length === 3 ? `${k('recal')}  TRUE VIEW` : '';
    return [
      `${k('left')}/${k('right')}/${k('up')}/${k('down')}  MOVE / AIM     ${k('jump')}  JUMP     ${k('dash')}  DASH     ${k('jack')}  JACK`,
      `${k('jack')} AGAIN  RECALL     ${k('up')}/${k('down')}  REEL     ${k('down')}+${k('jump')}  DROP THROUGH${lens ? `     ${lens}` : ''}`,
      `M  MUTE     PAD: A JUMP  B DASH  RT JACK  LT LENS`,
    ].join('\n');
  }

  private showPause(): void {
    const k = (a: Action) => Controls.label(a);
    this.pauseMenu.show(this.room.name, this.pauseHelp(), `UP/DOWN  CHOOSE     ${k('jump')} / ENTER  SELECT     ${k('pause')}  RESUME`);
  }

  private choosePause(): void {
    switch (this.pauseMenu.choice) {
      case 'resume': this.togglePause(); break;
      case 'restart': this.restartRoom(); break;
      case 'settings':
        Audio.play('select');
        this.scene.pause();
        this.scene.launch('controls', { from: 'game' });
        break;
      case 'quit': this.scene.start('title'); break;
    }
  }

  toast(msg: string, color = 0xffffff): void {
    this.hud?.toast(msg, color);
  }

  /** Pop a reaction bubble over PKT. */
  react(kind: ReactionKind, gap?: number): void {
    if (!this.player.dead) this.reaction.show(kind, gap);
  }

  killPlayer(): void {
    if (this.player.dead) return;
    this.player.dead = true;
    this.deaths++;
    Audio.play('die');
    this.juice.desync(1);
    this.fx.pixelBurst(this.player.cx, this.player.cy, 60, 0x4ff3ff, 420);
    this.fx.pixelBurst(this.player.cx, this.player.cy, 30, 0xff2bd6, 300);
    this.heroSprite.setVisible(false);
    this.stripeGlow.setVisible(false);
    this.reaction.hide();
    this.hud.bigText('CONNECTION RESET\nBY PEER');
    this.time.delayedCall(260, () => { this.hud.fadeTarget = 1; });
    this.time.delayedCall(480, () => this.restartRoom(true));
  }

  restartRoom(respawn = false): void {
    this.scene.restart({ level: this.levelIndex, room: this.roomIndex, deaths: this.deaths, runTime: this.runTime, respawn } satisfies GameData);
  }

  private rebuildHero(): void {
    makeHeroTexture(this, [this.owned.includes('red'), this.owned.includes('green'), this.owned.includes('blue')]);
  }

  /**
   * Pix jacked into a colour connector for the first time: the colour flows
   * down the cable, its stripe lights, and the world fades up in that colour.
   */
  connectColour(hue: string): void {
    if (!isHue(hue) || this.owned.includes(hue)) return;
    this.owned.push(hue);
    Save.addColour(hue);
    const frame = this.heroSprite.frame.name;
    this.rebuildHero();
    this.heroSprite.setTexture('pkt', frame);
    if (this.sightLevel > DARK * 2) this.sightLevel = DARK;
    Audio.play('plug');
    Audio.play('charge');
    this.juice.hitstop(0.2);
    this.juice.shake(6, 0.6);
    const c = LENS_COLOR[hue];
    this.fx.sparkles(this.player.cx, this.player.cy, 30, [c, 0xffffff], 40);
    this.fx.ring(this.player.cx, this.player.cy, c);
    this.juice.hitstop(0.35);
    this.hud.flash(c, 0.7);
    for (let i = 1; i <= 3; i++) this.time.delayedCall(i * 160, () => this.fx.ring(this.player.cx, this.player.cy, c));
    const count = this.owned.length;
    const sub = count === 1 ? 'ONE COLOUR BACK.' : count === 2 ? 'TWO DOWN. ONE TO GO.' : 'ALL THREE. PIX IS WHOLE AGAIN.';
    this.time.delayedCall(700, () => this.hud.bigText(`${hue.toUpperCase()} RESTORED\n${sub}`, c, 3.2));
    const tip = this.hard
      ? count === 3 ? 'ALL THREE. {recal} IS TRUE VIEW NOW: WHITE, EVERYWHERE.' : `HOLD {recal} IN A ${hue.toUpperCase()} ZONE TO SEE HIDDEN ${hue.toUpperCase()} THINGS.`
      : count === 3 ? 'ALL THREE. HOLD {recal} ANYWHERE FOR TRUE VIEW.' : `IN A ${hue.toUpperCase()} ZONE, ${hue.toUpperCase()} LEDGES ARE REAL NOW.`;
    this.time.delayedCall(3200, () => this.toast(tip, c));
  }

  /** World colour and brightness: only the colours Pix has, fading up after a new one. */
  private updateSight(dt: number): void {
    const s = sightFor(this.owned);
    this.sightLevel = Math.min(s.level, this.sightLevel + dt * 0.35);
    Perception.sight = this.sightLevel;
    Perception.sightMix = s.mix;
    Perception.sightTint = s.tint;
    // the soft background camera has no shader of its own; match it with a colour matrix
    if (!this.bgMatrix) this.bgMatrix = this.bgCam.postFX.addColorMatrix();
    const k = this.sightLevel, m = s.mix, L = [0.299, 0.587, 0.114];
    const row = (i: number) => [0, 1, 2].map((j) => k * ((1 - m) * s.tint[i] * L[j] + (i === j ? m : 0)));
    this.bgMatrix.set([...row(0), 0, 0, ...row(1), 0, 0, ...row(2), 0, 0, 0, 0, 0, 1, 0]);
  }

  /** A sign can read differently by mode: `normal text || hard text`. */
  private modeText(text: string): string {
    const i = text.indexOf('||');
    return i < 0 ? text : (this.hard ? text.slice(i + 2) : text.slice(0, i)).trim();
  }

  /**
   * Lens for a press right now: white true view once all three colours are back, wherever
   * Pix is. Before that, in hard mode, the colour of the zone he's in.
   */
  private pickLens(): Lens | null {
    if (whiteAvailable(this.levelIndex, this.owned)) return 'white';
    const p = this.player;
    const z = zoneAt(this.room, Math.floor(p.cx / this.tile), Math.floor(p.cy / this.tile));
    return this.hard && z && this.owned.includes(z) ? z : null;
  }

  /**
   * The stripe's heartbeat. Entering a zone sets off a quick burst of beats, then
   * it settles into a calm lub-dub; while the lens is held the beat speeds up as
   * the lens budget drains. Returns 0..1 for how hard the stripe is lit right now.
   */
  private heartbeat(dt: number, hue: Hue | null): number {
    if (hue && hue !== this.beatHue) this.beatBurst = 0.9;
    this.beatHue = hue;
    if (!hue) return 0;
    this.beatBurst = Math.max(0, this.beatBurst - dt);
    const drain = 1 - this.recalEnergy / T.recalibrate.maxEnergy;
    const rate = this.beatBurst > 0 ? 4 : this.lens ? 1 + drain * 2.2 : 1;
    this.beatPhase = (this.beatPhase + dt * rate) % 1;
    const bump = (c: number, w: number) => Math.exp(-(((this.beatPhase - c) / w) ** 2));
    return this.beatBurst > 0 ? bump(0.15, 0.12) : Math.max(bump(0.1, 0.06), 0.6 * bump(0.32, 0.06));
  }

  /** Flash of the stripe's own pixels on each beat, a lighter shade of its colour. */
  private drawStripeBeat(hue: Hue | null, beat: number): void {
    const g = this.gSpark, spr = this.heroSprite;
    g.clear();
    if (!hue || beat < 0.05 || spr.rotation !== 0) return;
    const k = ({ red: 0, green: 1, blue: 2 } as const)[hue];
    const texels = STRIPE_TEXELS[k][Number(spr.frame.name)] ?? [];
    const sx = spr.scaleX, sy = spr.scaleY, flip = spr.flipX ? -1 : 1;
    g.fillStyle(LENS_COLOR[hue], beat * this.glowAmt * spr.alpha);
    for (const [tx, ty] of texels) {
      g.fillRect(spr.x + flip * (tx + 0.5 - HERO_W / 2) * sx - sx / 2, spr.y - (HERO_H - ty) * sy, sx, sy);
    }
  }

  private showBanner(): void {
    this.hud.banner(this.room.name, this.roomIndex === 0 && this.level.inside ? `${this.level.inside}  //  ${this.room.tagline}` : this.room.tagline);
  }

  /** Lost packets only count once the room is done. */
  private commitPackets(): void {
    Save.addPackets(this.level.id, this.packets.filter((p) => p.taken).map((p) => p.id));
  }

  /** Game over: a fresh run of this level, from its first room, at full health. */
  restartFromBeginning(): void {
    this.hud.fadeTarget = 1;
    this.time.delayedCall(450, () => this.scene.restart({ level: this.levelIndex, room: 0 } satisfies GameData));
  }

  gotoRoom(i: number): void {
    this.scene.restart({ level: this.levelIndex, room: i, deaths: this.deaths, runTime: this.runTime } satisfies GameData);
  }

  nextRoom(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    if (this.levelIndex >= 1 && this.level.id !== 'gen') Save.addCompleted(this.room.id);
    Audio.play('exit');
    this.commitPackets();
    this.hud.fadeTarget = 1;
    this.time.delayedCall(220, () => {
      if (this.roomIndex + 1 >= this.level.rooms.length) this.scene.start('end', { deaths: this.deaths, runTime: this.runTime, level: this.levelIndex });
      else this.gotoRoom(this.roomIndex + 1);
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.inputMap.poll();
    if (this.inputMap.take('pause')) this.togglePause();
    if (this.paused) {
      // the jump button (pad A too) picks; the d-pad or stick moves
      if (this.inputMap.take('jump')) this.choosePause();
      const pad = readPad();
      const py = pad.down(12) || pad.stickY < -0.5 ? -1 : pad.down(13) || pad.stickY > 0.5 ? 1 : 0;
      if (py !== 0 && py !== this.pausePadY) { this.pauseMenu.move(py); Audio.play('select'); }
      this.pausePadY = py;
      this.pauseMenu.update(dt);
      this.hud.update(dt);
      return;
    }
    if (this.cutscene) {
      const skip = this.inputMap.take('jump') || this.skipKey;
      this.skipKey = false;
      this.inputMap.flushFrame();
      const cs = this.cutscene;
      if (!cs.update(dt, skip) && this.cutscene === cs) this.cutscene = null;
      this.renderFrame(dt);
      this.hud.update(dt);
      return;
    }
    const sp = Math.hypot(this.player.vx, this.player.vy);
    this.juice.update(dt, sp);
    let steps = 0;
    if (this.juice.stop <= 0) {
      this.acc += dt;
      const step = T.step;
      while (this.acc >= step && steps < 6) {
        this.simStep(step);
        this.acc -= step;
        steps++;
      }
      if (steps === 6) this.acc = 0;
    }
    if (steps > 0) this.inputMap.flushFrame();
    this.renderFrame(dt);
    this.hud.update(dt);
  }

  private simStep(dt: number): void {
    const p = this.player;
    this.simTime += dt;
    if (!this.transitioning && !p.dead) this.runTime += dt;
    this.fx.beginStep();
    const input = this.inputMap.intent();

    // recalibrate: hold to see the true world, on a limited budget
    const R = T.recalibrate;
    // the lens takes its colour on the press and keeps it until released
    const pressing = input.recalHeld && !p.dead;
    if (pressing && !this.lensHeld) {
      this.lensHeld = true;
      this.lens = this.recalLocked ? null : this.pickLens();
      if (!this.lens && this.owned.length && !this.recalLocked && this.fizzleQuip <= 0) {
        this.toast(this.hard ? 'NO COLOUR TO PICK UP HERE. FIND A ZONE.' : 'TRUE VIEW NEEDS ALL THREE COLOURS.', 0x9ff6ff);
        this.fizzleQuip = 3;
      }
    }
    if (!pressing) { this.lensHeld = false; this.lens = null; }
    const wants = this.lens !== null && !this.recalLocked;
    if (wants) {
      this.viewLens = this.lens!;
      if (this.hard) this.recalEnergy = Math.max(0, this.recalEnergy - dt * (this.lens === 'white' ? WHITE_DRAIN : 1));
      if (this.recalEnergy <= 0) {
        this.recalLocked = true;
        this.lens = null;
        this.toast('PERCEPTION BUFFER OVERFLOW', 0xff6a6a);
        this.juice.desync(0.7);
      }
    } else {
      this.recalEnergy = Math.min(R.maxEnergy, this.recalEnergy + R.regen * dt);
      if (this.recalLocked && this.recalEnergy >= 1.2) this.recalLocked = false;
    }
    const target = wants && !this.recalLocked ? 1 : 0;
    this.recal += (target - this.recal) * Math.min(1, dt * R.blendSpeed);
    if (Math.abs(target - this.recal) < 0.01) this.recal = target;
    const tv = this.recal > 0.5;
    if (tv !== this.trueView) {
      this.trueView = tv;
      Audio.play(tv ? 'recalOn' : 'recalOff');
      if (tv && this.cable.state === 'swing') this.cable.drop(this, 'recal');
    }
    if (!this.hard) {
      const z = zoneAt(this.room, Math.floor(p.cx / this.tile), Math.floor(p.cy / this.tile));
      this.zoneHue = z && this.owned.includes(z) ? z : null;
      for (const h of HUES) this.zoneShow[h] += ((h === this.zoneHue ? 1 : 0) - this.zoneShow[h]) * Math.min(1, dt * 8);
    }
    // which view-dependent blocks are solid right now. One that's due to turn solid while Pix
    // is inside it waits until he's clear, so he's never shoved out through the wall around it.
    const white = tv && this.viewLens === 'white';
    const solidify = (s: Solid, want: boolean) => { s.active = want && (s.active || p.dead || !overlaps(p, s)); };
    for (const s of this.neonSolids) solidify(s, !tv);
    for (const s of this.secretSolids) solidify(s, !white);
    for (const s of this.trueSolids) solidify(s, tv ? this.viewLens === 'white' || s.color === this.viewLens : !this.hard && s.color === this.zoneHue);

    this.cable.preStep(dt, input, this);
    p.update(dt, input, this);
    this.cable.postStep(dt, this);

    if (!p.dead) {
      depenetrate(p, this.solids);
      p.x = Phaser.Math.Clamp(p.x, 0, this.roomW - p.w);
      // a current is instant death, dash or not
      if (this.hazards.some((h) => overlaps(p, h))) {
        Audio.play('hurt');
        this.juice.shake(12, 0.3);
        this.fx.pixelBurst(p.cx, p.cy, 30, 0xffe14a, 340);
        this.killPlayer();
      } else if (p.y > this.roomH + 60) {
        p.respawnSafe();
        this.cable.reset(this);
        this.toast('PACKET LOST. RETRANSMITTING...', 0x9ff6ff);
        this.react('huh');
      }
    }

    for (const g of this.gates) g.update(dt, this);
    for (const l of this.lifts) l.update(dt, this);
    this.power.update(dt);
    for (const port of this.ports) port.update(dt, this);
    let term: string | null = null;
    for (const tm of this.terminals) {
      tm.update(dt);
      if (!term && tm.near(p.cx, p.cy)) term = tm.text;
    }
    this.hud.showTerminal(term);
    for (const pk of this.packets) pk.update(dt, this);
    this.currentArcs?.update(dt, this);
    for (const c of this.chips) c.update(dt, this);
    for (const sl of this.slots) sl.update(dt, this, this.chips);
    this.fizzleQuip = Math.max(0, this.fizzleQuip - dt);
    this.exit?.update(dt, this);
    this.fx.update(dt);
  }

  private heroFrame(): number {
    const p = this.player;
    const c = this.cable;
    const pick = (arr: number[], rate: number) => arr[Math.floor(p.animTime * rate) % arr.length];
    if (p.mode === 'swing') return FRAMES.swing[0];
    if (p.dashing || p.mode === 'zip') return FRAMES.dash[0];
    if (!p.onGround) {
      if (p.wallDir !== 0 && p.vy > 0 && p.wallDir !== p.lastWallDir) return FRAMES.wall[0];
      return p.vy < 0 ? FRAMES.jump[0] : FRAMES.fall[0];
    }
    if (Math.abs(p.vx) > 40) return pick(FRAMES.run, 14);
    return pick(FRAMES.idle, 3);
  }

  /** Pick the brightest nearby light sources for the world shader. */
  private gatherLights(sx: number, sy: number): void {
    Perception.lightCount = 0;
    Perception.lights.fill(0);
    const p = this.player;
    if (!p.dead) pushLight(p.cx, p.y + 22, 170, 0xe0e8ff, 0.75);
    const cx = sx + VIEW_W / 2;
    const cy = sy + VIEW_H / 2;
    const cand: [number, number, number, number, number][] = [];
    const vis = (x: number, y: number, r: number) => Math.abs(x - cx) < VIEW_W / 2 + r && Math.abs(y - cy) < VIEW_H / 2 + r;
    const add = (x: number, y: number, r: number, color: number, k: number) => { if (vis(x, y, r)) cand.push([x, y, r, color, k]); };
    for (const l of this.city.lamps) add(l.x, l.y, l.r, l.color, l.k);
    for (const port of this.ports) add(port.x, port.y, 110, port.color, 0.8 * (1 - this.recal));
    if (this.exit) add(this.exit.zone.x + this.exit.zone.w / 2, this.exit.zone.y + this.exit.zone.h / 2, 220, 0x5ff6ff, 0.9);
    for (const tm of this.terminals) add(tm.x, tm.y, 80, 0x60ffb0, 0.45);
    cand.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    for (const c of cand) if (!pushLight(c[0], c[1], c[2], c[3], c[4])) break;
  }

  private renderFrame(dt: number): void {
    const p = this.player;
    const main = this.cameras.main;

    // camera follow: a gentle lead in the direction of travel, eased so wall-jumps and turns
    // don't swing it; vertically it holds still while Pix is in the air near the middle, and
    // only leans down on a long fall
    this.lookX += (Phaser.Math.Clamp(p.vx * 0.2, -120, 120) - this.lookX) * (1 - Math.exp(-dt * 1.6));
    const falling = p.vy > 500 ? Math.min(120, (p.vy - 500) * 0.3) : 0;
    this.lookY += (falling - this.lookY) * (1 - Math.exp(-dt * 2.5));
    const tx = Phaser.Math.Clamp(p.cx + this.lookX - VIEW_W / 2, 0, Math.max(0, this.roomW - VIEW_W));
    let ty = this.camY;
    const want = p.cy + this.lookY - VIEW_H / 2 - 40;
    if (p.onGround || p.mode !== 'normal' || Math.abs(want - this.camY) > 130) ty = want;
    ty = Phaser.Math.Clamp(ty, 0, Math.max(0, this.roomH - VIEW_H));
    this.camX += (tx - this.camX) * (1 - Math.exp(-dt * 5));
    this.camY += (ty - this.camY) * (1 - Math.exp(-dt * 4));
    const offX = this.roomW < VIEW_W ? -(VIEW_W - this.roomW) / 2 : 0;
    const sx = Math.round(this.camX + offX + this.juice.offsetX);
    const sy = Math.round(this.camY + this.juice.offsetY);
    main.setScroll(sx, sy);
    this.heroCam.setScroll(sx, sy);
    this.bgCam.setScroll(sx, sy);

    this.city.update(dt, sx, sy, this.roomH);

    // PKT
    const spr = this.heroSprite;
    if (!p.dead) {
      spr.setFrame(this.heroFrame());
      spr.setFlipX(p.facing < 0);
      spr.setScale(HERO_SCALE * p.squashX, HERO_SCALE * p.squashY);
      spr.setPosition(Math.round(p.cx), Math.round(p.y + p.h));
      const blink = p.invuln > 0 && !p.dashing && Math.floor(this.simTime * 20) % 2 === 0;
      spr.setAlpha(blink ? 0.35 : 1);
      if (p.mode === 'swing' && this.cable.target) {
        const ang = Math.atan2(p.cy - this.cable.target.y, p.cx - this.cable.target.x) - Math.PI / 2;
        spr.setRotation(Math.round((ang * 0.5) / (Math.PI / 16)) * (Math.PI / 16));
      } else spr.setRotation(0);
      // in a zone of a colour he has, that stripe beats like a heart: the lens can pick it up here
      // while a colour is being carried, its stripe keeps beating outside the zone too
      const zone = zoneAt(this.room, Math.floor(p.cx / this.tile), Math.floor(p.cy / this.tile));
      const carried = this.lens && this.lens !== 'white' ? this.lens : null;
      const live = carried ?? (zone && this.owned.includes(zone) ? zone : null);
      this.glowAmt += ((live ? 1 : 0) - this.glowAmt) * Math.min(1, dt * 6);
      if (live) this.stripeGlow.setTexture(`pkt_glow_${live}`, spr.frame.name);
      const beat = this.heartbeat(dt, live);
      this.stripeGlow.setPosition(spr.x, spr.y).setScale(spr.scaleX, spr.scaleY).setFlipX(spr.flipX).setRotation(spr.rotation)
        .setAlpha(Math.min(1, this.glowAmt * (0.3 + 0.7 * beat)) * spr.alpha).setVisible(this.glowAmt > 0.01);
      this.drawStripeBeat(live, beat);
      const still = p.onGround && Math.abs(p.vx) < 10 && this.cable.state === 'idle';
      this.idleT = still ? this.idleT + dt : 0;
      if (this.idleT > 5) this.react('zzz', 3);
      this.reaction.update(dt, spr.x, spr.y);
    }

    // hard pixel shadow
    const sh = this.heroShadow;
    sh.clear();
    if (!p.dead) {
      const depth = raycast(p.cx, p.y + p.h, p.cx, p.y + p.h + 240, this.solids);
      if (depth < 1) {
        const gy = p.y + p.h + depth * 240;
        const wdt = Math.round((24 * (1 - depth * 0.7)) / 3) * 3;
        sh.fillStyle(0x000000, 0.5 * (1 - depth));
        sh.fillRect(Math.round(p.cx / 3) * 3 - wdt / 2, Math.round(gy / 3) * 3 - 3, wdt, 6);
      }
    }

    // perception uniforms
    Perception.heroX = p.cx - sx;
    Perception.heroY = p.cy - sy;
    Perception.scrollX = sx;
    Perception.scrollY = sy;
    Perception.recal = this.recal;
    Perception.lens = LENS_TINT[this.viewLens];
    this.updateSight(dt);
    Perception.radius = 520;

    for (const img of this.neonImgs) img.setAlpha(1 - this.recal);
    // hidden ledges only show under their own colour (white shows them all)
    this.trueSolids.forEach((s, i) => {
      const lensed = this.viewLens === 'white' || s.color === this.viewLens ? this.recal : 0;
      const shown = this.hard ? lensed : Math.max(lensed, this.zoneShow[s.color as Hue] ?? 0);
      // white ledges are a secret: no ghost outline until true view finds them
      this.trueImgs[i].setAlpha(s.color === 'white' ? shown : 0.05 + shown * 0.95);
    });
    if (this.secretImg) this.secretImg.setAlpha(this.viewLens === 'white' ? 1 - this.recal * 0.8 : 1);

    this.gatherLights(sx, sy);
    this.cable.render(this);
    this.fx.render(main, dt);
  }
}
