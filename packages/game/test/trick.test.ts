import { describe, it, expect } from 'vitest';
import type { Card, Combo, TrumpContext } from '@shengji/shared';
import { detectCombo } from '../src/combo';
import { evaluateThrowLead, matchThrowCombo } from '../src/throw';
import { trickWinner, type TrickPlay } from '../src/trick';
import { c, joker } from './helpers';

const trump: TrumpContext = { trumpSuit: 'H', level: 2 };

function play(seat: number, cards: Card[], ctx: TrumpContext = trump): TrickPlay {
  return { seat, cards, combo: detectCombo(cards, ctx) };
}

function throwLead(cards: Card[]): Combo {
  const result = evaluateThrowLead({ seat: 0, cards, hand: cards, hands: [cards, [], [], []], trump });
  if (result.type !== 'success') throw new Error('test helper requires a successful throw');
  return result.combo;
}

function throwPlay(seat: number, cards: Card[], lead: Combo): TrickPlay {
  return { seat, cards, combo: matchThrowCombo(cards, lead, trump) };
}

describe('trickWinner', () => {
  it('highest same-suit single wins', () => {
    const plays: TrickPlay[] = [
      play(0, [c('S', 5, 0)]),
      play(1, [c('S', 9, 0)]),
      play(2, [c('S', 3, 0)]),
      play(3, [c('D', 10, 0)]), // 垫牌
    ];
    expect(trickWinner(plays, trump)).toBe(1);
  });

  it('trump beats off-suit high card', () => {
    const plays: TrickPlay[] = [
      play(0, [c('S', 5, 0)]),
      play(1, [c('S', 14, 0)]),
      play(2, [c('H', 3, 0)]), // 毙牌
      play(3, [c('S', 10, 0)]),
    ];
    expect(trickWinner(plays, trump)).toBe(2);
  });

  it('higher trump beats lower trump; joker on top', () => {
    const plays: TrickPlay[] = [
      play(0, [c('S', 5, 0)]),
      play(1, [c('H', 3, 0)]),
      play(2, [joker('small', 0)]),
      play(3, [c('H', 14, 0)]),
    ];
    expect(trickWinner(plays, trump)).toBe(2);
  });

  it('discard (null combo) never wins', () => {
    const lead = [c('S', 5, 0), c('S', 5, 1)];
    const plays: TrickPlay[] = [
      play(0, lead),
      { seat: 1, cards: [c('D', 14, 0), c('C', 14, 0)], combo: null }, // 混合垫牌
      play(2, [c('S', 3, 0), c('S', 3, 1)]),
      play(3, [c('S', 9, 0), c('S', 9, 1)]),
    ];
    expect(trickWinner(plays, trump)).toBe(3);
  });

  it('pair lead: broken-pair follow cannot win', () => {
    const plays: TrickPlay[] = [
      play(0, [c('S', 5, 0), c('S', 5, 1)]),
      { seat: 1, cards: [c('S', 14, 0), c('S', 13, 0)], combo: null }, // 拆散跟牌
      play(2, [c('S', 6, 0), c('S', 6, 1)]),
      play(3, [c('S', 4, 0), c('S', 4, 1)]),
    ];
    expect(trickWinner(plays, trump)).toBe(2);
  });

  it('trump tractor beats lead-suit tractor', () => {
    const plays: TrickPlay[] = [
      play(0, [c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1)]),
      play(1, [c('H', 3, 0), c('H', 3, 1), c('H', 4, 0), c('H', 4, 1)]), // 主拖拉机毙
      play(2, [c('S', 9, 0), c('S', 9, 1), c('S', 10, 0), c('S', 10, 1)]),
      { seat: 3, cards: [c('D', 3, 0), c('D', 4, 0), c('D', 5, 0), c('D', 6, 0)], combo: null },
    ];
    expect(trickWinner(plays, trump)).toBe(1);
  });

  it('equal strength: earlier play wins (off-suit level pair-off in no-trump game)', () => {
    const nt: TrumpContext = { trumpSuit: null, level: 2 };
    const plays: TrickPlay[] = [
      play(0, [c('S', 2, 0)], nt), // 级牌即主，强度 120
      play(1, [c('D', 2, 0)], nt), // 同为 120
      play(2, [c('C', 3, 0)], nt),
      play(3, [c('C', 4, 0)], nt),
    ];
    expect(trickWinner(plays, nt)).toBe(0);
  });

  it('all-trump matching responses to an all-single throw compare their largest single', () => {
    const lead = throwLead([c('S', 14, 0), c('S', 13, 0), c('S', 12, 0)]);
    const plays: TrickPlay[] = [
      { seat: 0, cards: lead.cards, combo: lead },
      throwPlay(1, [c('H', 3, 0), c('H', 4, 0), c('H', 7, 0)], lead),
      throwPlay(2, [c('H', 5, 0), c('H', 6, 0), c('H', 8, 0)], lead),
      { seat: 3, cards: [c('D', 3, 0), c('C', 4, 0), c('D', 5, 0)], combo: null },
    ];
    expect(trickWinner(plays, trump)).toBe(2);
  });

  it('multiple pairs plus a single compares the largest pair, not the largest single', () => {
    const lead = throwLead([
      c('S', 14, 0), c('S', 14, 1),
      c('S', 10, 0), c('S', 10, 1),
      c('S', 13, 0),
    ]);
    const plays: TrickPlay[] = [
      { seat: 0, cards: lead.cards, combo: lead },
      throwPlay(1, [
        c('H', 3, 0), c('H', 3, 1),
        c('H', 8, 0), c('H', 8, 1),
        c('H', 14, 0),
      ], lead),
      throwPlay(2, [
        c('H', 4, 0), c('H', 4, 1),
        c('H', 9, 0), c('H', 9, 1),
        c('H', 5, 0),
      ], lead),
      { seat: 3, cards: [], combo: null },
    ];
    expect(trickWinner(plays, trump)).toBe(2);
  });

  it('tractor plus other shapes compares only the strongest tractor', () => {
    const lead = throwLead([
      c('S', 13, 0), c('S', 13, 1),
      c('S', 14, 0), c('S', 14, 1),
      c('S', 9, 0), c('S', 9, 1),
    ]);
    const plays: TrickPlay[] = [
      { seat: 0, cards: lead.cards, combo: lead },
      throwPlay(1, [
        c('H', 5, 0), c('H', 5, 1), c('H', 6, 0), c('H', 6, 1),
        c('H', 14, 0), c('H', 14, 1),
      ], lead),
      throwPlay(2, [
        c('H', 7, 0), c('H', 7, 1), c('H', 8, 0), c('H', 8, 1),
        c('H', 3, 0), c('H', 3, 1),
      ], lead),
      { seat: 3, cards: [], combo: null },
    ];
    expect(trickWinner(plays, trump)).toBe(2);
  });
});
