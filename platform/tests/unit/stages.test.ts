import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/gameplay/RoomData';
import { checkRoom } from '../../src/gameplay/RoomSolver';
import { hasAbility } from '../../src/gameplay/Abilities';

const l1 = LEVELS[1].rooms;
/** The second half of stage 1 (1-10 on): power, green and longer swings. */
const back = l1.slice(9);
const room = (rooms: typeof l1, id: string) => rooms.find((r) => r.id === id)!;
const has = (rooms: typeof l1, type: string) => rooms.some((r) => r.entities.some((e) => e.type === type));

describe('stage 1 teaches everything', () => {
  it('every cable ability is learnt in stage 1', () => {
    for (const a of ['hack', 'yank', 'swing', 'power'] as const) expect(hasAbility(1, a)).toBe(true);
  });
  it('there is no separate stage 2: stage 1 runs on to 1-30', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['training', 'level1']);
    expect(l1.map((r) => r.id)).toEqual(Array.from({ length: 30 }, (_, i) => `l1-${String(i + 1).padStart(2, '0')}`));
  });
  it('1-7 introduces anchors: rooms 7 to 9 need the anchor, the pull and the yank', () => {
    for (const id of ['l1-07', 'l1-08', 'l1-09']) {
      const r = room(l1, id);
      expect(checkRoom(r, { swing: true }).ok, id).toBe(true);
      for (const m of ['anchor', 'pull', 'yank'] as const) expect(checkRoom(r, { swing: true, disable: [m] }).ok, `${id} without ${m}`).toBe(false);
    }
  });
  it('each mechanic appears in a room', () => {
    for (const t of ['pull', 'data', 'slider', 'gate']) expect(has(l1, t), t).toBe(true);
    expect(l1.some((r) => r.entities.some((e) => e.type === 'slider' && e.yankable)), 'yankable platform').toBe(true);
    for (const t of ['anchor', 'source', 'consumer', 'capacitor', 'lift', 'connector']) expect(has(back, t), t).toBe(true);
  });
  it('1-16 is about true view: neon and white stones take turns, and you need both', () => {
    const r = room(l1, 'l1-16');
    expect(checkRoom(r, { swing: true, white: true }).ok).toBe(true);
    expect(checkRoom(r, { swing: true }).ok, 'without true view').toBe(false);
    expect(checkRoom({ ...r, neon: [] }, { swing: true, white: true }).ok, 'white stones alone').toBe(false);
    expect(r.secret?.length, 'a secret tunnel').toBeGreaterThan(0);
  });
  it('red comes back in 1-15, then 1-17 practises switching between all three colours', () => {
    expect(room(l1, 'l1-15').entities.some((e) => e.type === 'connector' && e.color === 'red')).toBe(true);
    for (const id of ['l1-17']) {
      const r = room(l1, id);
      expect(new Set(r.zones?.map((z) => z.color)), id).toEqual(new Set(['blue', 'green', 'red']));
      expect(new Set(r.trueColor), id).toEqual(new Set(['blue', 'green', 'red']));
      expect(checkRoom(r, { swing: true }).ok, id).toBe(true);
      expect(checkRoom(r, { swing: true, disable: ['colour'] }).ok, `${id} without the lens`).toBe(false);
    }
  });
  it('1-15 hides things for white true view: a secret wall, a chip and its door, a white bridge', () => {
    const r = room(l1, 'l1-15');
    expect(r.secret?.length, 'secret walls').toBeGreaterThan(0);
    expect(r.trueColor?.includes('white'), 'white ledges').toBe(true);
    expect(r.entities.some((e) => e.type === 'chip')).toBe(true);
    const slot = r.entities.find((e) => e.type === 'slot')!;
    expect(r.entities.some((e) => e.type === 'gate' && e.inputs?.includes(slot.id!))).toBe(true);
    // none of it is needed: the room is finished the normal way
    expect(checkRoom(r, { swing: true }).ok).toBe(true);
    // but with true view the white bridge skips the swing
    expect(checkRoom(r, { swing: true, disable: ['anchor'] }).ok).toBe(false);
    expect(checkRoom(r, { swing: true, white: true, disable: ['anchor'] }).ok).toBe(true);
  });
  it('1-18 is a massive no-zone finale: pull, yank, swing, true view, and a chip door', () => {
    const r = room(l1, 'l1-18');
    expect(r.width).toBeGreaterThanOrEqual(200);
    expect(r.zones ?? []).toEqual([]);
    expect(r.secret?.length, 'secret walls').toBeGreaterThan(0);
    expect(r.trueColor?.includes('white'), 'white stones').toBe(true);
    expect(r.neon?.length, 'neon stones').toBeGreaterThan(0);
    expect(r.entities.some((e) => e.type === 'chip')).toBe(true);
    expect(r.entities.some((e) => e.type === 'slider' && e.yankable)).toBe(true);
    const base = { swing: true, white: true };
    expect(checkRoom(r, base).ok).toBe(true);
    expect(checkRoom(r, { swing: true }).ok, 'needs true view').toBe(false);
    for (const m of ['pull', 'yank', 'anchor'] as const) {
      expect(checkRoom(r, { ...base, disable: [m] }).ok, `needs ${m}`).toBe(false);
    }
  });
  it('the practice room teaches both hack and yank', () => {
    // 1-3 PORT AUTHORITY merges the hack and yank lessons into one practice room.
    const r = room(l1, 'l1-03');
    expect(checkRoom(r, {}).ok).toBe(true);
    expect(checkRoom(r, { disable: ['hack'] }).ok).toBe(false);
    expect(checkRoom(r, { disable: ['yank'] }).ok).toBe(false);
  });
  it('the yank graduation room still needs the yank', () => {
    // 1-6 CHAIN OF COMMAND is the spike room that puts yank to work.
    const r = room(l1, 'l1-06');
    expect(checkRoom(r, {}).ok).toBe(true);
    expect(checkRoom(r, { disable: ['yank'] }).ok).toBe(false);
  });
  it('the practice rooms have nothing that can reset you in the way', () => {
    // the hack/yank practice room has no spikes at all; the power and green practice
    // rooms (1-10, 1-11) keep any spikes up out of the traversal path.
    expect(room(l1, 'l1-03').spikes, 'l1-03').toEqual([]);
    for (const r of back.slice(0, 2)) for (const [, y] of r.spikes) expect(y, r.id).toBeLessThan(r.height / 2);
  });
  it('practice comes first: hack and yank are taught before the spike room that needs them', () => {
    const order = l1.map((r) => r.id);
    expect(order.indexOf('l1-03')).toBeLessThan(order.indexOf('l1-06'));
  });
});
