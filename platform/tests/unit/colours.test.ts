import { describe, expect, it } from 'vitest';
import { sightFor, whiteAvailable, zoneAt } from '../../src/gameplay/Colours';
import { LEVELS } from '../../src/gameplay/RoomData';

describe('colours', () => {
  it('white true view needs all three colours, in any level (training has it from the start)', () => {
    expect(whiteAvailable(0, [])).toBe(true);
    expect(whiteAvailable(1, ['blue', 'green'])).toBe(false);
    expect(whiteAvailable(1, ['blue', 'green', 'red'])).toBe(true);
  });
  it('lens signs read differently in normal and hard mode', () => {
    const lensSigns = LEVELS[1].rooms.flatMap((r) => r.entities.filter((e) => e.type === 'terminal' && /LENS/.test(e.text ?? '')).map((e) => ({ id: r.id, text: e.text ?? '' })));
    expect(lensSigns.length).toBeGreaterThan(0);
    for (const s of lensSigns) {
      const [normal, hard] = s.text.split('||');
      expect(hard, `${s.id} has a hard-mode half`).toBeDefined();
      // normal mode has no lens to hold; {recal} there only ever means true view
      expect(normal, `${s.id}: normal mode doesn't talk about the lens`).not.toMatch(/LENS/);
    }
  });
  it('finds the zone under a tile, later zones winning', () => {
    const r = { ...LEVELS[1].rooms[0], zones: [{ color: 'blue' as const, x: 0, y: 0, w: 10, h: 10 }, { color: 'red' as const, x: 5, y: 5, w: 2, h: 2 }] };
    expect(zoneAt(r, 1, 1)).toBe('blue');
    expect(zoneAt(r, 5, 5)).toBe('red');
    expect(zoneAt(r, 20, 1)).toBeNull();
  });
  it('level 1 starts with the blue connector in 1-1, and every coloured ledge has a zone of its colour', () => {
    const rooms = LEVELS[1].rooms;
    expect(rooms[0].entities.some((e) => e.type === 'connector' && e.color === 'blue')).toBe(true);
    for (const r of rooms) {
      // white ledges are true-view secrets and need no zone
      for (const hue of new Set(r.true.map((_, i) => r.trueColor?.[i] ?? 'blue'))) if (hue !== 'white') expect(r.zones?.some((z) => z.color === hue), `${r.id} ${hue}`).toBe(true);
    }
    // the first room, played in the dark before the connector, needs no lens
    expect(rooms[0].true.length).toBe(0);
  });
  it('sees only the colours Pix has', () => {
    expect(sightFor([]).level).toBeLessThan(0.1);
    expect(sightFor(['blue'])).toMatchObject({ level: 1, mix: 1 });
    expect(sightFor(['blue', 'green', 'red'])).toMatchObject({ level: 1, mix: 1 });
  });
});
