import { describe, expect, it } from 'vitest';
import { PowerGraph } from '../../src/gameplay/PowerGraph';

const tuning = { capacitorChargeTime: 1, capacitorHold: 10 };

describe('PowerGraph', () => {
  it('powers a consumer only while plugged', () => {
    const g = new PowerGraph(tuning);
    g.add('c1', 'consumer');
    expect(g.evaluate(['c1'])).toBe(false);
    g.setPlugged('c1', true);
    expect(g.evaluate(['c1'])).toBe(true);
    g.setPlugged('c1', false);
    expect(g.evaluate(['c1'])).toBe(false);
  });

  it('supports inverted and all-of devices', () => {
    const g = new PowerGraph(tuning);
    g.add('a', 'toggle');
    g.add('b', 'toggle');
    expect(g.evaluate(['a'], 'any', true)).toBe(true);
    g.toggle('a');
    expect(g.evaluate(['a', 'b'], 'all')).toBe(false);
    g.toggle('b');
    expect(g.evaluate(['a', 'b'], 'all')).toBe(true);
  });

  it('capacitor only outputs after unplugging, proportional to charge', () => {
    const g = new PowerGraph(tuning);
    g.add('cap', 'capacitor');
    g.setPlugged('cap', true);
    g.update(0.5);
    expect(g.isOn('cap')).toBe(false);
    expect(g.level('cap')).toBeCloseTo(0.5);
    g.update(1);
    g.setPlugged('cap', false);
    g.update(0.01);
    expect(g.isOn('cap')).toBe(true);
    g.update(9.5);
    expect(g.isOn('cap')).toBe(true);
    g.update(0.6);
    expect(g.isOn('cap')).toBe(false);
  });

  it('sources are always on', () => {
    const g = new PowerGraph(tuning);
    g.add('s', 'source');
    expect(g.isOn('s')).toBe(true);
  });
});
