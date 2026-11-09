import { describe, expect, it } from 'vitest';
import { depenetrate, groundUnder, mergeTiles, moveBody, raycast, segmentRect, type Solid } from '../../src/gameplay/physics';

const floor: Solid = { x: 0, y: 100, w: 400, h: 40, active: true };
const wall: Solid = { x: 200, y: 0, w: 40, h: 100, active: true };
const plank: Solid = { x: 0, y: 50, w: 100, h: 10, active: true, oneWay: true };

describe('moveBody', () => {
  it('lands on the floor', () => {
    const b = { x: 10, y: 50, w: 20, h: 40, vx: 0, vy: 0 };
    const r = moveBody(b, 0, 30, [floor]);
    expect(r.hitBottom).toBe(true);
    expect(b.y).toBe(60);
  });

  it('stops at a wall moving right', () => {
    const b = { x: 170, y: 50, w: 20, h: 40, vx: 0, vy: 0 };
    const r = moveBody(b, 20, 0, [wall]);
    expect(r.hitRight).toBe(true);
    expect(b.x).toBe(180);
  });

  it('passes up through one-way platforms and lands on them from above', () => {
    const b = { x: 10, y: 60, w: 20, h: 20, vx: 0, vy: 0 };
    moveBody(b, 0, -30, [plank]);
    expect(b.y).toBe(30);
    const r = moveBody(b, 0, 10, [plank]);
    expect(r.hitBottom).toBe(true);
    expect(b.y).toBe(30);
  });

  it('drops through one-way platforms on request', () => {
    const b = { x: 10, y: 30, w: 20, h: 20, vx: 0, vy: 0 };
    const r = moveBody(b, 0, 5, [plank], true);
    expect(r.hitBottom).toBe(false);
  });

  it('ignores inactive solids', () => {
    const b = { x: 10, y: 50, w: 20, h: 40, vx: 0, vy: 0 };
    moveBody(b, 0, 30, [{ ...floor, active: false }]);
    expect(b.y).toBe(80);
  });
});

describe('queries', () => {
  it('detects ground under a body', () => {
    expect(groundUnder({ x: 10, y: 60, w: 20, h: 40 }, [floor])).toBe(floor);
    expect(groundUnder({ x: 10, y: 40, w: 20, h: 40 }, [floor])).toBeNull();
  });

  it('raycasts to the first blocking solid', () => {
    const t = raycast(0, 50, 400, 50, [wall]);
    expect(t).toBeCloseTo(0.5);
    expect(segmentRect(0, 0, 10, 0, wall)).toBe(-1);
  });

  it('depenetrates along the shallowest axis', () => {
    const b = { x: 10, y: 95, w: 20, h: 10 };
    depenetrate(b, [floor]);
    expect(b.y).toBe(90);
  });

  it('greedy-merges tiles', () => {
    const g = [
      [true, true, false],
      [true, true, false],
      [false, false, true],
    ];
    const rects = mergeTiles(g);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });
});
