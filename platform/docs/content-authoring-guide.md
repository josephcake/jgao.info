# Content Authoring Guide: levels, creatures, bosses, animation

For the next agent building NULL_ROUTE content. Read this before adding a level,
an enemy, a boss or an animation. It describes how the game is built **today**;
where this guide and the code disagree, the code wins. Fix this guide when that
happens.

NULL_ROUTE is a fast 2D platformer in **Phaser 3 + TypeScript + Vite**. The hero,
PKT, is one RGB pixel armed with an ethernet cable. It travels through home
network hardware, one device per level.

---

## 0. Ground rules

- **Collaboration protocol (CLAUDE.md).** Ask "May I write this to [path]?" and
  show a plan before multi-file changes. Never commit unless the user says so.
  A skipped question is not an answer.
- **The user play-tests, not you.** Spin up the dev server (`npm run dev`, then
  open <http://127.0.0.1:5173>) and hand it over. Screenshots for visual checks
  are fine; don't claim a room "plays well" from a screenshot.
- **Input is keyboard or gamepad only.** The mouse is never an input.
- **Less moving parts.** The user dislikes busy screens. Add motion only when it
  carries information.
- **The gameplay layer stays crisp.** Blur and depth of field are for
  background layers only.

Useful dev hooks (dev build only, see `src/main.ts`):

| Hook | What it does |
|------|--------------|
| `?level=N&room=M` | Boot straight into level N (0 = training, 1 = Level 1), room M (**1-indexed**) |
| `window.__game` | The running `GameScene` (so `__game.textures`, `__game.player`, `__game.react(...)`). Undefined on the title screen |
| `window.__dbg` / `window.__play(seq)` | Scripted input for quick checks |
| In game: `1`–`7` while paused | Jump to a room |

---

## 1. The look (read before drawing anything)

### Cameras (bottom to top)

| Camera | Field | Purpose | Add objects with |
|--------|-------|---------|------------------|
| Background | `bgCam` | Soft, unsnapped parallax: sky, skylines, signs, motes | `w.addBg(obj)` |
| World | `cameras.main` | Terrain, enemies, devices. Runs the **Perception** shader: 3 px pixel grid, point lights, bloom, haze | `w.addWorld(obj)` |
| Hero | `heroCam` | PKT, cable, reaction bubble, **attack FX**. Unfiltered and full resolution | `w.addHero(obj)` |
| UI | `uiCam` | HUD | `w.addUi(obj)` |

Every new game object must go through exactly one `add*` helper. Otherwise all
four cameras render it.

### Hybrid resolution

- **World art is chunky:** a 3 px grid. Draw textures at 1/3 size and show them
  with `.setScale(3)` (see `TERRAIN_TEXEL`, `lampTexture`). Snap positions to 3.
- **Attack FX are fine:** whip trail, sparks, lasers and arcs draw at 1 px
  precision on the hero camera with `BlendModes.ADD` (see `Fx.gWorld` and
  `Fx.gTrans`, and the whip trail in `Cable.render`).
- PKT is 16x20 pixel art at `HERO_SCALE = 3`.

### Lighting (`src/render/PerceptionPipeline.ts`)

- Lights come from `GameScene.gatherLights()`. Each frame it pushes up to
  `MAX_LIGHTS = 10` lights, nearest to the camera centre first:
  `add(x, y, radius, color, intensity)`.
- **Do not raise `MAX_LIGHTS` or add a `break` to the shader loop.** Sixteen
  lights with a `break` caused a multi-second shader compile freeze on Apple GPUs.
- Saturated, bright colours (saturation ≥ 0.55, max ≥ 0.6) skip the lighting and
  glow. Use them for eyes, LEDs, signs and projectiles. Keep bodies desaturated
  so the lights shape them.
- Ambient light and haze are set per room in the `CityDressing` constructor:
  cool night outdoors (`bg: 'city'`), warm red indoors (`bg: 'hall'`).

### Setting: inside the hardware

The "city" is the device seen at packet scale (see `design/brief.md`, *Setting*).

- **Shared board parts** in the far skyline: capacitors, batteries, pin headers,
  chips (`boardPart()` in `CityDressing.ts`).
- **Landmarks unique to the device** in the near skyline (`landmark()`).
- **The sky is the inside of the case:** vent slats at the top, and a status
  light as the "sun".
- **Text hints:** signs mix board labels (`+3V3`, `GND`, `ANT1`) with jokes, and
  terminals crack jokes about the device.

The device route is: modem (Level 1, done), keyboard, mouse, router, printer,
GPU, motherboard (fans, coolant paste).

---

## 2. Making a new level

### 2.1 Register it

`src/gameplay/RoomData.ts`:

```ts
import l2r1 from '../../assets/data/rooms/level2/01-....json';
// ...
{ id: 'level2', name: 'LEVEL 2: <NAME>', tag: '2-', device: 'keyboard', inside: 'INSIDE: KEYBOARD', rooms: [l2r1, ...] as RoomDef[] },
```

Then:

1. Add the device to `export type Device` in `src/render/CityDressing.ts`.
2. Add its landmark slots in `skylineTexture()`. Today only `'modem'` has slots;
   follow that pattern (see 2.4).
3. Add the level index to `MENU` in `src/scenes/TitleScene.ts`.
4. Give it its own line in `src/scenes/EndScene.ts`, which branches on
   `data.level`.
5. Update `tests/unit/rooms.test.ts`, which checks room counts per level and the
   boss in the last room.
6. Write a design doc at `design/levels/level-0N-<name>.md`, modelled on
   `level-01-the-last-mile.md`.

### 2.2 Author rooms with a generator script

Don't hand-edit room JSON. Copy `tools/level1_rooms.py` to
`tools/level2_rooms.py`, change `OUT`, and write rooms with the `room()`,
`term()`, `avian()` and `e()` helpers. Running
`python3 tools/level2_rooms.py --map` writes the JSON and prints an ASCII map of
each room:

```
#  solid      =  one-way      ^  spikes     n  neon-only     t  true-view-only
|  gate       x  breakable    _ / ~  lift start / end      E  exit     @  spawn
o  anchor     P  pull         S source  C consumer  K capacitor  D data  T turret
?  terminal   A  AVIAN NPC    d drone  b bouncer  l leaper  B boss
```

Read every map before showing the user.

### 2.3 Room format and units

Every value is in **tiles**. A tile is 40 px; the screen is 32 x 18 tiles.

| Field | Shape | Notes |
|-------|-------|-------|
| `id`, `name`, `tagline` | strings | `id` must be unique across all levels (`l2-01`). The name shows as `2-1 NAME` |
| `width`, `height` | tiles | At least 32 x 18. Tall and wide are both fine; the camera follows on both axes |
| `bg` | `'city'` or `'hall'` | Outdoor (cool night) or indoor (red-lit) dressing |
| `spawn` | `[x, y]` | PKT's feet land on row `y+1`, which must be solid |
| `exit` | `[x, y, w, h]` | Can sit anywhere, including in a ceiling hatch. Use `[0,0,0,0]` in boss rooms |
| `solids` | `[x, y, w, h][]` | Solid rectangles |
| `oneway` | `[x, y, w][]` | Jump up through, drop down with Down+Z |
| `spikes` | `[x, y, w][]` | Hurt and bounce |
| `neon` / `true` | `[x, y, w, h][]` | Solid only in neon view / only in true view (hold S) |
| `entities` | list | See below |

Entities (`x`, `y` are tile cells):

| `type` | Extra fields | Notes |
|--------|--------------|-------|
| `terminal` | `text` | A joke sign. Keep lines ≤ 42 characters, 3 lines max |
| `avian` | `toX`, `lines[]` | Rival NPC: heckles, then flies off toward `toX` |
| `anchor` / `pull` | — | Swing port (blue) / zip port (green) |
| `source`, `consumer`, `capacitor` | `id`, `hold?` | Power routing; a capacitor holds charge for `hold` seconds |
| `data` | `id`, `needs?` | Hack port. It **toggles**, so the effect stays after unplugging |
| `gate` | `y`, `h`, `inputs[]`, `invert?` | **Vertical only**, one tile wide. Opens when its inputs are on (or off, if inverted) |
| `lift` | `w`, `toY`, `inputs[]` | **Vertical only.** Solid top at row `y`, rises to `toY` while powered |
| `breakable` | `w`, `h`, `hp` | Hacked turrets shoot it once there are no enemies left to target |
| `turret` | `id`, `hack`, `dormant?` | Shoots PKT until its `hack` data port is on. Range 720 px |
| `arena` | `w`, `h`, `lock`, `clear`, `waves[][]` | Locks while waves spawn; `lock`/`clear` are signals for gates |
| `drone` / `bouncer` / `leaper` | — | Any type registered in `makeEnemy` |
| `boss` / `avian_boss` | — | One boss per room |

`validateRoom()` rejects unknown `inputs` and `hack` references and anything out
of bounds. The unit tests run it on every room.

### 2.4 Movement numbers (design rooms to these)

| | Value |
|---|---|
| Jump height | 3.6 tiles (single), about 6.4 with the double jump |
| Safe step | Rise 2–4 tiles, gap 0–3 tiles |
| Run speed | 340 px/s (about 8.5 tiles/s) |
| Jack range (any port) | 400 px = **10 tiles**, measured from PKT's centre to the port centre. Check every port you expect players to reach |
| Whip reach | 175 px, about 4 tiles |
| Tether length (power cable) | 380 px |
| Turret range | 720 px |
| PKT hitbox | 22 x 42 px |
| Falling out of the room | respawn on the last safe ground. Pits are allowed |

### 2.5 Level shape rules from the user

- **Not always a side-scroller.** Mix up, down, sideways and diagonal. Level 1's
  plan is in its design doc; copy that kind of table.
- **Keep the teaching order:** introduce a mechanic, test it, then combine it.
- Seven rooms per level, ending in a boss room, with AVIAN or a new rival
  heckling in most rooms.
- Every level adds one or two **new mechanics or devices** that fit its
  hardware. Keyboard ideas: keys that press down like lifts, Caps Lock toggling
  gates. Mouse ideas: a scroll wheel that spins platforms, clicks that fire
  hazards. Agree the list with the user before coding.

### 2.6 Landmarks for the new device

In `CityDressing.ts`:

1. Add the landmark art to `landmark()`, or better, write a
   `landmarkKeyboard()` function and dispatch on the device.
2. Add slots to `skylineTexture()`: `[[x, kind], ...]` across the 2048 px span.
3. Use the key `cp_near_${device}`.

Landmark rules:

- Use a big, readable silhouette. The near layer is blurred about 2.2x, so details
  under 6 px vanish.
- Keep a few lit windows so it still reads as a city.
- Use one or two neon accents (`#3ff0ff`, `#ff3fa4`, `#ffb347`). Dim large icons:
  the status tower looked too loud at full brightness.
- Push antenna-style blinking lights into `lights`.
- Check the title screen too. It shows the modem skyline (`backdropTextures()`),
  offset with `setTilePosition(1350, 0)` so the WiFi chip's label stays out
  from behind the menu.

---

## 3. Making creatures and monsters

All regular enemies live in `src/gameplay/Enemies.ts` and extend `Enemy`.

### 3.1 Anatomy

```ts
export class Glitchbug extends Enemy {
  readonly flying = false;
  readonly damage = T.enemies.glitchbug.damage;
  private state: 'idle' | 'windup' | 'attack' | 'recover' = 'idle';
  private timer = 0;

  constructor(w: GameScene, cx: number, bottom: number) {
    //        kind         x   y       w   h   hp                          texture
    super(w, 'glitchbug', cx, bottom, 30, 26, T.enemies.glitchbug.hp, 'glitchbug');
  }

  protected think(dt: number, w: GameScene): void {
    // state machine; set this.vx / this.vy, then:
    this.move(dt, w);           // collides with w.solids; flying bodies ignore gravity
  }

  protected render(): void {
    super.render();             // positions the sprite, flash and facing
    // optional: squash, bob or frame swaps
  }
}
```

What the base class gives you:

- **Update loop.** `update()` decrements `stun` and `flash`. While stunned it
  applies gravity and friction; otherwise it calls `think()`. It hurts PKT on
  contact when not stunned and kills the enemy if it falls out of the room.
- **`hit(w, dmg, dirX, heavy)`.** Applies damage, knockback, stun, flash, effects
  and sound. Override it for shields: `Bouncer` blocks hits from the front and
  returns `'blocked'`.
- **`yank(w)`.** Called when PKT jacks the enemy (C): pulls it toward PKT,
  stuns it for 0.6 s and deals 1 damage. Override for creatures that should react
  differently, for example one that drags PKT instead.
- **`die(w)`.** Shows the "DELETED" text, a ★ reaction bubble over PKT, effects
  and a screen shake.

### 3.2 Register it

1. **Stats** go in `assets/data/tuning.json` under `enemies`:
   `"glitchbug": { "hp": 3, "speed": 160, "damage": 1 }`. The type comes from the
   JSON automatically. No magic numbers in code.
2. **Factory:** add a case to `makeEnemy()`. Ground enemies use
   `(ty + 1) * t` as `bottom`; flyers use `(ty + 0.5) * t` as the centre.
3. **Texture:** add it in `makeStaticTextures()` (`src/render/Textures.ts`).
4. If it should appear in arenas, the `waves` entries just use its `type`.

### 3.3 Combat design rules

| Attack | Range | Damage | Role |
|--------|-------|--------|------|
| X whip | ~4 tiles | **2 / 2 / 3** combo (`cable.comboDamage`) | Main damage. Short range, high risk |
| C jack | 10 tiles | 1 plus pull and 0.6 s stun | Setup: pull in, then whip |
| Hacked turret | 720 px | Its own shots | Delegation puzzles |

- At those numbers, 2 HP dies to one whip hit, 4 HP to two, and 7 HP to a full
  combo. Pick HP by intent: fodder 2, bruiser 4–5, elite 6–7.
- Every creature needs a **readable tell before it hurts you**: a windup state
  with shake, flash or sound (`Audio.play('charge')`), lasting about 0.3–0.6 s.
- Every creature should **counter one tool** and be **weak to another**. The
  bouncer blocks frontal whips, so you jack it or hit it from behind. Turrets are
  whip-proof, so you hack them. Pick a role for each new creature.
- Theme creatures to the device. Keyboard ideas: a key-cap crab, a stuck-key
  spammer. Mouse ideas: a dust bunny that rolls and grows. Every creature is a
  joke about computers.

### 3.4 Art for creatures

- **Target style: pixel art on the 3 px world grid.** Draw at 1/3 size with
  `fillRect` on a `makeCanvas`, register with
  `scene.textures.addCanvas(key, c)` and `.setFilter(NEAREST)`, then show it at
  `setScale(3)`. The PKT and lamp code are the reference.
- The existing drone, bouncer, leaper, turret, AVIAN and egg are still
  **old clay renders** (`bakeClay`, `lowPolyPoly`). They are due to be redrawn as
  pixel art; don't copy their style for new creatures.
- Desaturated bodies and one saturated "eye" or LED, so the lighting shader shapes
  the body and the light glows.
- Want the creature to light the scene? Add it to `gatherLights()` with a small
  radius (70–110).

---

## 4. Making bosses

A boss is any class implementing `BossLike` (`src/gameplay/BossLike.ts`). Use
`BeakBoss` (`src/gameplay/Beak.ts`, Level 1's AVIAN SR.) as the template; it is
the newest. Its design is in `design/quick-specs/pigeon-beak-boss-2026-11-06.md`
and its numbers are in the `beak` section of `tuning.json`.

### 4.1 Contract

| Member | Meaning |
|--------|---------|
| `alive`, `phase`, `coreHp`, `maxHp`, `title`, `phaseLabel()` | Shown on the HUD boss bar |
| `coreX`, `coreY` | Where hacked turrets aim, and the boss light position |
| `turretVulnerable` | Hacked turrets may target it (`false` for AVIAN SR.) |
| `wire` (optional) | A `{ bars, max }` meter the boss is attacking, drawn as pips beside the boss bar |
| `hitTest(rect)` / `turretHit(w)` | Friendly projectile collisions |
| `whipTest(x0,y0,x1,y1)` / `whipHit(w, dmg, heavy, pogo)` | Whip collisions. `dmg` comes from **`cable.bossComboDamage`** (1 / 1 / 2), kept separate so boss fights don't shorten when regular whip damage changes |
| `plateTargets()` / `platePos(i)` / `yankPlate(w, i)` | Jackable weak points (C). Return `[]` if none |
| `update(dt, w)` | Everything else |

### 4.2 Hooking it up

1. Write the class, for example `src/gameplay/KeyboardBoss.ts`.
2. Add a case to the entity switch in `GameScene.create`:
   `case 'kb_boss': this.boss = new KeyboardBoss(this, ...); break;`
3. `validateRoom()` in `RoomData.ts` and `tests/unit/rooms.test.ts` (*"has a
   reachable end"*) both list the boss entity types. Add yours to both.
4. Phase signals: a boss can create power signals
   (`w.power.add('phase2', 'signal')`) that gates, turrets (`dormant`) and data
   ports (`needs`) listen to. AVIAN SR. gives each wire port a `wireN_ok`
   signal and switches it off during the port's cooldown.
5. **Reacting to a jack:** a data port toggles its power node when PKT jacks it.
   A boss can watch `w.power.isOn(id)` for changes, as `BeakBoss.pollPorts` does,
   without touching `Cable.ts`.
6. **Cutscenes:** set `w.cutscene` to an object with `update(dt, skip)`. The
   simulation freezes while it returns `true`; Z or Enter skips it, and presses
   made during it are discarded. `src/render/PigeonCutaway.ts` is the example.
7. **Ending:** when the boss dies, call `w.bossDefeated()`, which starts the end
   card after a delay.

### 4.3 Boss design rules

- **Three phases, each testing one of the level's mechanics.** AVIAN SR.:
  timed jacks, then whip-deflecting pecks, then reading feints.
- **Bosses live outside the device, so they are huge.** Show only the part that
  fits in the arena (a beak, a finger, a cursor), and save the full reveal for a
  cutscene.
- Telegraph every attack, and give PKT a safe answer for each one.
- Give it a short `intro` beat and a `dying` beat: hitstop, shake, a quip.
- HP around 18 at boss whip damage. Check that a clean run takes about
  60–120 s.
- The boss **is** the device's personality, and a fan-favourite gag. A
  motherboard boss could be a CPU fan that overheats; a printer boss could jam.
- The boss room is built like any room: walls, a floor, a few one-ways and
  anchors, the boss entity, and `exit: [0,0,0,0]`.

---

## 5. Animation

### 5.1 PKT (the RGB pixel)

Everything is in `src/render/PixelHero.ts`.

- Each frame is a `Pose` in `POSES`:
  - body `w`/`h` (squash and stretch);
  - `lift` (hop height);
  - `lean`;
  - `scan` (bright scanline row);
  - `glow` (per-stripe brightness: red, green, blue);
  - `trail` (colour-fringe ghosts);
  - `flat` (wall), `glitch` (hurt), `dx`.
- `FRAMES` maps states to pose indices. `GameScene.heroFrame()` picks the state
  from player and cable state.
- **To add a frame:**
  1. Append a pose to `POSES`.
  2. Add its index to `FRAMES`.
  3. Pick it in `heroFrame()`.

  The texture rebuilds itself on boot.
- **Rules:**
  - No limbs and no face. PKT shows emotion through squash, glow and reaction
    bubbles.
  - Keep the 16x20 frame and the feet on the bottom row (`origin 0.5, 1`), or the
    cable hand, shadow and bubble drift.
- Runtime squash on landing comes from `player.squashX/Y`; swing tilt comes from
  `renderFrame()`.
- Check a pose by drawing the sheet into the page:
  `window.__game.textures.get('pkt').getSourceImage()` drawn at 4x (in a room,
  not on the title screen).

### 5.2 Reaction bubbles

Bubbles live in `src/render/Reaction.ts`. They are 5-row pixel icons in a small
bubble at 3x scale.

- **Trigger:** `w.react(kind, gap?)` from anywhere. `gap` is the per-icon
  cooldown in seconds. The current triggers:

  | Kind | Trigger |
  |------|---------|
  | `alert` | Hurt |
  | `huh` | Fell out of the room |
  | `sweat` | Hard landing |
  | `note` | Plugged into a port |
  | `heart` | Turret hacked |
  | `star` | Enemy deleted |
  | `dots` | AVIAN talks |
  | `zzz` | Idle for 5 s |

- **New icon:** add it to `ReactionKind` and `ICONS` as rows of `X` and `.`. Up
  to 8 wide works.
- An `alert` can't be overridden for 0.5 s. Use bubbles for character beats, not
  for information the HUD should give.

### 5.3 Creatures and bosses

- Cheap and preferred: transform the sprite in `render()`, such as squash
  (`Drone` buzzes its Y scale), bob, flash, or `setFlipX` for facing.
- Frame animation: build a strip texture like `makeHeroTexture()` does
  (`tex.add(i, 0, x, 0, w, h)`), use `w.add.sprite`, and call `setFrame()` from
  the state machine. Two to four frames per state is plenty.
- **Effects** (`w.fx`):

  | Method | Use |
  |--------|-----|
  | `pixelBurst` | Pixel particles |
  | `sparks` | Fine spark streaks |
  | `ring` | Expanding ring (port plugged, state change) |
  | `laser` | Turret beam |
  | `arc` | Charge arc |
  | `pixelText` | Floating text ("DELETED", "-2") |
  | `clayChunks` | Old clay debris; prefer `pixelBurst` for new pixel art |

- **Game feel** (`w.juice`): `hitstop(s)`, `shake(amp, dur)`, and `desync` /
  `tear` for glitch screen effects.
- **Sound:** `Audio.play(name)`. Sounds are synthesized; add new names to
  `SfxName` and the switch in `src/core/Audio.ts`.

---

## 6. Done checklist

- [ ] `npx tsc --noEmit` is clean.
- [ ] `npx vitest run` is green, with room counts and boss types updated in
      `rooms.test.ts`.
- [ ] Every room's ASCII map has been read. Jumps fit 2.4, and every required
      port is within 10 tiles.
- [ ] Screenshots of an outdoor room, an indoor room, the boss and the title.
- [ ] Docs updated: the level design doc, `design/brief.md` if the setting moved,
      and this guide if a pattern changed.
- [ ] Dev server left running for the user. **No commit** unless asked.

## 7. Known gaps (good first tasks)

- Enemies, turrets, devices, AVIAN and the egg still use the old clay art.
  Redraw them as pixel art (section 3.4).
- `design/brief.md` still pitches the old clay concept below its *Setting*
  section, and the rest of it needs a rewrite.
- Only the modem has landmark buildings. `Device` has one value.
- The training level reuses the modem dressing.
