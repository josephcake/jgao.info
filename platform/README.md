# DEAD PIXEL

A fast 2D cyberpunk platformer. Pix, one pixel on your monitor, dies, and his
colours scatter down the cable into your home network. Pix knows exactly what
happens to monitors with a dead pixel: they get tossed out, along with his whole
family. So what's left of him, a hollow shell with an ethernet cable, goes after
his colours, fast. Each of the first three
stages gives back a colour (blue, green, red) and a lens that reveals that
colour's hidden ledges; with all three, the white lens shows everything. Then
Pix has to find another way home. There is no attack and there are no bosses:
the cable jacks into ports, swings, zips, carries power and hacks data. The only
thing out to get Pix is the current: live zigzag voltage running along floors and walls. One touch is instant death.
Each level takes place inside a different device, starting with the WiFi modem.

Built with Phaser 3, TypeScript and Vite.

## Run

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

Jump straight into a room with `?level=1&room=3` (rooms are 1-indexed;
level 0 is the training level).

```sh
npx tsc --noEmit     # typecheck
npx vitest run       # unit tests
npm run build        # production build into dist/
npm run build:single # the whole game in one file: dist/dead-pixel.html
```

`dist/dead-pixel.html` is self-contained (code, Phaser, rooms; all art and
sound are generated at runtime). Double-click it to play, or send it to someone.
The only thing it fetches is the pixel font from Google Fonts; offline it falls
back to a plain monospace font.

## Controls

Default keys:

| Key | Action |
|-----|--------|
| Arrows | Move / aim |
| Z (or Space) | Jump (double jump, wall jump) |
| C | Jack into a port (hold to swing) |
| C while the cable is out | Recall the cable |
| V | Dash |
| S | True view (hold) |
| Esc (or P) | Pause |

Every key can be remapped from **CONTROLS** on the title menu, or with K on the
pause screen. Each action gets a main key and a backup; picking a key that's
already in use swaps the two. The layout is saved in the browser. M, R, Q, K,
1-9, Tab and Backspace keep their fixed jobs.

Gamepads work with a fixed layout. A remappable gamepad profile is stored
alongside the keys (`src/core/Bindings.ts`) but isn't wired in yet.

## Where things are

| Path | What |
|------|------|
| `src/` | Game code: `scenes/`, `gameplay/`, `render/`, `ui/`, `core/` |
| `assets/data/` | Room layouts and `tuning.json` (all gameplay numbers) |
| `assets/data/rooms/**/*.room` | Room layouts as text grids (format below) |
| `scripts/gen-room.mjs` | Room generator CLI (`npm run gen:room`) |
| `design/` | Game brief and level design docs |
| `docs/room-design-guide.md` | Room file legend, entity reference, movement budget, checklist |
| `docs/content-authoring-guide.md` | How to build new levels, creatures, bosses and animations |
| `tests/unit/` | Vitest suites |
| `.claude/` | Claude Code Game Studios agent tooling (see `CLAUDE.md`) |

## Rooms

Rooms are text files, one character per 40px tile (`src/gameplay/AsciiRoom.ts`
has the full reference). For the complete legend, entity list, movement budget
and a design checklist, see **[`docs/room-design-guide.md`](docs/room-design-guide.md)**.

```
// a comment
id l1-08
name 1-8 EXAMPLE
tagline one idea per room.
bg city
map
##############################
##..........................EE
##@.?.....o.......BBB.......EE
#######^^^^^^^#######...######
end
text HELLO.\nTERMINAL TEXT, ONE LINE PER ?.
zone blue 0 0 12 4
entity {"type": "gate", "x": 20, "y": 1, "h": 2, "inputs": ["c1"]}
```

`#` wall, `=` plank, `^` spikes, `n` neon (gone under the
lens), `B`/`G`/`R` blue/green/red ledges (only real under that lens), `@` spawn,
`E` exit, `o` anchor, `P` pull port, `*` lost packet, `?`
terminal, `A` AVIAN. `zone` lines mark where the lens picks up a colour: press it
inside a zone to take that colour, keep holding to carry it.

### Generating rooms

The generator drafts a room around one mechanic (introduce, push, twist). A
reachability solver (`src/gameplay/RoomSolver.ts`) then checks that Pix can finish
it, and checks again with the focus mechanic switched off: if the room is still
finishable, the draft is thrown away, so every room really needs what it teaches.

```sh
npm run gen:room -- --focus swing --difficulty 2 --reach          # one room
npm run gen:room -- --check assets/data/rooms/level1/10-slack-line.room   # check a hand-made room
npm run gen:stage -- --stage 2 --seed 11 --candidates 10          # a whole stage
```

Foci: `gap fling zip wall true carry planks swing power capacitor duo`.
`--twist swing` on `capacitor` makes the charge-then-swing room; `--flow up`
builds vertical rooms. Stages come with a profile (`stageProfile`): the generator
refuses mechanics that aren't unlocked yet, and the solver only allows that stage's
moves. `STAGE_PLANS` in `RoomGen.ts` lists the beats of each stage; `gen:stage`
makes several candidates per beat and keeps the one closest to the beat's target
difficulty. Drafts land in `assets/data/rooms/drafts/` to play and edit.

To play drafts straight away open `?gen=42` (or `?gen=42&focus=gap&diff=3&flow=up`),
or `?gen=11&stage=2` for a whole drafted stage with that stage's moves.

The solver is conservative but not a physics simulation, so it can say yes to a
room that plays badly. Check by playing, or let the dev autopilot do it: in a dev
build, `await __bot.level()` in the browser console plays every room of the current
level through the game's own debug input and reports which ones it couldn't finish
(a failure means "go look", since the bot is a crude player).

## Stages

| Stage | Where | New |
|---|---|---|
| 1 | Modem | run, jump, dash (8 ways), wall-jump, zip, the lens (blue), **hack** (data ports open gates), **yank** (tether to a platform's port and drive it); Pix starts hollow, blue comes back in 1-1; practice rooms 1-3 and 1-4 have no current; live current on floors and walls is the hazard; **anchors** (swing) arrive in 1-7, with rails that stop short so you finish the crossing on an anchor or a pull port; **power** and capacitors from 1-10, **green** comes back in 1-11; 15 rooms, no bosses |
| 3 | | red |
| 4 | | white lens, and the way home turns |

Each stage is a folder of numbered `.room` files in `assets/data/rooms/`; the game
reads them in file-name order, so adding a room is adding a file.
