import { describe, it, expect } from 'vitest';
import type { Card, Combo, TrumpContext } from '@shengji/shared';
import { detectCombo } from '../src/combo';
import { validateLead, validateFollow } from '../src/follow';
import { evaluateThrowLead } from '../src/throw';
import { c, joker } from './helpers';

const trump: TrumpContext = { trumpSuit: 'H', level: 2 };

function throwLead(cards: Card[]): Combo {
  const result = evaluateThrowLead({ seat: 0, cards, hand: cards, hands: [cards, [], [], []], trump });
  if (result.type !== 'success') throw new Error('test helper requires a successful throw');
  return result.combo;
}

describe('validateLead', () => {
  it('valid single/pair/tractor accepted', () => {
    const hand = [c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1), c('D', 3, 0)];
    expect(validateLead([c('S', 5, 0)], hand, trump).ok).toBe(true);
    expect(validateLead([c('S', 5, 0), c('S', 5, 1)], hand, trump).ok).toBe(true);
    expect(
      validateLead([c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1)], hand, trump).ok,
    ).toBe(true);
  });

  it('lead must be a valid combo', () => {
    const hand = [c('S', 5, 0), c('D', 6, 0)];
    expect(validateLead([c('S', 5, 0), c('D', 6, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'invalid-combo',
    });
  });

  it('cards must come from hand', () => {
    const hand = [c('S', 5, 0)];
    expect(validateLead([c('S', 9, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'cards-not-in-hand',
    });
  });
});

describe('validateFollow', () => {
  it('must play pair when holding one', () => {
    const lead = detectCombo([c('S', 5, 0), c('S', 5, 1)], trump)!;
    const hand = [c('S', 6, 0), c('S', 6, 1), c('S', 9, 0), c('D', 3, 0)];
    expect(validateFollow(lead, [c('S', 6, 0), c('S', 9, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'must-play-pair',
    });
    expect(validateFollow(lead, [c('S', 6, 0), c('S', 6, 1)], hand, trump).ok).toBe(true);
  });

  it('void in suit: may discard anything of same count', () => {
    const lead = detectCombo([c('S', 5, 0)], trump)!;
    const hand = [c('D', 3, 0), c('H', 4, 0)];
    expect(validateFollow(lead, [c('D', 3, 0)], hand, trump).ok).toBe(true);
  });

  it('void in suit: may trump in (ruff)', () => {
    const lead = detectCombo([c('S', 5, 0)], trump)!;
    const hand = [c('H', 4, 0), c('D', 3, 0)];
    const res = validateFollow(lead, [c('H', 4, 0)], hand, trump);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.combo?.suit).toBe('trump');
  });

  it('partial suit: must exhaust suit first', () => {
    const lead = detectCombo([c('S', 5, 0), c('S', 5, 1)], trump)!;
    const hand = [c('S', 9, 0), c('D', 3, 0), c('D', 4, 0)];
    expect(validateFollow(lead, [c('D', 3, 0), c('D', 4, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'must-follow-suit',
    });
    expect(validateFollow(lead, [c('S', 9, 0), c('D', 3, 0)], hand, trump).ok).toBe(true);
  });

  it('tractor lead forces same-length tractor when available', () => {
    const lead = detectCombo([c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1)], trump)!;
    const hand = [
      c('S', 9, 0), c('S', 9, 1), c('S', 10, 0), c('S', 10, 1),
      c('S', 3, 0), c('S', 4, 0), c('D', 3, 0),
    ];
    // 手上有 S9S9+S10S10 同长度拖拉机，出散牌被拒
    expect(
      validateFollow(lead, [c('S', 3, 0), c('S', 4, 0), c('S', 9, 0), c('S', 10, 0)], hand, trump),
    ).toMatchObject({ ok: false, code: 'must-play-tractor' });
    expect(
      validateFollow(lead, [c('S', 9, 0), c('S', 9, 1), c('S', 10, 0), c('S', 10, 1)], hand, trump)
        .ok,
    ).toBe(true);
  });

  it('tractor lead degrades to pairs when no tractor', () => {
    const lead = detectCombo([c('S', 5, 0), c('S', 5, 1), c('S', 6, 0), c('S', 6, 1)], trump)!;
    const hand = [
      c('S', 9, 0), c('S', 9, 1), c('S', 3, 0), c('S', 4, 0), c('S', 7, 0), c('D', 3, 0),
    ];
    // 无同长度拖拉机但有一对 S9 → 必须包含该对
    expect(
      validateFollow(lead, [c('S', 3, 0), c('S', 4, 0), c('S', 7, 0), c('S', 9, 0)], hand, trump),
    ).toMatchObject({ ok: false, code: 'must-play-pair' });
    expect(
      validateFollow(lead, [c('S', 9, 0), c('S', 9, 1), c('S', 3, 0), c('S', 4, 0)], hand, trump)
        .ok,
    ).toBe(true);
  });

  it('wrong count rejected', () => {
    const lead = detectCombo([c('S', 5, 0), c('S', 5, 1)], trump)!;
    const hand = [c('S', 6, 0), c('S', 6, 1)];
    expect(validateFollow(lead, [c('S', 6, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'wrong-count',
    });
  });

  it('cards not in hand rejected', () => {
    const lead = detectCombo([c('S', 5, 0)], trump)!;
    const hand = [c('S', 6, 0)];
    expect(validateFollow(lead, [c('S', 9, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'cards-not-in-hand',
    });
  });

  it('trump lead: joker counts as trump suit', () => {
    const lead = detectCombo([joker('big', 0)], trump)!;
    const hand = [c('H', 3, 0), c('D', 9, 0)];
    // 手上有主牌(H3)必须跟主
    expect(validateFollow(lead, [c('D', 9, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'must-follow-suit',
    });
    expect(validateFollow(lead, [c('H', 3, 0)], hand, trump).ok).toBe(true);
  });

  it('no-trump lead: all level cards are trump and must be followed first', () => {
    const nt: TrumpContext = { trumpSuit: null, level: 2 };
    const lead = detectCombo([c('S', 2, 0)], nt)!;
    const hand = [c('D', 2, 0), c('S', 14, 0)];
    expect(validateFollow(lead, [c('S', 14, 0)], hand, nt)).toMatchObject({
      ok: false,
      code: 'must-follow-suit',
    });
    expect(validateFollow(lead, [c('D', 2, 0)], hand, nt).ok).toBe(true);
  });

  it('discard combo=null when mixed cards dumped', () => {
    const lead = detectCombo([c('S', 5, 0), c('S', 5, 1)], trump)!;
    const hand = [c('D', 3, 0), c('C', 4, 0)];
    const res = validateFollow(lead, [c('D', 3, 0), c('C', 4, 0)], hand, trump);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.combo).toBeNull();
  });

  it('mixed throw lead forces as many same-suit pairs as available', () => {
    const lead = throwLead([
      c('S', 9, 0), c('S', 9, 1),
      c('S', 12, 0), c('S', 12, 1),
    ]);
    const hand = [c('S', 3, 0), c('S', 3, 1), c('S', 4, 0), c('S', 7, 0), c('S', 8, 0)];

    expect(validateFollow(lead, [c('S', 3, 0), c('S', 4, 0), c('S', 7, 0), c('S', 8, 0)], hand, trump)).toMatchObject({
      ok: false,
      code: 'must-play-pair',
    });
    expect(validateFollow(lead, [c('S', 3, 0), c('S', 3, 1), c('S', 4, 0), c('S', 7, 0)], hand, trump).ok).toBe(true);
  });

  it('matches a tractor before an extra pair and single', () => {
    const lead = throwLead([
      c('S', 13, 0), c('S', 13, 1),
      c('S', 14, 0), c('S', 14, 1),
      c('S', 9, 0), c('S', 9, 1),
      c('S', 7, 0),
    ]);
    const hand = [
      c('S', 3, 0), c('S', 3, 1),
      c('S', 4, 0), c('S', 4, 1),
      c('S', 8, 0), c('S', 8, 1),
      c('S', 6, 0), c('S', 10, 0),
    ];
    expect(
      validateFollow(
        lead,
        [c('S', 3, 0), c('S', 3, 1), c('S', 8, 0), c('S', 8, 1), c('S', 6, 0), c('S', 10, 0), c('S', 4, 0)],
        hand,
        trump,
      ),
    ).toMatchObject({ ok: false, code: 'must-play-tractor' });
    expect(
      validateFollow(
        lead,
        [c('S', 3, 0), c('S', 3, 1), c('S', 4, 0), c('S', 4, 1), c('S', 8, 0), c('S', 8, 1), c('S', 6, 0)],
        hand,
        trump,
      ).ok,
    ).toBe(true);
  });

  it('allows only an all-trump full-structure response to kill a side-suit throw', () => {
    const lead = throwLead([c('S', 14, 0), c('S', 14, 1), c('S', 13, 0)]);
    const matchingTrump = [c('H', 8, 0), c('H', 8, 1), c('H', 7, 0)];
    const matched = validateFollow(lead, matchingTrump, matchingTrump, trump);
    expect(matched.ok).toBe(true);
    if (matched.ok) expect(matched.combo).toMatchObject({ type: 'throw', suit: 'trump', strength: 108 });

    const brokenTrump = [c('H', 8, 0), c('H', 7, 0), c('H', 6, 0)];
    const broken = validateFollow(lead, brokenTrump, brokenTrump, trump);
    expect(broken.ok).toBe(true);
    if (broken.ok) expect(broken.combo).toBeNull();

    const mixed = [c('S', 6, 0), c('H', 8, 0), c('H', 8, 1)];
    const mixedResult = validateFollow(lead, mixed, mixed, trump);
    expect(mixedResult.ok).toBe(true);
    if (mixedResult.ok) expect(mixedResult.combo).toBeNull();
  });
});
