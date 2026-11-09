import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/gameplay/AsciiRoom';

const room = `// a tiny test room
id t-1
name T-1 TEST
tagline hello
bg hall
map
#######
#o..E.#
#@?.E*#
##==^x#
#######
end
text HI.\\nTWO LINES.
entity {"type": "gate", "x": 3, "y": 1, "h": 2, "inputs": ["c1"]}
`;

describe('parseRoom', () => {
  const r = parseRoom(room);
  it('reads the header and size', () => {
    expect([r.id, r.name, r.tagline, r.bg, r.width, r.height]).toEqual(['t-1', 'T-1 TEST', 'hello', 'hall', 7, 5]);
  });
  it('finds spawn and the exit box', () => {
    expect(r.spawn).toEqual([1, 2]);
    expect(r.exit).toEqual([4, 1, 1, 2]);
  });
  it('merges walls into rectangles that cover every # cell', () => {
    const covered = new Set<string>();
    for (const [x, y, w, h] of r.solids) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) covered.add(`${x + i},${y + j}`);
    const expected = room.split('\n').slice(6, 11).flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `${x},${y}` : '')).filter(Boolean));
    expect([...covered].sort()).toEqual(expected.sort());
  });
  it('reads planks and spikes, and no longer knows breakables or enemies', () => {
    expect(r.oneway).toEqual([[2, 3, 2]]);
    expect(r.spikes).toEqual([[4, 3, 1]]);
    expect(r.entities.some((e) => ['breakable', 'drone', 'bouncer', 'leaper'].includes(e.type))).toBe(false);
  });
  it('places glyph entities, terminal text and extra entities', () => {
    expect(r.entities).toContainEqual({ type: 'anchor', x: 1, y: 1 });
    expect(r.entities).toContainEqual({ type: 'packet', x: 5, y: 2 });
    expect(r.entities).toContainEqual({ type: 'terminal', x: 2, y: 2, text: 'HI.\nTWO LINES.' });
    expect(r.entities).toContainEqual({ type: 'gate', x: 3, y: 1, h: 2, inputs: ['c1'] });
  });
  it('rejects a terminal without text', () => {
    expect(() => parseRoom(room.replace('text HI.\\nTWO LINES.\n', ''))).toThrow(/no text line/);
  });
});
