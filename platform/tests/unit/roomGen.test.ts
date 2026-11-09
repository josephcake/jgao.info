import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/gameplay/AsciiRoom';
import { LEVELS } from '../../src/gameplay/RoomData';
import { ownedHues } from '../../src/gameplay/Colours';
import { FOCI, checkRoom, generateRoom, generatedLevel } from '../../src/gameplay/RoomGen';

describe('RoomGen', () => {
  for (const flow of ['right', 'up'] as const) {
    for (const focus of FOCI) {
      it(`makes a solvable ${flow} room around ${focus}`, () => {
        for (const difficulty of [1, 3] as const) {
          const r = generateRoom({ seed: 11, focus, flow, difficulty, packet: true });
          expect(checkRoom(r.room).ok).toBe(true);
          // the text it writes is a valid room file that parses back the same
          expect(parseRoom(r.text)).toEqual(r.room);
        }
      });
    }
  }
  it('is deterministic for a seed', () => {
    expect(generateRoom({ seed: 42, focus: 'gap' }).text).toEqual(generateRoom({ seed: 42, focus: 'gap' }).text);
  });
  it('gives lens rooms a zone of the chosen colour', () => {
    const r = generateRoom({ seed: 3, focus: 'carry', hue: 'red' });
    expect(r.room.zones?.map((z) => z.color)).toEqual(['red']);
    expect(r.room.trueColor?.every((c) => c === 'red')).toBe(true);
  });
  it('builds a playable 10-room level', () => {
    const lv = generatedLevel({ seed: 5 });
    expect(lv.rooms).toHaveLength(10);
    expect(lv.rooms.every((r) => checkRoom(r).ok)).toBe(true);
  });
});

describe('story rooms', () => {
  for (const level of LEVELS) {
    // white true view is there once Pix has all three colours
    level.rooms.forEach((r, i) => it(`${r.id} can be finished`, () => expect(checkRoom(r, { swing: true, white: level.id === 'training' || ownedHues(level, LEVELS.indexOf(level), i).length === 3 }).ok).toBe(true)));
  }
});

describe('checkRoom and colour zones', () => {
  const room = (zone: string) => parseRoom(`id z\nname Z\ntagline z\nbg city\nmap
##########################
##......................##
##......................EE
##@...BBB....BBB......BBEE
#####^^^^^^^^^^^^^^^^^^^##
##########################
end
${zone}`);
  it('needs a zone of the ledge colour to cross hidden ledges', () => {
    expect(checkRoom(room('')).ok).toBe(false);
    expect(checkRoom(room('zone green 0 0 6 6')).ok).toBe(false);
    expect(checkRoom(room('zone blue 0 0 6 6')).ok).toBe(true);
  });
  it('lets the white lens show hidden ledges anywhere', () => {
    expect(checkRoom(room(''), { white: true }).ok).toBe(true);
  });
});
