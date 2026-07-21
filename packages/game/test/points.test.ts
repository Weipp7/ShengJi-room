import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '@shengji/shared';
import { buildDeck } from '../src/deck';
import { cardPoints, countPoints } from '../src/points';

const c = (suit: Suit, rank: Rank): Card => ({ id: `${suit}-${rank}-0`, kind: 'suit', suit, rank });

describe('cardPoints', () => {
  it('5 is worth 5', () => expect(cardPoints(c('S', 5))).toBe(5));
  it('10 is worth 10', () => expect(cardPoints(c('H', 10))).toBe(10));
  it('K is worth 10', () => expect(cardPoints(c('D', 13))).toBe(10));
  it('A is worth 0', () => expect(cardPoints(c('C', 14))).toBe(0));
  it('joker is worth 0', () =>
    expect(cardPoints({ id: 'joker-big-0', kind: 'joker', joker: 'big' })).toBe(0));
});

describe('countPoints', () => {
  it('total deck points = 200', () => expect(countPoints(buildDeck())).toBe(200));
  it('empty is 0', () => expect(countPoints([])).toBe(0));
});
