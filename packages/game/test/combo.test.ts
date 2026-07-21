import { describe, it, expect } from 'vitest';
import type { TrumpContext } from '@shengji/shared';
import { detectCombo, isSameFace, findPairs, findTractors } from '../src/combo';
import { c, joker } from './helpers';

const trump: TrumpContext = { trumpSuit: 'H', level: 2 };

describe('isSameFace', () => {
  it('same suit+rank different copies match', () => {
    expect(isSameFace(c('S', 5, 0), c('S', 5, 1))).toBe(true);
    expect(isSameFace(c('S', 5, 0), c('D', 5, 0))).toBe(false);
    expect(isSameFace(joker('big', 0), joker('big', 1))).toBe(true);
    expect(isSameFace(joker('big', 0), joker('small', 0))).toBe(false);
  });
});

describe('detectCombo', () => {
  it('single & pair', () => {
    expect(detectCombo([c('S', 5, 0)], trump)?.type).toBe('single');
    expect(detectCombo([c('S', 5, 0), c('S', 5, 1)], trump)?.type).toBe('pair');
    expect(detectCombo([c('S', 5, 0), c('D', 5, 0)], trump)).toBeNull(); // 不同花色非对
  });

  it('tractor of two adjacent pairs', () => {
    const combo = detectCombo([c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1)], trump);
    expect(combo?.type).toBe('tractor');
    expect(combo?.cards).toHaveLength(4);
  });

  it('level gap makes pairs adjacent', () => {
    const t4: TrumpContext = { trumpSuit: 'H', level: 4 };
    // level=4 时 4 被抽走，S3 对 + S5 对相邻
    expect(
      detectCombo([c('S', 3, 0), c('S', 3, 1), c('S', 5, 0), c('S', 5, 1)], t4)?.type,
    ).toBe('tractor');
  });

  it('non-adjacent pairs are not tractor', () => {
    expect(detectCombo([c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)], trump)).toBeNull();
  });

  it('jokers: big pair + small pair form trump tractor', () => {
    const cards = [joker('big', 0), joker('big', 1), joker('small', 0), joker('small', 1)];
    expect(detectCombo(cards, trump)?.type).toBe('tractor');
  });

  it('trump level pair chains with small joker pair', () => {
    // 主牌序：…主A < 副级牌 < 主级牌 < 小王 < 大王；主级牌对与小王对之间无阻隔 → 拖拉机
    const cards = [c('H', 2, 0), c('H', 2, 1), joker('small', 0), joker('small', 1)];
    expect(detectCombo(cards, trump)?.type).toBe('tractor');
  });

  it('trump A pair does NOT chain with trump level pair (off-level blocks)', () => {
    const cards = [c('H', 14, 0), c('H', 14, 1), c('H', 2, 0), c('H', 2, 1)];
    expect(detectCombo(cards, trump)).toBeNull();
  });

  it('off-suit level pair does NOT chain into tractor', () => {
    // 主花色 A 对 + 副花色级牌对 → null
    expect(
      detectCombo([c('H', 14, 0), c('H', 14, 1), c('S', 2, 0), c('S', 2, 1)], trump),
    ).toBeNull();
  });

  it('mixed suits rejected', () => {
    expect(detectCombo([c('S', 5, 0), c('D', 6, 0)], trump)).toBeNull();
    expect(detectCombo([], trump)).toBeNull();
  });

  it('three cards is not a combo (no thirds in two decks beyond pairs)', () => {
    expect(detectCombo([c('S', 5, 0), c('S', 5, 1), c('S', 6, 0)], trump)).toBeNull();
  });
});

describe('findPairs / findTractors', () => {
  it('finds all pairs in a suit subset', () => {
    const cards = [c('S', 5, 0), c('S', 5, 1), c('S', 9, 0), c('S', 9, 1), c('S', 3, 0)];
    const pairs = findPairs(cards, trump);
    expect(pairs).toHaveLength(2);
  });

  it('finds tractors of given pair length', () => {
    const cards = [c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1), c('S', 7, 0), c('S', 7, 1)];
    expect(findTractors(cards, trump, 2).length).toBeGreaterThan(0);
    expect(findTractors(cards, trump, 3)).toHaveLength(1);
    expect(findTractors(cards, trump, 4)).toHaveLength(0);
  });
});
