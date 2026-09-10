import { describe, expect, it } from 'vitest';
import {
  availableBids,
  bidBeats,
  detectBid,
  pairBidStrength,
  trumpSuitOfBid,
} from '../src/bidding';
import { c, joker } from './helpers';

describe('detectBid', () => {
  it('accepts one or two identical suit level cards', () => {
    expect(detectBid([c('S', 2, 0)], 2, 1)).toMatchObject({
      seat: 1,
      kind: 'suit-single',
      suit: 'S',
    });
    expect(detectBid([c('D', 2, 0), c('D', 2, 1)], 2, 0)).toMatchObject({
      kind: 'suit-pair',
      suit: 'D',
    });
  });

  it('accepts joker pairs as no-trump bids', () => {
    expect(detectBid([joker('small', 0), joker('small', 1)], 2, 0)).toMatchObject({
      kind: 'small-joker-pair',
      suit: null,
    });
    expect(detectBid([joker('big', 0), joker('big', 1)], 2, 0)).toMatchObject({
      kind: 'big-joker-pair',
      suit: null,
    });
  });

  it('rejects single jokers, three-card declarations and mixed cards', () => {
    expect(detectBid([joker('small', 0)], 2, 0)).toBeNull();
    expect(detectBid([joker('big', 0)], 2, 0)).toBeNull();
    expect(detectBid([c('S', 2, 0), c('S', 2, 1), c('S', 2, 2)], 2, 0)).toBeNull();
    expect(detectBid([c('S', 2, 0), c('D', 2, 0)], 2, 0)).toBeNull();
    expect(detectBid([joker('small', 0), joker('big', 0)], 2, 0)).toBeNull();
    expect(detectBid([c('S', 5, 0)], 2, 0)).toBeNull();
  });
});

describe('bidBeats', () => {
  const singleS = detectBid([c('S', 2, 0)], 2, 0)!;
  const pairD = detectBid([c('D', 2, 0), c('D', 2, 1)], 2, 0)!;
  const pairC = detectBid([c('C', 2, 0), c('C', 2, 1)], 2, 1)!;
  const pairH = detectBid([c('H', 2, 0), c('H', 2, 1)], 2, 2)!;
  const pairS = detectBid([c('S', 2, 0), c('S', 2, 1)], 2, 3)!;
  const smallPair = detectBid([joker('small', 0), joker('small', 1)], 2, 0)!;
  const bigPair = detectBid([joker('big', 0), joker('big', 1)], 2, 1)!;

  it('allows any valid opening bid', () => {
    expect(bidBeats(singleS, null)).toBe(true);
    expect(bidBeats(pairD, null)).toBe(true);
  });

  it('allows only a pair to counter a single declaration', () => {
    expect(bidBeats(pairD, singleS)).toBe(true);
    expect(bidBeats(detectBid([c('H', 2, 0)], 2, 1)!, singleS)).toBe(false);
  });

  it('uses big joker > small joker > S > H > C > D for pair counters', () => {
    const ordered = [pairD, pairC, pairH, pairS, smallPair, bigPair];
    expect(ordered.map(pairBidStrength)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < ordered.length; i++) {
      expect(bidBeats(ordered[i], ordered[i - 1])).toBe(true);
      expect(bidBeats(ordered[i - 1], ordered[i])).toBe(false);
    }
  });

  it('rejects equal-strength pair counters', () => {
    expect(bidBeats(pairH, pairH)).toBe(false);
  });
});

describe('availableBids', () => {
  it('lists opening singles/pairs but never a single joker', () => {
    const hand = [
      c('S', 2, 0),
      c('D', 2, 0),
      c('D', 2, 1),
      joker('small', 0),
      joker('big', 0),
      joker('big', 1),
    ];
    const bids = availableBids(hand, 2, null);
    expect(bids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'suit-single', suit: 'S' }),
        expect.objectContaining({ kind: 'suit-pair', suit: 'D' }),
        expect.objectContaining({ kind: 'big-joker-pair', suit: null }),
      ]),
    );
    expect(bids.some((bid) => bid.kind.startsWith('small-joker'))).toBe(false);
  });

  it('filters pair counters by the fixed suit hierarchy', () => {
    const current = detectBid([c('H', 2, 0), c('H', 2, 1)], 2, 3)!;
    const hand = [
      c('D', 2, 0), c('D', 2, 1),
      c('S', 2, 0), c('S', 2, 1),
      joker('small', 0), joker('small', 1),
    ];
    const bids = availableBids(hand, 2, current);
    expect(bids.map((bid) => bid.kind)).toEqual(['suit-pair', 'small-joker-pair']);
    expect(bids.find((bid) => bid.kind === 'suit-pair')?.suit).toBe('S');
  });

  it('counterOnly suppresses opening singles even without a current bid', () => {
    const bids = availableBids(
      [c('S', 2, 0), c('D', 2, 0), c('D', 2, 1)],
      2,
      null,
      { counterOnly: true },
    );
    expect(bids).toHaveLength(1);
    expect(bids[0]).toMatchObject({ kind: 'suit-pair', suit: 'D' });
  });
});

describe('trumpSuitOfBid', () => {
  it('uses suit declarations as trump and joker pairs as no-trump', () => {
    expect(trumpSuitOfBid(detectBid([c('H', 2, 0)], 2, 0)!)).toBe('H');
    expect(trumpSuitOfBid(detectBid([joker('big', 0), joker('big', 1)], 2, 0)!)).toBeNull();
  });
});
