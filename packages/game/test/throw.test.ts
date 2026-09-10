import { describe, expect, it } from 'vitest';
import type { Card, TrumpContext } from '@shengji/shared';
import { decomposeThrowCards, evaluateThrowLead } from '../src/throw';
import { c } from './helpers';

const trump: TrumpContext = { trumpSuit: 'H', level: 2 };

function ids(cards: Card[]): string[] {
  return cards.map((card) => card.id);
}

describe('decomposeThrowCards', () => {
  it('takes the longest tractor before pairs and singles', () => {
    const threePairTractor = [
      c('S', 14, 0), c('S', 14, 1),
      c('S', 13, 0), c('S', 13, 1),
      c('S', 12, 0), c('S', 12, 1),
    ];
    expect(decomposeThrowCards(threePairTractor, trump)?.map((part) => [part.type, part.cards.length])).toEqual([
      ['tractor', 6],
    ]);

    const tractorAndPair = [
      c('S', 14, 0), c('S', 14, 1),
      c('S', 13, 0), c('S', 13, 1),
      c('S', 11, 0), c('S', 11, 1),
    ];
    expect(decomposeThrowCards(tractorAndPair, trump)?.map((part) => [part.type, part.cards.length])).toEqual([
      ['tractor', 4],
      ['pair', 2],
    ]);

    const mixed = [...tractorAndPair, c('S', 12, 0)];
    expect(decomposeThrowCards(mixed, trump)?.map((part) => [part.type, part.cards.length])).toEqual([
      ['tractor', 4],
      ['pair', 2],
      ['single', 1],
    ]);
  });

  it('rejects cards from different effective suits', () => {
    expect(decomposeThrowCards([c('S', 14, 0), c('D', 14, 0)], trump)).toBeNull();
  });
});

describe('evaluateThrowLead', () => {
  it('accepts a mixed single and pair throw when no other hand can beat a component', () => {
    const attempt = [c('S', 14, 0), c('S', 14, 1), c('S', 13, 0)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [c('S', 12, 0)], [c('S', 10, 0), c('S', 10, 1)], [c('H', 14, 0)]],
      trump,
    });

    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.combo).toMatchObject({ type: 'throw', suit: 'S', strength: 14 });
      expect(result.combo.components?.map((part) => part.type)).toEqual(['pair', 'single']);
      expect(result.event).toMatchObject({ success: true, penaltyPoints: 0, n: 2 });
    }
  });

  it('allows a throw made entirely of single cards', () => {
    const attempt = [c('S', 14, 0), c('S', 13, 0), c('S', 12, 0)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [c('S', 11, 0)], [c('D', 14, 0)], [c('H', 14, 0)]],
      trump,
    });
    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.combo.components?.every((part) => part.type === 'single')).toBe(true);
    }
  });

  it('penalizes only the larger failed shape and forces that component', () => {
    const attempt = [c('S', 9, 0), c('S', 9, 1), c('S', 5, 0)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [
        attempt,
        [c('S', 10, 0), c('S', 10, 1)],
        [c('S', 14, 0)],
        [],
      ],
      trump,
    });

    expect(result.type).toBe('failure');
    if (result.type === 'failure') {
      expect(ids(result.actualCards)).toEqual(['S-9-0', 'S-9-1']);
      expect(result.event).toMatchObject({
        success: false,
        penaltyPoints: 40,
        beneficiaryTeam: 1,
        reason: 'beatable-component',
      });
      expect(ids(result.event.challengedCards)).toEqual(['S-9-0', 'S-9-1']);
    }
  });

  it('penalizes 20 points when the selected failed component is a single', () => {
    const attempt = [c('S', 14, 0), c('S', 9, 0)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [c('S', 10, 0)], [], []],
      trump,
    });
    expect(result.type).toBe('failure');
    if (result.type === 'failure') {
      expect(ids(result.actualCards)).toEqual(['S-9-0']);
      expect(result.event.penaltyPoints).toBe(20);
    }
  });

  it('penalizes a failed tractor by its full card count', () => {
    const attempt = [
      c('S', 5, 0), c('S', 5, 1),
      c('S', 6, 0), c('S', 6, 1),
      c('S', 14, 0),
    ];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [
        attempt,
        [c('S', 7, 0), c('S', 7, 1), c('S', 8, 0), c('S', 8, 1)],
        [],
        [],
      ],
      trump,
    });
    expect(result.type).toBe('failure');
    if (result.type === 'failure') {
      expect(result.combo).toMatchObject({ type: 'tractor' });
      expect(result.actualCards).toHaveLength(4);
      expect(result.event.penaltyPoints).toBe(80);
    }
  });

  it('checks the thrower teammate as well as both opponents', () => {
    const attempt = [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [], [c('S', 9, 0), c('S', 9, 1)], []],
      trump,
    });
    expect(result.type).toBe('failure');
    if (result.type === 'failure') expect(result.event.penaltyPoints).toBe(40);
  });

  it('does not let an off-suit trump pair invalidate a side-suit throw', () => {
    const attempt = [c('S', 8, 0), c('S', 8, 1), c('S', 11, 0), c('S', 11, 1)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [c('H', 14, 0), c('H', 14, 1)], [], []],
      trump,
    });
    expect(result.type).toBe('success');
  });

  it('does not combine pairs from different hands into a tractor challenge', () => {
    const attempt = [
      c('S', 5, 0), c('S', 5, 1),
      c('S', 6, 0), c('S', 6, 1),
      c('S', 14, 0),
    ];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [c('S', 7, 0), c('S', 7, 1)], [c('S', 8, 0), c('S', 8, 1)], []],
      trump,
    });
    expect(result.type).toBe('success');
  });

  it('forces the smaller component when equal-size failed shapes exist', () => {
    const attempt = [c('S', 5, 0), c('S', 8, 0)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [attempt, [c('S', 9, 0)], [], []],
      trump,
    });
    expect(result.type).toBe('failure');
    if (result.type === 'failure') expect(ids(result.actualCards)).toEqual(['S-5-0']);
  });
});
