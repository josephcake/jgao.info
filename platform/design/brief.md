# Game Brief: NULL_ROUTE

**One-sentence pitch:** A pixel-art creature from the cyber world falls into a soft, handmade clay-and-polygon dimension and fights, swings and hot-wires its way through it with the only thing it brought along: its own ethernet cable.

## Setting: inside the home network
PKT never leaves the hardware. Each level takes place inside one device, and the
"city" is that device seen at packet scale: the skyline is capacitors, batteries,
pin headers and chips, circuit traces run like streets, and the sky is the
inside of the plastic case with vent slats letting light in. Every level keeps
the cyberpunk city look; its major buildings are the parts unique to that device.

| Level | Device | Landmark buildings |
|-------|--------|--------------------|
| 1 THE LAST MILE | WiFi modem | antennas, WiFi chip, status-light tower, ethernet jack, coax connector |
| 2 | Keyboard | keycaps, key switches, membrane, USB controller |
| 3 | Mouse | scroll wheel, optical sensor, buttons |
| 4 | Router | port bank, switch chip, antennas |
| 5 | Printer | print head, paper rollers, ink cartridges |
| 6 | GPU | heatsink fins, VRAM chips, the GPU die |
| 7 | Motherboard | fans, CPU socket, coolant paste, RAM slots |

Each device is set by `device` on its level in `src/gameplay/RoomData.ts`; the
landmarks are drawn in `src/render/CityDressing.ts`. Only the modem exists so far.

## Core loop
- Enter a room, read the space (and the snarky terminals), spot the ports.
- Use the cable to swing from anchor ports, zip to pull ports, carry power from sources to consumers and hack data ports. There is no attack and there are no enemies; only bosses, and those are out-thought.
- Hold Recalibrate to see the world as it really is: some ledges only exist in the true view, some bridges only in PKT's neon view.
- Reach the exit, next room. Die, respawn at the room start in about a second.

## Player goal & fail state — what "working" looks like
- Goal: clear 8 rooms of Lowtown Grid and defeat The Antibody. A run feels complete when the boss falls and the end card shows time and deaths.
- Fail: lose all 5 packets (HP), or fall out of the room. The room resets.

## MVP — what must exist to be the game
- Tight movement: run, variable jump, double jump, dash, wall slide/jump, coyote time and jump buffer.
- Cable: jack (swing, zip, power tether/place, data hack).
- Power puzzles: sources, consumer ports, capacitors, gates, lifts, bridges, inverted devices.
- Recalibrate (true view) with neon-only and true-only geometry.
- Bosses with 3 phases, beaten by timing and positioning, not damage.
- The perception look: clay/low-poly world, neon remap, render-distance wireframe, and an unfiltered pixel hero.
- 8 rooms, terminals, HUD, death/respawn, title and end screens.

## Out of scope — not building this
- No procedural generation, meta-progression, save files, or inventory.
- No gamepad remapping (the saved profile exists in `src/core/Bindings.ts`, unused) or localization. Keyboard remapping is in.
- One biome only.

## Build order
1. Fixed-step AABB physics and player movement feel.
2. Cable: rope, swing, zip.
3. Power graph and devices; Recalibrate.
4. The bosses.
5. Rooms.
6. Perception shader, clay baking, pixel hero, audio.
7. Polish and play-test.

---
**Who it's for / what they feel:** action-platformer fans who want Dead Cells speed with "aha" puzzle beats; they should feel clever and a little out of place.

**Art & audio direction:** a smooth claymation/low-poly world authored in muted earth tones, gradient-mapped to neon by PKT's eyes; PKT is crisp 16x20 pixel art. PKT sounds like a chiptune synth; the world sounds like squelches and thuds.

**Reference game:** Dead Cells, keeping the movement speed, hitstop and room-by-room flow. No roguelite structure.
