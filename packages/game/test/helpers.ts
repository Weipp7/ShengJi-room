import type { Card, Rank, Suit } from '@shengji/shared';
import type { Rng } from '../src/deck';

// 确定性种子随机数，供测试复现
export const mulberry32 = (seed: number): Rng => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 造牌工具：copy 为两副牌中的副本序号
export const c = (suit: Suit, rank: Rank, copy = 0): Card => ({
  id: `${suit}-${rank}-${copy}`,
  kind: 'suit',
  suit,
  rank,
});

export const joker = (which: 'small' | 'big', copy = 0): Card => ({
  id: `joker-${which}-${copy}`,
  kind: 'joker',
  joker: which,
});
