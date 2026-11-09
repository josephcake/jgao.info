import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/gameplay/RoomData';
import { countMechanics, newMechanics, MECHANICS } from '../../src/gameplay/RoomRules';

// docs/level-design-rules.md: every story room declares its rules, and each room either
// brings in a new mechanic or is harder than the one before it.
const rooms = LEVELS[1].rooms;
const oneDecimal = (n: number) => Number.isFinite(n) && Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;

describe('room rules', () => {
  for (const [i, r] of rooms.entries()) {
    describe(r.id, () => {
      it('declares main, mechanics, new and hardness', () => {
        expect(r.rules, 'missing RULES header').toBeDefined();
        const h = r.rules!.hardness;
        expect(oneDecimal(h) && h >= 1 && h <= 10, `hardness ${h} must be 1-10 with at most one decimal`).toBe(true);
        expect(r.rules!.main.length, 'main lists 1 to 3 mechanics').toBeGreaterThanOrEqual(1);
        expect(r.rules!.main.length, 'main lists 1 to 3 mechanics').toBeLessThanOrEqual(3);
        for (const m of r.rules!.main) expect(Object.keys(r.rules!.mechanics), `main '${m}' is not in mechanics`).toContain(m);
        for (const m of Object.keys(r.rules!.mechanics)) expect(MECHANICS as readonly string[], `unknown mechanic '${m}'`).toContain(m);
      });
      it('scores each portion, and its hardness is their average', () => {
        const ps = r.rules!.portions;
        expect(ps.length, 'at least one portion line').toBeGreaterThan(0);
        for (const p of ps) {
          expect(oneDecimal(p.hardness) && p.hardness >= 1 && p.hardness <= 10, `portion '${p.label}' hardness ${p.hardness} must be 1-10`).toBe(true);
          expect(p.label, 'every portion says what it is').not.toBe('');
        }
        const mean = Math.round((ps.reduce((a, p) => a + p.hardness, 0) / ps.length) * 10 + 1e-9) / 10;
        expect(r.rules!.hardness, 'hardness is the mean of the portions, to one decimal').toBe(mean);
      });
      if (i >= Math.floor((rooms.length * 2) / 3)) {
        it('is a later room: most portions sit at hardness 5-8', () => {
          const ps = r.rules!.portions;
          const inBand = ps.filter((p) => p.hardness >= 5 && p.hardness <= 8).length / ps.length;
          expect(inBand, `${Math.round(inBand * 100)}% of portions in 5-8, needs 70%`).toBeGreaterThanOrEqual(0.7);
        });
      }
      it('never repeats the same obstacle: every portion label is different', () => {
        const labels = r.rules!.portions.map((p) => p.label);
        expect(labels.filter((l, k) => labels.indexOf(l) !== k), 'repeated portions').toEqual([]);
      });
      it('has at most one sign when nothing in it is new', () => {
        if (r.rules!.newMechanics.length === 0 && i >= 18) expect(r.entities.filter((e) => e.type === 'terminal').length).toBeLessThanOrEqual(1);
      });
      it('counts its mechanics truthfully', () => expect(r.rules!.mechanics).toEqual(countMechanics(r)));
      it('names the mechanics that are new here', () => expect(r.rules!.newMechanics).toEqual(newMechanics(rooms, i)));
      if (i > 0) {
        it('brings a new mechanic or is harder than the room before', () => {
          const prev = rooms[i - 1].rules!.hardness;
          if (r.rules!.newMechanics.length === 0) expect(r.rules!.hardness, `${r.id} has nothing new, so it must be harder than ${rooms[i - 1].id} (${prev})`).toBeGreaterThan(prev);
        });
      }
    });
  }
});
