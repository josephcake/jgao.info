---
paths:
  - "assets/data/rooms/**"
  - "scripts/gen-room.mjs"
  - "scripts/gen-stage.mjs"
  - "src/gameplay/RoomGen.ts"
  - "src/gameplay/RoomBuilders.ts"
---

# Level Design Rules (mandatory)

**Before creating or editing any room, read `docs/level-design-rules.md` in full.**
It is the law for rooms; `docs/room-design-guide.md` is the file-format reference.

The non-negotiables, enforced by `tests/unit/roomRules.test.ts`:

1. Every `.room` file has a RULES header before `map`:
   `main` (1–3 mechanics the room is about), `mechanics` (exact counts),
   `new` (first appearances in the level, or `-`), one `portion <1-10> <label>`
   line per section of the route, and `hardness` = the mean of the portions.
2. **Next room = a new mechanic, or harder.** If `new` is `-`, `hardness` must be
   strictly greater than the previous room's. One decimal is allowed: climb slowly
   (5.3, 5.4, 5.7) with a different setup, using the levers in the doc. Never raise a
   number without making the room actually harder. Fix the room or the order instead.
3. **Later rooms hover at 5–8:** in the last third of a stage, at least 70% of a room's
   portions score 5–8.
4. `mechanics` and `new` must match `src/gameplay/RoomRules.ts` exactly. Run the test
   and copy the values from the failure diff instead of counting by hand.
5. Score each portion with the five-axis rubric (precision, chain, mix, hazard,
   clock & cost) and report the axis scores of the hardest portions to the user.

Also: one idea per room, teach then test then twist, rests after hard beats, use the
height, no stretch of more than ~8 empty tiles, and keep far-from-spawn portions out of
peaks (current is instant death and restarts the room).
