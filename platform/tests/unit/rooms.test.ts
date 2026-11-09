import { describe, expect, it } from 'vitest';
import { LEVELS, ROOMS, buildGeometry, validateRoom, currentSide } from '../../src/gameplay/RoomData';
import { groundUnder, overlaps } from '../../src/gameplay/physics';

describe('rooms', () => {
  it('ships 5 training rooms', () => expect(LEVELS[0].rooms).toHaveLength(5));
  it('has no attack: the current is a hazard, not a fight', () => {
    const gone = ['drone', 'bouncer', 'leaper', 'turret', 'breakable', 'arena', 'boss', 'worm', 'bug', 'avian_boss', 'worm_boss'];
    for (const r of ROOMS) {
      expect(r.entities.filter((e) => gone.includes(e.type)).map((e) => e.type), r.id).toEqual([]);
      for (const e of r.entities) if (e.type === 'terminal') expect(e.text ?? '', r.id).not.toMatch(/\{whip\}|WHIP|POGO|DRONE|ENEMY/i);
    }
  });
  it('level 1 has 30 rooms, no bosses, and ends at an exit', () => {
    const rooms = LEVELS[1].rooms;
    expect(rooms).toHaveLength(30);
    expect(rooms[29].exit[2]).toBeGreaterThan(0);
  });
  it('current runs along the floor, a wall or the ceiling, and kills on that side', () => {
    const room = LEVELS[1].rooms.find((r) => r.id === 'l1-07')!;
    expect(currentSide(room, 25, 18)).toBe('right');
    expect(currentSide(room, 12, 21)).toBe('floor');
    const geo = buildGeometry(room, 40);
    const wall = geo.hazards.find((h) => h.x >= 25 * 40 && h.x < 26 * 40 && h.y === 18 * 40)!;
    expect(wall.x).toBeGreaterThan(25 * 40);
    expect(wall.h).toBe(40);
  });
  it('room ids are unique', () => expect(new Set(ROOMS.map((r) => r.id)).size).toBe(ROOMS.length));

  for (const room of ROOMS) {
    describe(room.id, () => {
      it('has valid references', () => expect(validateRoom(room)).toEqual([]));

      it('spawns PKT standing on ground, not inside a wall', () => {
        const geo = buildGeometry(room, 40);
        const [sx, sy] = room.spawn;
        const body = { x: sx * 40 + 9, y: (sy + 1) * 40 - 42, w: 22, h: 42 };
        expect(geo.solids.some((s) => s.active && !s.oneWay && overlaps(body, s))).toBe(false);
        expect(groundUnder(body, geo.solids)).not.toBeNull();
      });

      it('has a reachable end: an exit zone', () => expect(room.exit[2] > 0).toBe(true));

      it('keeps every solid and entity inside the room', () => {
        for (const [x, y, w, h] of room.solids) expect(x >= 0 && y >= 0 && x + w <= room.width && y + h <= room.height, `${room.id} solid ${[x, y, w, h]}`).toBe(true);
        for (const e of room.entities) expect(e.x < room.width && e.y < room.height, `${room.id} ${e.type}`).toBe(true);
      });
    });
  }
});
