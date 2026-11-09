# Stage 2: THE ROUTER

Pix has his blue back. The router is the modem's louder sibling: more ports, more
cable, and the first place Pix can *swing* from them and *carry power* through them.
Pix gets his green back here, and the stage ends at Avian Sr.

New this stage: **swing** (hold jack on a blue port), **carrying power** (source ->
consumer, airlocks, capacitors, lifts), and the **green lens**.

Rooms come from the generator (`npm run gen:stage -- --stage 2 --seed 11`) and are
hand-editable `.room` files in `assets/data/rooms/level2/`.

Practice first: the first four rooms have no spikes in the way (deep pits with a plank stair out), so each new mechanic is learnt safely before a room that can reset you.

| Room | Idea | Notes |
|------|------|-------|
| 2-1 DANGLE | swing practice | deep spike-free pit; one anchor; plank stair out if you fall |
| 2-2 THE AIRLOCK | carrying power | source -> consumer opens gate 1; walk in; recall the cable and gate 2 (which wants power off) opens |
| 2-3 CHARGE UP | capacitor practice | charge, recall, run to the gate before it closes; no hazards |
| 2-4 GREEN LIGHT | green connector, two zones | spike-free pits; the lens takes the colour of the zone you press it in, so press again on the middle platform |
| 2-5 HANG ON | swing over spikes | one anchor, low beam so you can't jump it |
| 2-6 CHAIN LETTER | chained swings | let go on the rising side, jack the next anchor |
| 2-7 HOLD THE LINE | capacitor + lift | charge, step on the lift, recall, ride up before the power runs out |
| 2-8 TWO TONE | blue pit then green pit, spikes | the real version of 2-4 |
| 2-9 SWITCHBOARD | swing + capacitor | charge it, recall, swing across before the gate shuts |
| 2-10 HIGH TRAFFIC | the long swing | three anchors at different heights, a landing well below the start |
| 2-11 THE UPLINK | boss: Avian Sr. | the beak slams the uplink wire; jack a wire port to make it live and zap her |

## What was played, and how

Every room except the boss was played end to end by the dev autopilot (`__bot.level()`),
which uses the game's real input. Findings that changed the rooms:

- A lone anchor in the middle of a pit only just reaches the far edge (a pendulum is
  symmetric), so single anchors sit past the middle and the landing is lower.
- The top of the lift shaft had a gap between the lift and the ledge; fixed.
- The colour room's zone edge left only a 2-tile green strip on the middle platform; fixed.
- There are no enemies anywhere in the game any more, so the old drone at the landing is gone.

The autopilot is a crude player, so a pass means "completable", not "fun". These rooms
still need playing by a person: especially the release timing on 2-1 (about a 0.35 s window)
and the capacitor timing on 2-4 and 2-7.

## Not done yet

- Nothing here is final: every room still needs playing by a person.
