/**
 * Cable abilities. Stage 1 teaches them all: the jack and zip ports, then hacking (data
 * ports open gates), yanking (tether to a platform's port and drive it), swinging on
 * anchors from 1-7 and carrying power from 1-10. Training Grounds has everything.
 */
export type Ability = 'swing' | 'power' | 'hack' | 'yank';

/** Level index (0 = training) at which each ability becomes available. */
const UNLOCK: Record<Ability, number> = { hack: 1, yank: 1, swing: 1, power: 1 };

export function hasAbility(levelIndex: number, a: Ability): boolean {
  return levelIndex === 0 || levelIndex >= UNLOCK[a];
}
