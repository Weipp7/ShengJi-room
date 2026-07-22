import type { Rng } from '@shengji/game';

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRng(seed: string): Rng {
  let t = hashSeed(seed);
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRngFromEnv(env: NodeJS.ProcessEnv = process.env): Rng | undefined {
  return env.SHENGJI_TEST_SEED ? seededRng(env.SHENGJI_TEST_SEED) : undefined;
}

export function botDelayFromEnv(env: NodeJS.ProcessEnv = process.env): ((settling: boolean) => number) | undefined {
  if (env.SHENGJI_BOT_DELAY_MS === undefined) return undefined;
  const delay = Math.max(0, Number(env.SHENGJI_BOT_DELAY_MS));
  return () => delay;
}
