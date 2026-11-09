import { describe, expect, it } from 'vitest';
import { Bindings, DEFAULT_KEYS, DEFAULT_PAD, PAD, PadCapture, keyLabel, padLabel, type Store } from '../../src/core/Bindings';

function memStore(init: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

const allKeys = (b: Bindings) => Object.values(b.keys).flat().filter((k) => k !== null);

describe('bindings', () => {
  it('starts from the defaults', () => {
    const b = new Bindings(memStore());
    expect(b.keys).toEqual(DEFAULT_KEYS);
    expect(b.pad).toEqual(DEFAULT_PAD);
  });

  it('binds a free key and saves it', () => {
    const store = memStore();
    const b = new Bindings(store);
    expect(b.bindKey('jump', 0, 'KeyJ').ok).toBe(true);
    expect(b.keys.jump).toEqual(['KeyJ', 'Space']);
    expect(new Bindings(store).keys.jump).toEqual(['KeyJ', 'Space']);
  });

  it('swaps when the key belongs to another action', () => {
    const b = new Bindings(memStore());
    const r = b.bindKey('jump', 0, 'KeyV');
    expect(r).toEqual({ ok: true, swapped: { action: 'dash', slot: 0 } });
    expect(b.keys.jump[0]).toBe('KeyV');
    expect(b.keys.dash[0]).toBe('KeyZ');
    expect(new Set(allKeys(b)).size).toBe(allKeys(b).length);
  });

  it('refuses to leave another action with no key', () => {
    const b = new Bindings(memStore());
    const r = b.bindKey('dash', 1, 'KeyC');
    expect(r.ok).toBe(false);
    expect(b.keys.jack[0]).toBe('KeyC');
  });

  it('taking a backup from another action promotes nothing it needs', () => {
    const b = new Bindings(memStore());
    expect(b.bindKey('dash', 1, 'Space').ok).toBe(true);
    expect(b.keys.jump).toEqual(['KeyZ', null]);
    expect(b.keys.dash).toEqual(['KeyV', 'Space']);
  });

  it('rejects reserved keys', () => {
    const b = new Bindings(memStore());
    const r = b.bindKey('jump', 0, 'KeyM');
    expect(r.ok).toBe(false);
    expect(b.keys.jump[0]).toBe('KeyZ');
  });

  it('clears only backup slots', () => {
    const b = new Bindings(memStore());
    expect(b.clearKey('jump', 0)).toBe(false);
    expect(b.clearKey('jump', 1)).toBe(true);
    expect(b.keys.jump).toEqual(['KeyZ', null]);
  });

  it('reset restores the defaults', () => {
    const b = new Bindings(memStore());
    b.bindKey('jump', 0, 'KeyJ');
    b.resetKeys();
    expect(b.keys).toEqual(DEFAULT_KEYS);
  });

  it('survives a corrupt or hostile save', () => {
    expect(new Bindings(memStore({ 'null_route.controls.v1': '{not json' })).keys).toEqual(DEFAULT_KEYS);
    const dupes = JSON.stringify({ keys: { jump: ['KeyX', null], jack: ['KeyX', null], dash: ['KeyM', null] }, pad: { jump: [999, null] } });
    const b = new Bindings(memStore({ 'null_route.controls.v1': dupes }));
    expect(b.keys.jump[0]).toBe('KeyX');
    expect(b.keys.jack).toEqual(DEFAULT_KEYS.jack);
    expect(b.keys.dash).toEqual(DEFAULT_KEYS.dash);
    expect(b.pad.jump).toEqual(DEFAULT_PAD.jump);
  });

  it('remaps gamepad buttons with the same swap rule', () => {
    const b = new Bindings(memStore());
    expect(b.bindPad('jump', 0, PAD.b)).toEqual({ ok: true, swapped: { action: 'dash', slot: 0 } });
    expect(b.pad.dash[0]).toBe(PAD.a);
  });

  it('labels keys and buttons', () => {
    expect(keyLabel('KeyZ')).toBe('Z');
    expect(keyLabel('ArrowLeft')).toBe('LEFT');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel(null)).toBe('--');
    expect(padLabel(PAD.rt)).toBe('RT');
  });

  it('fills {action} tokens in text, with {recall} as the jack key', () => {
    const b = new Bindings(memStore());
    expect(b.fill('HOLD {jack} TO SWING. {recall} TO RECALL. {nope}')).toBe('HOLD C TO SWING. C TO RECALL. {nope}');
    b.bindKey('jack', 0, 'KeyJ');
    expect(b.fill('HOLD {jack}')).toBe('HOLD J');
  });

  it('ignores a recall binding left in an old save', () => {
    const old = JSON.stringify({ keys: { recall: ['KeyA', null], jump: ['KeyA', null] } });
    expect(new Bindings(memStore({ 'null_route.controls.v1': old })).keys.jump[0]).toBe('KeyA');
  });

  it('summary follows the bindings', () => {
    const b = new Bindings(memStore());
    expect(b.summary()).toContain('Z JUMP');
    b.bindKey('jump', 0, 'KeyJ');
    expect(b.summary()).toContain('J JUMP');
  });
});

describe('pad capture', () => {
  const pad = (down: number[]) => [{ connected: true, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: 0 })) }] as unknown as Gamepad[];

  it('reports the first newly pressed button, ignoring ones already held', () => {
    let state = pad([PAD.a]);
    const cap = new PadCapture(() => state);
    cap.arm();
    expect(cap.poll()).toBeNull();
    state = pad([PAD.a, PAD.x]);
    expect(cap.poll()).toBe(PAD.x);
    expect(cap.poll()).toBeNull();
  });
});
