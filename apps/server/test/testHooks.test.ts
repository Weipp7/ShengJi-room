import { describe, expect, it } from 'vitest';
import { botDelayFromEnv, seededRng, seededRngFromEnv } from '../src/testHooks';

describe('test hooks', () => {
  it('creates repeatable random streams from the same seed', () => {
    const a = seededRng('iter-002');
    const b = seededRng('iter-002');

    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('keeps production rng undefined without a seed', () => {
    expect(seededRngFromEnv({})).toBeUndefined();
  });

  it('creates fixed bot delays from env', () => {
    const delay = botDelayFromEnv({ SHENGJI_BOT_DELAY_MS: '25' });

    expect(delay?.(false)).toBe(25);
    expect(delay?.(true)).toBe(25);
  });
});
