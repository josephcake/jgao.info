# Level Design Rules

> **READ THIS BEFORE YOU TOUCH A ROOM.** This is the law for every DEAD PIXEL room.
> `docs/room-design-guide.md` tells you *how to write* a `.room` file (glyphs,
> entities, movement budget). This file tells you *what a good room is* and the
> rules every room must follow. The rules in §1–§3 are **enforced by
> `tests/unit/roomRules.test.ts`**: a room that breaks them fails the build.

---

## 0. The rules (memorise these)

1. **Every room declares its rules** in its header: `main`, `mechanics`, `new`, one `portion` line per section, and `hardness` (§1).
2. **Every portion has its own hardness (1–10).** The room's hardness is the **average of its portions** (§3).
3. **Next room = new mechanic, or harder.** If a room brings nothing new, its hardness must be **strictly higher** than the room before it. Decimals are allowed, so climb **slowly** (5.3 → 5.4 → 5.7), with a different setup each time (§3).
4. **Later rooms hover at 5–8.** In the last third of a stage, at least **70% of portions** score 5–8. Peaks above 8 are rare; rests below 5 are fine (§3).
5. **One idea per room.** `main` lists 1–3 mechanics. Everything else in the room supports them.
6. **Teach, test, twist, finale.** Show the idea safely, make the player use it, change one thing about it, then combine it (§4.1).
7. **New mechanics are introduced in safety.** No current under the first use of a new mechanic. A teaching room can (and should) be *easier* than the room before.
8. **The player can always read the room.** See the hazard before it matters, see the landing before the jump. No blind drops, no leaps of faith (§4.3).
9. **Rhythm: tension, then release.** After every hard beat, a solid rest spot at least 4 tiles wide (§4.4).
10. **Go around the map.** Use the height. A route that only runs left to right on one floor line is a corridor, not a level (§4.5).
11. **No dead air.** Never more than ~8 tiles of empty walking. Every screen has a decision in it (§4.6).
12. **Vary the obstacles.** Never the same obstacle twice in a room (every portion label is different), and never more than a few of one kind. Change the size, the height, the spacing, the order, or the mechanic (§4.10).
13. **Mount every port, require every port.** A port hangs from a ceiling, a pillar, a wall, or its own platform. Every port is on the route, and removing its mechanic makes the room unfinishable (room guide §7).
14. **Secrets are optional.** Hidden walls, white ledges and chips hold bonuses; there is always an ordinary way past.
15. **Death costs the whole room** (current is instant death, the room restarts). A long route raises the hardness of everything in it (§4.7).

---

## 1. The RULES header (required in every room)

Put these lines in the header, after `bg` and before `map`:

```
// RULES: what this room is about, how often each mechanic shows up, how hard each portion is (docs/level-design-rules.md)
main anchor yank
mechanics current:2 pull:2 anchor:2 yank:1
new anchor
portion 4 swing a current pit
portion 4 rail stops short, swing the rest
portion 4 pull up the cliff
hardness 4
```

| Line | Meaning | Checked by the test |
|------|---------|---------------------|
| `main a b` | The **1–3 mechanics this room is about**. The thing a player would say the room "was". | 1–3 names, each must appear in `mechanics` |
| `mechanics a:n b:m` | **How many times each mechanic shows up** (§2 says how they're counted). | Must equal `countMechanics()` in `src/gameplay/RoomRules.ts` exactly |
| `new a b` / `new -` | Mechanics that appear **for the first time in the level** here. `-` if none. | Must equal `newMechanics()` exactly |
| `portion h label` | One line per **portion** (a section of the route: one beat or a short run of beats), **in route order**. `h` is its hardness 1–10, scored with §3. `label` says what the player does there. | 1–10, at most one decimal, label not empty |
| `hardness n` | The room's hardness: the **average of its portions**, rounded to one decimal. | Must equal that average; progression rule; late-room band (§3) |

You don't have to count by hand. Write the room, then print the true counts:

```
npx vitest run tests/unit/roomRules.test.ts
```

A wrong `mechanics` or `new` line fails with the expected value in the diff. Copy it in.
`main` and each `portion` score are **your judgement**. Score them honestly with §3.
`hardness` is arithmetic: the mean of the portions.

---

## 2. Mechanic vocabulary

These are the only mechanic names. Movement verbs (run, jump, double jump, dash,
wall-jump) are not mechanics. Every room has them.

| Name | What counts as one |
|------|--------------------|
| `current` | one connected patch of `^` (a pit, a strip on a wall) |
| `plank` | one connected patch of `=` |
| `pull` | one yellow pull port (`P` / `pull`) |
| `anchor` | one blue anchor (`o` / `anchor`): zip or swing |
| `yank` | one drivable platform (`slider` + `yankable`) or legacy `yank` lever |
| `hack` | one magenta hack port (`data`) |
| `lift` | one powered lift |
| `capacitor` | one capacitor (timed power: lifts, gates) |
| `consumer` | one consumer (live power: gates) |
| `colour` | one colour pickup (`connector`) |
| `blue` / `green` / `red` | one connected patch of `B` / `G` / `R` ledges |
| `neon` | one connected patch of `n` |
| `white` | one connected patch of `W` |
| `secret` | one connected patch of `H` |
| `chip` | one data chip |

**How many times is right?** Use the rule of three for each `main` mechanic: at
least **3 uses** (teach, test, twist). A non-main mechanic can appear once or twice
as seasoning. A main mechanic that shows up once is not a main mechanic. A mechanic
that shows up 20 times with no change is repetition, not design (§4.1).

---

## 3. Hardness 1–10 and the progression rule

### Portions

A room is a sequence of **portions**: a rail crossing, a chain of zips, a stone run, a
timed gate. Portions are scored **separately**, because a room is never one difficulty
all the way through: it has rests, a few real tests and maybe one peak. The room's
hardness is the **average** of its portions.

### The rubric (score each portion with it)

Score each of the five axes 0, 1 or 2 and add them up. A portion's hardness = the total,
minimum 1. Use a half or a tenth (6.5, 6.2) when a setup is a notch harder than another
that scores the same.

| Axis | 0 | 1 | 2 |
|------|---|---|---|
| **Precision**: tightest margin on the route | every jump has 3+ tiles to spare | some jumps within 1–2 tiles of max reach | jumps at max reach, 1–2 tile landings |
| **Chain**: longest run with no safe ground | ≤ 1 move | 2–3 moves (e.g. rail, then swing) | 4+ moves in a row (zip, zip, hop, swing...) |
| **Mix**: mechanics you must combine | 1 | 2 | 3+ at once |
| **Hazard**: how much current punishes a miss | none / soft floors | current under some beats | current under almost every beat |
| **Clock & cost**: time pressure, and how far a death sends you back | no timer, near the spawn | a timer (capacitor, lens budget) *or* far from the spawn | a timer *and* far from the spawn |

Reference points:

| Portion hardness | Feels like | Example portion |
|:-:|---|---|
| 1 | a walk with a jump in it | first jumps in 1-1 |
| 2–3 | practice: nothing can go badly wrong | swing practice over a soft floor (1-10) |
| 4 | the mechanic over a real hazard, or a rest with a small test | jump 3 current notches |
| 5–6 | the core of the game: one mechanic chained, or two combined, over current | rail stops short, swing a 22 gap; zip 3 anchors |
| 7–8 | a real test: long chains, tight landings, a timer | hop 4–5 pull ports in a row; a capacitor gate 26 tiles away |
| 9–10 | a peak. Every axis near max. | at most one per room, and rare |

### The progression rule (enforced)

For each room after the first, in level order:

- **It has something in `new`:** any hardness is allowed. A teaching room should
  usually **drop** hardness 2–3 points so the new idea is learnt in safety.
- **`new` is `-`:** its hardness must be **strictly greater** than the previous room's.

Hardness has one decimal, so rooms can **climb slowly**: 5.3, 5.4, 5.7, 5.8. There
are endless setups at any given hardness. The next room doesn't need a bigger
number on every portion, only a different arrangement that is, on average, a
little harder. Never inflate a number to pass the test: change the room so it is
harder for real (see the levers below), or reorder rooms.

### Late rooms hover at 5–8 (enforced)

In the **last third of a stage**, at least **70% of a room's portions** score
**5–8**. That is the sweet spot: hard enough to be a test, fair enough to be fun
for a whole room. Keep the rest below 5 as breathers (a hurdle, a hack gate, a
secret) and allow at most one peak above 8. A late room full of 9s is exhausting;
a late room full of 3s is filler.

### Levers: a different setup, slightly harder

When the next room has nothing new, pick one or two of these for some of its
portions. Each is worth about +0.5 to +1 on that portion:

- **Longer chains:** 3 anchors → 4; 4 pull ports → 5; one more stone.
- **Tighter spacing:** less ground between beats (but landings after a swing or zip stay ≥ 4 tiles).
- **Wider gaps:** current notches 5 → 6 wide (double jump needed); rail gaps 15 → 22 (two anchors).
- **Taller obstacles:** blocks 2 → 3 tall over the gaps, hurdles 4 → 5.
- **Tighter clocks:** a capacitor gate further from its capacitor.
- **Mix:** two mechanics back to back with no rest between (rail straight into a zip chain).
- **Direction:** the same beat upward, or right-to-left on the way back.

Use them slowly. Two levers on every portion at once is a jump of 2+, not a slow climb.

---

## 4. What makes a level beautiful

### 4.1 Teach, test, twist, finale (kishōtenketsu)

The structure Nintendo uses for almost every Mario level, and the one to use for
every room *and* every run of rooms:

1. **Teach.** Introduce the idea where failure is free: no current, a soft floor, a
   wall to catch you. One `?` sign explains it.
2. **Test.** The same idea, now it matters: current underneath, a longer gap.
3. **Twist.** Change *one* thing: do it upward instead of across, under a timer,
   with the ground disappearing (neon), mid-swing.
4. **Finale.** Combine it with something the player already knows, once, at full
   strength. Then the exit.

A room that is only "test, test, test" is filler. If you're copying a beat a fourth
time, twist it instead.

### 4.2 One idea per room

The player should be able to name the room after one sentence: "the one where the
rail stops short". That sentence is your `main` line. If you need three sentences,
make three rooms.

### 4.3 Readability and fairness

- **Telegraph everything.** Hazards are visible before they matter. The current
  glows and moves, so give it space to be seen. Don't hide it behind a ledge lip.
- **See the landing before the jump.** The camera must show where a jump, swing or
  zip ends before the player commits. No drops into darkness.
- **Ports point the way.** A port you need is mounted where the eye goes next: on
  the wall you're facing, at the top of the gap.
- **Margins.** Design to the movement budget in the room guide *minus* a safety
  margin: a "normal" gap is ≤ 2 tiles under max reach. Only hardness 8+ goes to the limit.
- **Landings after swings and zips are at least 4 tiles wide.** Releasing a rope is imprecise.
- **No guesswork.** If a player can die before they can know why, the room is wrong.

### 4.4 Rhythm: tension and release

A good room breathes. Alternate **beats** (a jump chain, a swing, a timed gate) with
**rests** (solid ground, no hazard, no timer). Rules of thumb:

- A beat lasts 2–6 seconds. Then a rest of at least 4 solid tiles.
- Difficulty inside a room rises in a sawtooth: hard beat, rest, slightly harder beat, rest.
- Put the hardest beat **near the end**, not the start, so the room ends on a high
  and the player isn't replaying the climax after every death... unless the route
  is long (§4.7), then put it early.

### 4.5 Space: go around the map

- **Use the height.** Climb, cross, drop, loop back. Players remember shapes, not
  distances. A loop (out along the bottom, back along the top) is a strong shape.
- **Show the goal early.** Let the player glimpse the exit or the next area before
  reaching it, then make them earn the route there.
- **Landmarks.** One memorable silhouette per area (a tower, a pillar, a big
  machine) so the player knows where they are.
- **Vary the floor line.** Flat lines read as corridors. Step it up and down, add
  ceilings that press down and open up again.

### 4.6 Density: no dead air

- Never more than **~8 tiles of empty walking** between beats.
- **Every screen contains a decision** (when to jump, which port, which way).
- Secrets and packets go **off** the main route, where curiosity is rewarded.
  The main route never needs them.

### 4.7 Cost of failure

Touching current is instant death and the room restarts. So distance from the spawn
is part of every portion's hardness (the *clock & cost* axis): the same zip chain is
harder 250 tiles into a room than 20 tiles in.

- Big rooms are fine. Keep the portions far from the spawn in the 5–8 band, not at 9–10.
- Don't put the room's only peak at the very end of a long route. The player would
  replay the whole room to practise one beat. Put a peak mid-route, then ease off.
- Never stack a timer and a long route on a 9-hardness beat.

### 4.8 Composition (how it looks)

- **Silhouette first.** Squint at the ASCII map: you should see shapes (towers,
  bridges, a cave), not noise.
- **Negative space is a tool.** An empty sky over a swing reads as "fly here".
- **Break symmetry on purpose.** Perfectly repeated blocks read as generated. Vary
  widths, heights and spacing by a tile or two.
- **Frame the exit.** The exit sits somewhere that looks like an ending: the top of a
  tower, through a door, at the end of a bridge.

### 4.9 Signs

One `?` per **new** mechanic, placed just before its first use. Signs don't narrate
beats. A room with nothing new has **at most one sign** (enforced), for flavour or to
say how the room is shaped.

### 4.10 Variation: no two obstacles alike

A long room made of one beat repeated is padding, even at hardness 6. Rules:

- **Never repeat a portion.** Two portions in a room can't have the same label, so
  vary at least one of: size (gap or length), height, spacing, number of pieces, where
  the ports hang (ceiling, high, mid, low), what's underneath.
- **Mix families.** Draw from many kinds: current notches, block hops, hurdles, steps,
  plateaus, floating blocks, planks, low ceilings, rails, anchor chains, pull-port chains,
  neon/white stones, hack gates, capacitor gates, secret walls. A room of 15+ portions
  uses at least 7 kinds, and at most 3 of any one kind (4–5 for the room's theme).
- **Vary the floor line.** Steps, plateaus, hurdles and low ceilings change the shape
  of the lane, so it never reads as a flat strip.
- **Vary the spacing.** Rest spots between beats are 4–6 tiles, never always the same.
- **Different, not just bigger.** A later room should reach for a kind the earlier ones
  used less, not only add one more of the same.
- **Order matters.** Open with a warm-up (≤ 4.5), keep the peak away from the first
  and last portion, never put two 8+ portions back to back, and ease off before the exit.

---

## 5. Workflow for agents

1. Read the previous room's RULES header. Decide: **new mechanic** (teaching room,
   hardness can drop) or **same mechanics, harder** (hardness must rise).
2. Write the room's intent in one sentence. That's `main`.
3. Sketch the beats: teach, test, twist, finale, with rests between them.
4. Author the `.room` file using `docs/room-design-guide.md`.
5. Add the RULES header. Split the route into portions and score **each portion** with
   §3. Write the axis scores for the hardest portions in your summary to the user
   (e.g. "zip chain: precision 1, chain 2, mix 1, hazard 2, clock 0 = 6"). `hardness`
   is the mean of the portions.
6. Run `npx vitest run tests/unit/roomRules.test.ts`, then copy the exact
   `mechanics` and `new` values from any failure diff.
7. Prove the room is finishable and that `main` is really required (room guide §6).
8. If the progression rule fails, **change the room** (add a new mechanic, or pull a
   lever from §3 on a few portions) or **reorder rooms**. Never just bump a number.

## 6. Checklist

- [ ] RULES header present: `main` (1–3), `mechanics`, `new`, `portion` lines, `hardness` (= their mean).
- [ ] Late-stage room: at least 70% of portions at 5–8, at most one above 8.
- [ ] `roomRules.test.ts` passes for this room and the room after it.
- [ ] Each `main` mechanic appears at least 3 times and changes at least once (twist).
- [ ] New mechanics are first met over safe ground, with one sign.
- [ ] No portion label repeats; the room uses a mix of kinds (§4.10).
- [ ] Every port is mounted and required; secrets are optional.
- [ ] Every hard beat is followed by a rest of 4+ solid tiles.
- [ ] The route uses the height: it doesn't run along one floor line.
- [ ] No stretch of more than ~8 empty tiles.
- [ ] Far from the spawn, portions stay in 5–8, not at peaks (§4.7).
- [ ] The exit is framed, and visible or hinted early.
