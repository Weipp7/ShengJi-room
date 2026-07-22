import { describe, it, expect } from 'vitest';
import { detectBid, bidBeats, trumpSuitOfBid, availableBids } from '../src/bidding';
import { c, joker } from './helpers';

describe('detectBid', () => {
  it('single level card is a valid bid', () => {
    const bid = detectBid([c('S', 2, 0)], 2, 1);
    expect(bid).toMatchObject({ seat: 1, kind: 'suit-single', suit: 'S' });
  });

  it('pair of level cards is suit-pair', () => {
    const bid = detectBid([c('D', 2, 0), c('D', 2, 1)], 2, 0);
    expect(bid).toMatchObject({ kind: 'suit-pair', suit: 'D' });
  });

  it('joker pairs detected; suit is null (no-trump)', () => {
    expect(detectBid([joker('small', 0), joker('small', 1)], 2, 0)).toMatchObject({
      kind: 'small-joker-pair',
      suit: null,
    });
    expect(detectBid([joker('big', 0), joker('big', 1)], 2, 0)).toMatchObject({
      kind: 'big-joker-pair',
      suit: null,
    });
  });

  it('single jokers are valid no-trump bids', () => {
    expect(detectBid([joker('small', 0)], 2, 0)).toMatchObject({
      kind: 'small-joker-single',
      suit: null,
    });
    expect(detectBid([joker('big', 0)], 2, 0)).toMatchObject({
      kind: 'big-joker-single',
      suit: null,
    });
  });

  it('three or more matching level cards are valid suit bids', () => {
    const bid = detectBid([c('S', 2, 0), c('S', 2, 1), c('S', 2, 2)], 2, 1);
    expect(bid).toMatchObject({ seat: 1, kind: 'suit-multiple', suit: 'S' });
    expect(bid?.cards).toHaveLength(3);
  });

  it('non-level card is not a bid', () => {
    expect(detectBid([c('S', 5, 0)], 2, 0)).toBeNull();
    expect(detectBid([c('S', 2, 0), c('D', 2, 0)], 2, 0)).toBeNull();
    expect(detectBid([joker('small', 0), joker('big', 0)], 2, 0)).toBeNull();
  });
});

describe('bidBeats', () => {
  const single = detectBid([c('S', 2, 0)], 2, 0)!;
  const singleD = detectBid([c('D', 2, 0)], 2, 1)!;
  const pair = detectBid([c('D', 2, 0), c('D', 2, 1)], 2, 1)!;
  const smallSingle = detectBid([joker('small', 0)], 2, 2)!;
  const bigSingle = detectBid([joker('big', 0)], 2, 3)!;
  const smallPair = detectBid([joker('small', 0), joker('small', 1)], 2, 2)!;
  const bigPair = detectBid([joker('big', 0), joker('big', 1)], 2, 3)!;
  const triple = detectBid([c('S', 2, 0), c('S', 2, 1), c('S', 2, 2)], 2, 0)!;

  it('any bid beats null', () => {
    expect(bidBeats(single, null)).toBe(true);
  });

  it('strength order keeps card count first, then suit < small joker < big joker', () => {
    expect(bidBeats(smallSingle, single)).toBe(true);
    expect(bidBeats(bigSingle, smallSingle)).toBe(true);
    expect(bidBeats(pair, single)).toBe(true);
    expect(bidBeats(pair, bigSingle)).toBe(true);
    expect(bidBeats(smallPair, pair)).toBe(true);
    expect(bidBeats(bigPair, smallPair)).toBe(true);
    expect(bidBeats(triple, bigPair)).toBe(true);
    expect(bidBeats(single, pair)).toBe(false);
  });

  it('same-strength different suit cannot overcall', () => {
    expect(bidBeats(singleD, single)).toBe(false);
    expect(bidBeats(smallPair, smallPair)).toBe(false);
  });
});

describe('trumpSuitOfBid', () => {
  it('suit bids give trump suit; joker pairs give null (no-trump)', () => {
    expect(trumpSuitOfBid(detectBid([c('H', 2, 0)], 2, 0)!)).toBe('H');
    expect(trumpSuitOfBid(detectBid([joker('small', 0)], 2, 0)!)).toBeNull();
    expect(trumpSuitOfBid(detectBid([joker('big', 0), joker('big', 1)], 2, 0)!)).toBeNull();
  });
});

describe('availableBids', () => {
  it('lists strongest bid per option: suit pair over single, joker pairs for NT', () => {
    const hand = [
      c('S', 2, 0),
      c('D', 2, 0),
      c('D', 2, 1),
      c('H', 5, 0),
      joker('big', 0),
      joker('big', 1),
    ];
    const bids = availableBids(hand, 2, null);
    const byKey = new Map(bids.map((b) => [b.suit ?? 'NT', b]));
    expect(byKey.get('S')).toMatchObject({ kind: 'suit-single' });
    expect(byKey.get('D')).toMatchObject({ kind: 'suit-pair' });
    expect(byKey.get('NT')).toMatchObject({ kind: 'big-joker-pair' });
    expect(byKey.has('H')).toBe(false); // 无级牌不可叫
    expect(byKey.get('D')!.cards).toHaveLength(2);
  });

  it('filters bids that cannot beat the current bid', () => {
    const current = detectBid([c('H', 2, 0), c('H', 2, 1)], 2, 3)!; // 对级牌
    const hand = [c('S', 2, 0), joker('small', 0), joker('small', 1)];
    const bids = availableBids(hand, 2, current);
    // 单张级牌压不过对；小王对可反
    expect(bids).toHaveLength(1);
    expect(bids[0]).toMatchObject({ kind: 'small-joker-pair', suit: null });
  });

  it('empty when nothing beats current big joker pair', () => {
    const current = detectBid([joker('big', 0), joker('big', 1)], 2, 0)!;
    const hand = [c('S', 2, 0), c('S', 2, 1), joker('small', 0), joker('small', 1)];
    expect(availableBids(hand, 2, current)).toHaveLength(0);
  });

  it('uses all matching cards for arbitrary-count suit bids', () => {
    const hand = [c('S', 2, 0), c('S', 2, 1), c('S', 2, 2), c('D', 2, 0)];
    const bids = availableBids(hand, 2, null);
    const spades = bids.find((b) => b.suit === 'S');
    expect(spades).toMatchObject({ kind: 'suit-multiple' });
    expect(spades?.cards).toHaveLength(3);
  });

  it('lists a single big joker as a no-trump counter over a single small joker', () => {
    const current = detectBid([joker('small', 0)], 2, 0)!;
    const bids = availableBids([joker('big', 0)], 2, current);
    expect(bids).toHaveLength(1);
    expect(bids[0]).toMatchObject({ kind: 'big-joker-single', suit: null });
  });
});
