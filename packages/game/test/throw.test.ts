import { describe, expect, it } from 'vitest';
import type { TrumpContext } from '@shengji/shared';
import { evaluateThrowLead } from '../src/throw';
import { c } from './helpers';

const trump: TrumpContext = { trumpSuit: 'H', level: 2 };

describe('evaluateThrowLead', () => {
  it('accepts a same-suit non-tractor pair throw when nobody can beat any pair', () => {
    const attempt = [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)];
    const hand = [...attempt, c('D', 3, 0)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand,
      hands: [
        hand,
        [c('S', 4, 0), c('S', 4, 1), c('D', 3, 1)],
        [c('S', 7, 0), c('C', 8, 0)],
        [c('D', 9, 0), c('D', 9, 1)],
      ],
      trump,
    });

    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.combo).toMatchObject({ type: 'throw-pairs', suit: 'S' });
      expect(result.combo.cards.map((card) => card.id)).toEqual(attempt.map((card) => card.id));
      expect(result.event).toMatchObject({
        seat: 0,
        success: true,
        n: 2,
        penaltyPoints: 0,
        beneficiaryTeam: null,
      });
    }
  });

  it('fails when an opponent can beat the lowest thrown pair with a larger same-suit pair', () => {
    const attempt = [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [
        attempt,
        [c('S', 6, 0), c('S', 6, 1)],
        [c('S', 3, 0), c('S', 3, 1)],
        [c('D', 9, 0), c('D', 9, 1)],
      ],
      trump,
    });

    expect(result.type).toBe('failure');
    if (result.type === 'failure') {
      expect(result.combo).toMatchObject({ type: 'pair', suit: 'S' });
      expect(result.actualCards.map((card) => card.id)).toEqual(['S-5-0', 'S-5-1']);
      expect(result.event).toMatchObject({
        seat: 0,
        success: false,
        n: 2,
        penaltyPoints: 40,
        beneficiaryTeam: 1,
        reason: 'beatable-pair',
      });
      expect(result.event.challengedCards.map((card) => card.id)).toEqual(['S-5-0', 'S-5-1']);
    }
  });

  it('succeeds when only the thrower teammate can beat a thrown pair', () => {
    const attempt = [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)];
    const result = evaluateThrowLead({
      seat: 0,
      cards: attempt,
      hand: attempt,
      hands: [
        attempt,
        [c('S', 3, 0), c('S', 3, 1)],
        [c('S', 9, 0), c('S', 9, 1)],
        [c('D', 9, 0), c('D', 9, 1)],
      ],
      trump,
    });

    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.event).toMatchObject({
        seat: 0,
        success: true,
        penaltyPoints: 0,
        beneficiaryTeam: null,
      });
    }
  });

  it('fails a side-suit pair throw when an opponent has any trump pair', () => {
    const attempt = [c('S', 8, 0), c('S', 8, 1), c('S', 11, 0), c('S', 11, 1)];
    const result = evaluateThrowLead({
      seat: 2,
      cards: attempt,
      hand: attempt,
      hands: [
        [c('C', 4, 0), c('C', 4, 1)],
        [c('H', 3, 0), c('H', 3, 1)],
        attempt,
        [c('S', 4, 0), c('S', 4, 1)],
      ],
      trump,
    });

    expect(result.type).toBe('failure');
    if (result.type === 'failure') {
      expect(result.actualCards.map((card) => card.id)).toEqual(['S-8-0', 'S-8-1']);
      expect(result.event).toMatchObject({
        seat: 2,
        penaltyPoints: 40,
        beneficiaryTeam: 1,
      });
    }
  });

  it('does not treat ordinary tractors or malformed mixed cards as throw attempts', () => {
    const tractor = [c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1)];
    expect(
      evaluateThrowLead({ seat: 0, cards: tractor, hand: tractor, hands: [tractor, [], [], []], trump }),
    ).toMatchObject({ type: 'not-throw', code: 'ordinary-combo' });

    const mixed = [c('S', 5, 0), c('S', 5, 1), c('D', 8, 0), c('D', 8, 1)];
    expect(
      evaluateThrowLead({ seat: 0, cards: mixed, hand: mixed, hands: [mixed, [], [], []], trump }),
    ).toMatchObject({ type: 'not-throw', code: 'invalid-throw' });
  });
});
