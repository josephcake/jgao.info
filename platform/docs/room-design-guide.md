# Room Design Guide & Legend

> **Design rules first.** This guide is the file format. What makes a room good, and
> the rules every room must follow (the RULES header, hardness 1–10, "next room = new
> mechanic or harder") are in **[`docs/level-design-rules.md`](level-design-rules.md)**.
> Read that before authoring. The rules are enforced by `tests/unit/roomRules.test.ts`.

Everything you need to author a DEAD PIXEL room by hand. A room is a plain-text
`.room` file: one character per 40px tile, a few header lines, and a tail of
directives for things that have no glyph.

Where this guide and the code disagree, the code wins — the parser is
`src/gameplay/AsciiRoom.ts` and the reachability solver is
`src/gameplay/RoomSolver.ts`.

Rooms live in `assets/data/rooms/<level>/` and load in **file-name order**, so
number them `01-...`, `02-...`. Check one with:

```
npm run gen:room -- --check assets/data/rooms/level1/04-false-floor.room --reach
```

`--reach` prints the map with every tile the solver can reach marked `+`. If a
tile you expect to stand on is not marked, the room is not finishable that way.

---

## 1. File shape

```
// a comment line (ignored)
id l1-04
name 1-4 FALSE FLOOR
tagline some floors lie. only one of them is real.
bg city
map
##############################
##..........................EE
##@.?.....o.......BBB.......EE
#######^^^^^^^#######...######
end
text HELLO. THIS SHOWS AT THE FIRST ? (reading order).
text SECOND ? GETS THIS LINE.
zone blue 0 0 12 4
entity {"type": "gate", "x": 20, "y": 1, "h": 2, "inputs": ["c1"]}
```

- **Header** (before `map`): `id`, `name`, `tagline`, `bg`. `id` must be unique.
  Then the **RULES** lines `main`, `mechanics`, `new`, `portion` (one per section),
  `hardness` (required, see
  `docs/level-design-rules.md` §1).
- **Map**: everything between `map` and `end`. Each line is a row; the first
  character is tile `x=0`, the first row is `y=0`. `y` grows **downward**.
- **Tail** (after `end`): `text`, `entity`, `zone`, `spawn`, `exit`.
  Any other line is an error.

`bg` is `hall` (indoor: red ambient, no embers) or `city` (outdoor: cool
ambient, parallax skyline). Lens/colour rooms usually read best on `city`.

---

## 2. Glyph legend (things with a character in the map)

| Glyph | Name | What it does |
|:-----:|------|--------------|
| `#` | **Wall / floor** | Solid. Blocks everything. Side walls and a ceiling are the room's frame. |
| `.` | **Air** | Empty. Any unknown character is also treated as air. |
| `=` | **Plank** | One-way platform. Stand on it from above; **hold `down` + `jump` to drop through**. |
| `^` | **Current** | Live voltage: a yellow zigzag of electricity flowing along the surface it runs on. Hazard: **touching it is instant death** and the room resets. It runs along whatever it touches: put `^` on a floor, against a wall, or under a ceiling (the floor wins if a tile touches several). On a floor it sits in the lower half of its tile, so a one-tile notch with `^` in it is a pit. Keep it out of practice rooms. |
| `n` | **Neon block** | Solid normally; **vanishes under the lens** (hard mode) or **white true view** (both modes). A decoy / timed gap. |
| `B` | **Blue ledge** | Real only in blue. **Normal mode:** solid and shown while Pix is inside a blue zone. **Hard mode:** only while the blue lens is held. White true view shows them all. (`t` is an alias for `B`.) |
| `G` | **Green ledge** | As `B`, for green. |
| `R` | **Red ledge** | As `B`, for red. |
| `W` | **White ledge** | A secret: invisible and not solid until **white true view** is on. Use it for hidden, easier paths. Needs no zone. |
| `H` | **Secret wall** | Looks and acts like `#`, but white true view sees through it (it fades and goes non-solid). Use it to hide rooms and items. |
| `@` | **Spawn** | Where Pix starts / respawns. Exactly one per room. |
| `E` | **Exit** | Exit zone. Use a rectangle of `E` (e.g. 2 wide × 4 tall); the parser bounds them into one zone. |
| `o` | **Anchor port** | **Blue.** You can **hold** it: tap `jack` to zip to it, or hold to swing from it (once swing is unlocked). |
| `P` | **Instant pull port** | **Yellow.** **Cannot be held.** Tap `jack` aimed at it and it **reels Pix straight to it** — the "fling up". |
| `*` | **Packet** | Optional collectible. Nice-to-reach, never required. |
| `?` | **Terminal** | A small **floating** readable sign — a hovering glyph, no post or housing. Each `?` consumes one `text` line (see §4). **Use one per new mechanic**, not one per beat. |

> Neon vs. coloured ledges: **neon disappears** under a lens; a **coloured ledge
> appears** under *its* lens. They are opposites — pair them to teach the lens.

---

## 3. Entities (no glyph — written as `entity {json}` in the tail)

All entities share `type`, `x`, `y` (tile coordinates). Optional fields below.
Ports that other things react to need an `id`; the reactor lists that id in its
`inputs`.

### Ports, by colour and feel

Every port is a glowing socket you aim `jack` at. What it does — and whether you
can **hold** it — is read off its colour:

| Port | `type` | Colour | Hold? | What it does |
|------|--------|--------|:-----:|--------------|
| **Instant pull** | `pull` (glyph `P`) | **Yellow** | **No** | A single tap reels Pix straight to it — the "fling up/over". Released immediately; you can't hang on it. |
| **Anchor** | `anchor` (glyph `o`) | **Blue** | **Yes** | Tap to zip to it; **hold** to hang and swing from it (swinging unlocks at 1-7). |
| **Platform (yank)** | `slider` + `yankable` | **Blue + teal** (anchor + power) | **Yes** | The port rides **on the platform itself**. Jack it to **tether** (anchor) and **charge** (power) the platform in one move: while tethered it comes alive and **follows Pix along its rail** — stand on it, jump, hang off, it stays connected. Press **X** (`jack`/recall) to let go; it **parks** where it is. Needs the **yank** ability. |
| **Charge / power / hack** | `data` | **Magenta** | tap | The hack port: tap to flip anything wired to its `id` (a gate stays flipped). Needs the **hack** ability. |
| **Link (power in)** | `source` | **Green** | plug | Where power comes *from*. Plug a cable here to send power down its `inputs`. |
| **Link (power out)** | `consumer` | **Green** | plug | Where power goes *to*. Driven while a `source` feeds it. |
| **Link (stored power)** | `capacitor` | **Teal** | plug | Holds charge for `hold` seconds after you plug it, then drains. A **teal-on-black** glow that fades as the charge runs out signals the power is about to go. |
| **Colour pickup** | `connector` | lens colour | tap | Big and pulsing in its colour until used; the first jack grants that lens colour, then it acts as a plain anchor. |

> **Link ports are the power network.** `source` → `consumer`/`capacitor` are the
> teal/green "link" family: you run a cable from one to another to route power to
> a `gate` or `lift`. An unfed link reads as dim teal-on-black — that black-and-teal
> "signal lost" look is your cue that the power chain is incomplete.

### Full entity table

| `type` | Extra fields | What it is |
|--------|--------------|------------|
| `terminal` | `text` | A small **floating** sign that hovers in place (no post/housing). You normally use the `?` glyph + a `text` line instead of writing this by hand. **One per new mechanic.** |
| `anchor` | — | Blue anchor port — hold to swing/zip (same as the `o` glyph). |
| `pull` | — | Yellow instant-pull port — tap to fling to it (same as the `P` glyph). |
| `data` | `id` | **Magenta hack port.** Tap `jack` to hack it; flips anything that lists its `id`. Needs the **hack** ability. |
| `yank` | `id`, `inputs` | **(legacy) Orange stand-alone lever.** Tap `jack` to flip whatever lists its `id`. Prefer putting the port **on the platform** with `yankable` (below). Needs the **yank** ability. |
| `source` | `id` | **Green power link (in).** Feeds a `consumer`/`capacitor`/driven device via `inputs`. |
| `consumer` | `id`, `inputs` | **Green power link (out).** Driven while a `source` reaches it; wire it to drive gates. |
| `capacitor` | `id`, `inputs`, `hold` | **Teal stored-power link.** Holds charge for `hold` seconds after you plug it, then releases. Drives a lift you ride before it runs out. |
| `chip` | — | A **data chip** item. Walk into it to pick it up; Pix carries it over his head (only one at a time matters). Hide it behind `H` walls. |
| `slot` | `id` | A **card slot**, mounted beside a door. Bring a chip within ~1.5 tiles and it clicks in, turning `id` on for good: any `gate` with that `id` in its `inputs` opens. The solver treats slot doors as shut, so they should guard shortcuts or bonuses, not the only way on. |
| `connector` | `color` | A **colour pickup**: the first time Pix jacks in it grants that lens colour; afterwards it behaves as an ordinary anchor. Used to hand the player a new lens colour. |
| `gate` | `id`, `h`, `inputs`, `invert` | A door. Solid when **off**; opens when any `input` is on. `h` = height in tiles (hangs from `y` down). `invert: true` flips it. |
| `lift` | `id`, `w`, `toY`, `inputs` | A platform that rides from `y` to `toY` while powered. `w` = width in tiles. |
| `slider` | `id`, `w`, `toX`, `toY`, `inputs`, `toPix`, `yankable` | A horizontal moving block. **`yankable: true`** gives it its own on-board anchor+power port: jack it to **tether and drive it** (it follows Pix along the `x`→`toX` rail while connected; **X** releases and parks it). Without `yankable` it is driven by `inputs` power like a `lift`. |

**Wiring example** — a hack port that opens a door:

```
entity {"type": "data", "x": 10, "y": 21, "id": "h1"}
entity {"type": "gate", "x": 15, "y": 2, "h": 21, "inputs": ["h1"]}
```

**Drivable platform** — the port is on the platform; tether and steer it across a gap, then ride it:

```
entity {"type": "slider", "x": 26, "y": 16, "toX": 37, "w": 3, "yankable": true}
```

Jack the port on the deck to tether Pix to the platform (the cable holds him within
reach of it, so he can jump and hang off it). Standing on it, **left/right drives the
platform** along the `26`→`37` rail and Pix rides; at the end of the rail he walks off.
Off it, it slides along the rail to follow him. Tap **{jack}** again to let go; it parks
where it stopped. No separate lever, no `inputs` wiring. Rest it at the near end, and
leave a gap of **10+ tiles** to the far side so it can't just be jumped.

---

## 4. Tail directives

| Line | Meaning |
|------|---------|
| `text <line>` | One per `?`, assigned in **reading order**: top-to-bottom, then left-to-right. `\n` becomes a line break. |
| `entity {json}` | Any entity from §3. |
| `zone <blue\|green\|red> x y w h` | A colour zone. Normal mode: inside it, that colour's ledges are real automatically. Hard mode: pressing the lens inside it picks up that colour. Rooms are usually one big zone; split zones to make players switch colours. |
| `spawn x y` | Override the `@` position (use when a wall would sit on the glyph). |
| `exit x y w h` | Override the `E` zone. |

> **One terminal per mechanic.** A terminal is a floating sign that introduces a
> *new* idea — don't narrate every beat. If a room teaches one mechanic, it gets
> one `?`.
>
> **Terminal order is the #1 gotcha.** If the start sign reads like the ending,
> your `text` lines are in the wrong order. Sort your `?` tiles by `(y, x)` and
> write the `text` lines to match.

**Button tokens in text.** Write `{jack}`, `{jump}`, `{dash}`, `{recal}`,
`{up}`, `{down}`, `{left}`, `{right}` — they render as the player's current key
binding. Example: `HOLD {recal} TO SEE BLUE LEDGES.`

---

## 5. Movement budget (so your room is actually possible)

The solver errs on the generous side, so a mechanic it says is required really is.
Design to these, in **tiles**:

| Move | Reach |
|------|-------|
| Single jump rise | ~3.6 |
| Double jump rise | ~6.4 |
| **Jump, jump, dash up** | **~11** — the dash goes in all 8 directions (the solver allows **11**) |
| Running jump across (level) | ~6 single, ~10 with the double jump |
| **Jump, jump, dash** across (level) | **~13** (the solver allows **12**) |
| Wall grab | resets the air dash, so wall → dash → wall chains |
| Wall-jump | works in a shaft where the two walls are **≤ 5 tiles apart** |
| Zip / pull port range | **10 tiles**, needs clear line of sight to the port |
| Swing reach | ~11 tiles from the anchor |
| Lens budget (hard mode) | **~5 seconds** — about **22 tiles** of travel while holding a colour. Normal mode has no budget. |

Consequences worth memorising:

- **A climb that forces a mechanic is 12+ tiles tall** (13 is safer). A pull cliff:
  13 tall, with the port mounted on its face ~9 up so the cable reaches it from the
  floor. A blue hop: a 12-tall wall with the blue ledge halfway.
- **A gap that forces a mechanic is 15+ tiles wide** (rail ends, anchor swings),
  measured from the last place Pix can stand.
- **Nothing standable inside the climb.** A plank or ledge partway up is a ladder:
  anything within 11 below a ledge reaches it. Hang anchors from pillars that run up
  to the ceiling, not from beams Pix can stand on.
- **Don't leave a 2–5-tile-wide vertical shaft** next to where you want to force
  a mechanic, or Pix will wall-jump up it and skip your puzzle.
- **Blue/green/red climbs must fit one lens window.** A long coloured staircase
  passes the solver (it treats the ledge as always solid) but is impossible in
  play because the lens drains in ~5s. Keep coloured sections to **one or two
  hops**, with a solid landing right after.
- **Pull ports need line of sight.** If a ledge sits between Pix and the port,
  the shot is blocked. Aim diagonally past obstructions.

---

## 6. Forcing a mechanic (and proving it)

A room "teaches" a mechanic only if it **can't be finished without it**. Verify
with the solver by disabling that mechanic — it should then fail:

```
npm run gen:room -- --check <file>              # must pass (finishable)
```

To test a specific mechanic is required, disable it in a tiny script using
`checkRoom(room, { disable: ['pull'] })` — if `.ok` is still `true`, the
mechanic is optional and your puzzle is cheesable. Disable names:
`anchor`, `pull`, `wall`, `colour`, `power`, `yank`, `hack`.

Practice rooms are the exception: a no-fail teaching room *should* be finishable
even if the player fumbles the new mechanic. Keep practice rooms **current-free**.

---

## 7. Checklist before you ship a room

- [ ] RULES header present and `tests/unit/roomRules.test.ts` passes (see `docs/level-design-rules.md`).
- [ ] Exactly one `@` and an `E` zone.
- [ ] `#` walls on both sides and a ceiling; a solid floor or clearly intended pits.
- [ ] Spawn tile is on ground, not inside a wall (the test suite checks this).
- [ ] Every `?` has a matching `text` line, in reading order.
- [ ] One terminal per *new* mechanic — not one per beat. A room with nothing new has at most one.
- [ ] Secrets (`H` walls, `W` ledges, chips and their slot doors) are optional: the room must be finishable without them.
- [ ] Every port is **mounted** (its tile touches a wall, a ceiling, or the thing it drives — a hack port beside its door, a pull port on a cliff face or under a shelf, a yank port on its platform) and **required** by the route. No ports sitting on a floor doing nothing.
- [ ] Pull ports are within 10 tiles of where you stand to fire, with a clear line that doesn't clip a ledge corner on the way up.
- [ ] Every `id` referenced in an `inputs` list exists.
- [ ] All solids and entities are inside the room bounds.
- [ ] `npm run gen:room -- --check` passes.
- [ ] The mechanic you meant to teach is actually required (see §6).
- [ ] Coloured-ledge sections fit one ~5s lens window (so they're fair in hard mode).
- [ ] Signs that mention the lens have a normal and a hard half: `text NORMAL TEXT || HARD TEXT`.
- [ ] `npx tsc --noEmit` and `npx vitest run` are green.
- [ ] You (or the user) play-tested it — the solver proves *possible*, not *fun*.

---

## 8. Quick reference card

```
MAP GLYPHS
  #  wall/floor     =  plank (drop: down+jump)   ^  current (floor, wall or ceiling)
  n  neon (gone under lens)     B/G/R  blue/green/red ledge (real in its zone; hard: under its lens)
  W  white ledge (true view only)   H  secret wall (true view sees through)
  @  spawn          E  exit        .  air
  o  anchor (blue, hold/swing)   P  pull port (yellow, instant fling)
  *  packet         ?  terminal (floating; one per mechanic)

PORTS   P pull=yellow instant · o anchor=blue hold · yankable slider=blue+teal drive
        data=magenta hack · source/consumer=green link · capacitor=teal stored

TAIL
  text <line>                      one per ?, reading order, \n = newline
  entity {json}                    gates, lifts, sliders, ports
  zone blue|green|red x y w h      lens colour pickup area
  spawn x y   /   exit x y w h     overrides

BUDGET (tiles)   jump 3 · double 6 · wall-jump shaft ≤5 wide · pull/zip 10 · lens ~22
```
