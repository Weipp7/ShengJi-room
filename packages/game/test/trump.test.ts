import { describe, it, expect } from 'vitest';
import type { TrumpContext } from '@shengji/shared';
import { isTrump, effectiveSuit, cardStrength, sortHand } from '../src/trump';
import { c, joker } from './helpers';

const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
const bigJ = joker('big');
const smallJ = joker('small');

describe('isTrump', () => {
  it('jokers, level cards and trump suit are trump', () => {
    expect(isTrump(bigJ, trump)).toBe(true);
    expect(isTrump(smallJ, trump)).toBe(true);
    expect(isTrump(c('S', 2), trump)).toBe(true); // 副花色级牌
    expect(isTrump(c('H', 7), trump)).toBe(true); // 主花色
    expect(isTrump(c('S', 7), trump)).toBe(false);
  });
});

describe('effectiveSuit', () => {
  it('maps trump group to "trump"', () => {
    expect(effectiveSuit(c('S', 2), trump)).toBe('trump');
    expect(effectiveSuit(c('H', 9), trump)).toBe('trump');
    expect(effectiveSuit(bigJ, trump)).toBe('trump');
    expect(effectiveSuit(c('S', 7), trump)).toBe('S');
  });
});

describe('cardStrength', () => {
  it('trump strength order: bigJ > smallJ > trump-level > off-level > trump A > trump low', () => {
    const order = [bigJ, smallJ, c('H', 2), c('S', 2), c('H', 14), c('H', 3)];
    for (let i = 0; i < order.length - 1; i++) {
      expect(cardStrength(order[i], trump)).toBeGreaterThanOrEqual(
        cardStrength(order[i + 1], trump),
      );
    }
    // 两张不同副花色级牌等价
    expect(cardStrength(c('S', 2), trump)).toBe(cardStrength(c('D', 2), trump));
    // 主花色级牌严格高于副花色级牌
    expect(cardStrength(c('H', 2), trump)).toBeGreaterThan(cardStrength(c('S', 2), trump));
  });

  it('off-suit: A high, level card removed from its natural spot', () => {
    expect(cardStrength(c('S', 14), trump)).toBeGreaterThan(cardStrength(c('S', 13), trump));
  });

  it('no-trump round: only jokers and level cards are trump', () => {
    const nt: TrumpContext = { trumpSuit: null, level: 5 };
    expect(isTrump(c('S', 5), nt)).toBe(true);
    expect(isTrump(c('S', 14), nt)).toBe(false);
    // 无主局所有级牌等价
    expect(cardStrength(c('S', 5), nt)).toBe(cardStrength(c('H', 5), nt));
    expect(cardStrength(joker('small'), nt)).toBeGreaterThan(cardStrength(c('S', 5), nt));
  });
});

describe('sortHand', () => {
  it('trump group first, then suits, descending strength within group', () => {
    const hand = [c('D', 3), c('S', 7), bigJ, c('H', 5), c('S', 2)];
    const sorted = sortHand(hand, trump);
    // 主牌区在前：bigJ, S2(级牌), H5
    expect(sorted.slice(0, 3).map((x) => x.id)).toEqual([bigJ.id, c('S', 2).id, c('H', 5).id]);
    // 每组内 strength 递减
    expect(sorted).toHaveLength(5);
  });

  it('does not mutate input', () => {
    const hand = [c('D', 3), bigJ];
    const before = hand.map((x) => x.id);
    sortHand(hand, trump);
    expect(hand.map((x) => x.id)).toEqual(before);
  });
});
