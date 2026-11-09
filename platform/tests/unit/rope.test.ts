import { describe, expect, it } from 'vitest';
import { Rope } from '../../src/gameplay/Rope';

describe('Rope', () => {
  it('keeps its ends pinned', () => {
    const r = new Rope(12, 0, 0);
    for (let i = 0; i < 60; i++) r.step(1 / 60, 0, 0, 100, 0, 150);
    expect(r.xs[0]).toBe(0);
    expect(r.xs[11]).toBe(100);
  });

  it('sags when slack and goes taut when stretched', () => {
    const r = new Rope(12, 0, 0);
    for (let i = 0; i < 120; i++) r.step(1 / 60, 0, 0, 100, 0, 200);
    expect(r.ys[6]).toBeGreaterThan(20);
    for (let i = 0; i < 120; i++) r.step(1 / 60, 0, 0, 300, 0, 200);
    expect(Math.abs(r.ys[6])).toBeLessThan(8);
    expect(r.length()).toBeGreaterThan(295);
  });
});
