# Quick Design Spec: Pigeon Beak Boss (Level 1 boss rework)

**Type**: Addition (replaces the AVIAN boss's behaviour; same room, same slot)
**System**: Level 1 boss, room 1-7 THE UPLINK
**Reference**: `src/gameplay/Avian.ts` (`AvianBoss`), `tools/level1_rooms.py` (room `07-avian`)
**Date**: 2026-11-06
**Estimated implementation**: about 1 day

## Change summary

The boss is no longer a pigeon-sized bird diving around the arena. It's a pigeon
too big to fit on screen. We only see its beak, which slams down onto the uplink
wire to cut PKT's connection. PKT wins by plugging into a power port at the right
moment, so the wire is live when the beak hits it and the pigeon gets electrocuted.

## Motivation

- **Scale:** PKT is one pixel, so anything living outside the modem should feel enormous.
- **Story:** pigeons carried messages long before networks (RFC 1149). Now PKT moves
  at fiber speed and they want revenge.
- **Hooks into existing mechanics:** the win condition uses the cable plug-in (C),
  which is the game's signature move, rather than just hitting a health bar.

## Story beats

- **Room 1-6:** the small AVIAN NPC's last line becomes a warning, for example:
  "MY MOM'S BIGGER. AND SHE'S READ YOUR LATENCY."
- **Fight intro:** the screen shakes, a huge shadow covers the arena, and the beak
  lowers into view. Toast: "YOU REPLACED US WITH FIBER."
- **Win:** "FINE. TAKE THE UPLINK. I'M TELLING THE IETF." (kept from the current boss).

## Arena (room 1-7)

- **The uplink wire** runs along the whole floor. It has 4 connection bars, shown
  on the HUD in place of the boss HP bar, next to 3 zap pips.
- **3 power ports** sit on the wall above the wire, at roughly a quarter, half and
  three quarters of the room's width. Plugging into any one of them powers the
  whole wire.
- **Kept:** the two side platforms and the swing anchors, for dodging and reaching ports.
- **Removed:** the floor spikes (the wire is there now), the two turrets and their
  hack points, and the eggs.

## Core rules

### Slam cycle

1. The beak picks a target spot on the wire: PKT's position, or a random port's
   position in phase 1.
2. A shadow grows on the wire for the telegraph time, and the beak trembles above it.
3. The beak slams down, stays down for `beakDown`, then lifts away.
4. If PKT is under the beak when it lands, PKT takes 1 damage and is knocked back.

### Making the wire live

1. Plugging into a port makes the wire live for `liveWindow`. The wire glows white
   and blue and crackles.
2. That port then needs `portCooldown` before it works again, so plugging in
   nonstop doesn't work. You have to time it.

### Outcome of a slam

1. **The wire was live: ZAP.** A short cutscene plays, the pigeon loses 1 of its
   3 zaps, the wire regains 1 bar, and the next phase starts.
2. **The wire wasn't live:** the wire loses 1 bar and sparks.
3. **All bars gone:** a "CONNECTION LOST" toast appears. The fight restarts at
   phase 1 with full bars, and PKT goes back to the arena entrance with the same HP.

### Pecks (phase 2 and up)

1. Between slams the beak darts at PKT. A glint on the beak tip gives warning first.
2. A peck does 1 damage.
3. Dodge the peck (dash or move out of the way). A peck that misses lodges in the
   floor and the beak is stunned for `deflectStun`; while it's stunned no slam or
   peck can start. That stun is your window to get to a port. A peck that hits
   does 1 damage and gives no stun.

### Phases

- **Phase 1:** slow slams only. This teaches the plug-in timing.
- **Phase 2:** faster slams, plus pecks.
- **Phase 3:** fake-out slams that stop just above the wire, then a real slam,
  sometimes two in a row. Plugging in too early wastes the live window.

### Zap cutscene (about 2 s, skippable with Z or Enter)

1. The game pauses on the hit for a beat. Then a cutaway shows the whole pigeon
   sitting on top of the modem, with tiny PKT at its feet.
2. The pigeon flashes between its body and a cartoon X-ray skeleton 6 times.
   Smoke puffs, then a dazed squawk.
3. It cuts back to the fight, and the next phase's toast appears.

### Death

The third zap uses a longer cutscene. The pigeon keels over, the wire stays live
and glowing, and the level-complete flow starts as it does now.

## Tuning knobs (new `beak` section in `assets/data/tuning.json`)

| Knob | Default | Range | Why |
|---|---|---|---|
| `zaps` | 3 | 2–5 | One zap per phase |
| `wireBars` | 4 | 3–6 | Three misses are forgiven; the fourth costs the fight |
| `telegraph` (phase 1/2/3) | 1.4 / 1.0 / 0.8 s | 0.5–2 | The readable warning shrinks each phase |
| `beakDown` | 0.7 s | 0.3–1.2 | How long the beak stays on the wire |
| `liveWindow` | 0.5 s | 0.3–1.0 | The core timing challenge |
| `portCooldown` | 1.5 s | 0.5–3 | Stops plug-in spamming |
| `peckEvery` | 2.2 s | 1–4 | How often pecks come in phases 2 and 3 |
| `deflectStun` | 1.3 s | 0.6–2 | Long enough to reach the nearest port |
| `fakeoutChance` (phase 3) | 0.4 | 0–0.7 | How often a slam is a feint |
| `cutsceneTime` | 2.0 s | 1–3 | Short enough not to kill momentum |

## Affected systems

| System | Impact |
|---|---|
| `Avian.ts` | `AvianBoss` is replaced by a new beak boss class, built on the same `BossLike` interface. The `AvianNpc` stays |
| `level1_rooms.py` and room 07 JSON | New layout: wire, 3 ports, spikes and turrets removed. Room 1-6 NPC line changed |
| Cable (C plug-in) | Plugging into a boss port sets a "wire live" signal |
| HUD | Shows the wire bars and zap pips instead of an HP bar |
| Art | New art drawn in code: beak, shadow, wire, full-pigeon cutaway with X-ray frame |
| `content-authoring-guide.md` | The boss section's example changes from AVIAN to the beak boss |

## Acceptance criteria

- [ ] Only the beak is ever visible in the arena. The whole pigeon appears only in the cutscene.
- [ ] Plugging in during the shadow telegraph so the beak lands on a live wire always zaps.
- [ ] A slam onto a wire that isn't live removes exactly 1 bar. At 0 bars the fight restarts at phase 1.
- [ ] A peck that misses Pix always sticks and stuns; one that hits never does.
- [ ] Phase 3 fake-outs punish plugging in early but are readable on a second attempt.
- [ ] The cutscene can be skipped and never steals input after it ends.
- [ ] No mouse input anywhere.
- [ ] No regressions: rooms 1-1 to 1-6, the small AVIAN NPC, and level completion
      still work. Typecheck and tests pass.
