import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit, TrumpContext } from '@shengji/shared';
import {
  applyBury,
  applyPass,
  applyPlay,
  applyReveal,
  buildDeck,
  createRound,
  detectBid,
  bidBeats,
  detectCombo,
  shuffle,
  type RoundState,
  type StepResult,
} from '@shengji/game';
import { decideBid, decideBury, decidePlay } from '../src/index';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectOk(r: StepResult): RoundState {
  if (!r.ok) throw new Error(`step failed: ${r.error.code}`);
  return r.state;
}

const cardBy = (id: string): Card => {
  const found = buildDeck().find((card) => card.id === id);
  if (!found) throw new Error(`no card ${id}`);
  return found;
};

describe('decideBid', () => {
  it('opens with the strongest high-confidence bid instead of the first weak suit', () => {
    const hand = [
      cardBy('S-2-0'),
      cardBy('S-14-0'),
      cardBy('S-13-0'),
      cardBy('S-12-0'),
      cardBy('S-11-0'),
      cardBy('joker-big-0'),
      cardBy('joker-big-1'),
    ];

    expect(decideBid({ hand, level: 2, currentBid: null, seat: 0 })).toEqual([
      'joker-big-0',
      'joker-big-1',
    ]);
  });

  it('uses a single big joker to counter a single small joker', () => {
    const currentBid = detectBid([cardBy('joker-small-0')], 2, 1);
    expect(currentBid).not.toBeNull();

    expect(
      decideBid({
        hand: [cardBy('joker-big-0')],
        level: 2,
        currentBid,
        seat: 0,
      }),
    ).toEqual(['joker-big-0']);
  });

  it('does not overcall a teammate with only a same-count category upgrade', () => {
    const currentBid = detectBid([cardBy('H-2-0'), cardBy('H-2-1')], 2, 2);
    expect(currentBid).not.toBeNull();

    expect(
      decideBid({
        hand: [cardBy('joker-small-0'), cardBy('joker-small-1')],
        level: 2,
        currentBid,
        seat: 0,
      }),
    ).toBeNull();
  });

  it('is always null or a legal overcall (1000 random hands)', () => {
    const suits: Suit[] = ['S', 'H', 'D', 'C'];
    for (let i = 0; i < 1000; i++) {
      const rng = mulberry32(i);
      const hand = shuffle(buildDeck(), rng).slice(0, 25);
      const level = ((i % 13) + 2) as Rank;
      const current =
        i % 3 === 0
          ? null
          : detectBid(
              [{ id: `${suits[i % 4]}-${level}-0`, kind: 'suit', suit: suits[i % 4], rank: level }],
              level,
              3,
            );
      const ids = decideBid({ hand, level, currentBid: current, seat: 0 });
      if (ids !== null) {
        const cards = ids.map((id) => hand.find((card) => card.id === id)!);
        expect(cards.every(Boolean)).toBe(true);
        const bid = detectBid(cards, level, 0);
        expect(bid).not.toBeNull();
        expect(bidBeats(bid!, current)).toBe(true);
      }
    }
  });
});

describe('decideBury', () => {
  it('returns exactly 8 distinct cards from hand (200 random hands)', () => {
    const suits: Suit[] = ['S', 'H', 'D', 'C'];
    for (let i = 0; i < 200; i++) {
      const rng = mulberry32(5000 + i);
      const hand = shuffle(buildDeck(), rng).slice(0, 33);
      const trump: TrumpContext = {
        trumpSuit: i % 5 === 4 ? null : suits[i % 4],
        level: ((i % 13) + 2) as Rank,
      };
      const ids = decideBury(hand, trump);
      expect(ids).toHaveLength(8);
      expect(new Set(ids).size).toBe(8);
      const handIds = new Set(hand.map((card) => card.id));
      expect(ids.every((id) => handIds.has(id))).toBe(true);
    }
  });
});

describe('decidePlay', () => {
  it('is always legal across full random rounds (bots vs bots)', () => {
    for (let round = 0; round < 20; round++) {
      let s = createRound({
        plannedDealerSeat: round % 4,
        teamLevels: [2, 2],
        rng: mulberry32(9000 + round),
      });
      let guard = 0;
      while (s.phase === 'bidding' && guard++ < 50) {
        const seat = s.biddingTurn;
        const ids = decideBid({
          hand: s.hands[seat],
          level: s.level,
          currentBid: s.currentBid,
          seat,
        });
        s = ids !== null ? expectOk(applyReveal(s, seat, ids)) : expectOk(applyPass(s, seat));
      }
      expect(s.phase).toBe('burying');
      s = expectOk(applyBury(s, s.dealerSeat, decideBury(s.hands[s.dealerSeat], s.trump)));
      guard = 0;
      while (s.phase === 'playing' && guard++ < 500) {
        const seat = s.turnSeat;
        const leadCombo = s.currentTrick.length > 0 ? s.currentTrick[0].combo : null;
        const ids = decidePlay({
          hand: s.hands[seat],
          trump: s.trump,
          leadCombo,
          currentTrick: s.currentTrick,
          seat,
          trickPointsSoFar: 0,
        });
        s = expectOk(applyPlay(s, seat, ids));
      }
      expect(s.phase).toBe('scoring');
      expect(s.result).not.toBeNull();
    }
  });

  it('teammate winning: dumps point card', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-14-0')];
    const second = [cardBy('S-3-0')];
    const ids = decidePlay({
      hand: [cardBy('S-5-0'), cardBy('S-6-0'), cardBy('D-4-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 0, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 1, cards: second, combo: detectCombo(second, trump) },
      ],
      seat: 2, // 与 seat 0 同队，队友 SA 正大
      trickPointsSoFar: 0,
    });
    expect(ids).toEqual(['S-5-0']); // 送 5 分
  });

  it('opponent winning: avoids giving points', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-14-0')];
    const ids = decidePlay({
      hand: [cardBy('S-5-0'), cardBy('S-6-0'), cardBy('D-4-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1, // 对手 SA 正大
      trickPointsSoFar: 0,
    });
    expect(ids).toEqual(['S-6-0']); // 不送分
  });

  it('follows a throw-pairs lead with as many required pairs as possible', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const leadCards = [cardBy('S-9-0'), cardBy('S-9-1'), cardBy('S-12-0'), cardBy('S-12-1')];
    const leadCombo = {
      type: 'throw-pairs' as const,
      cards: leadCards,
      suit: 'S' as const,
      strength: 12,
      components: [detectCombo([cardBy('S-9-0'), cardBy('S-9-1')], trump)!],
    };
    const ids = decidePlay({
      hand: [cardBy('S-3-0'), cardBy('S-3-1'), cardBy('S-4-0'), cardBy('S-7-0'), cardBy('D-9-0')],
      trump,
      leadCombo,
      currentTrick: [{ seat: 0, cards: leadCards, combo: leadCombo }],
      seat: 1,
      trickPointsSoFar: 0,
    });

    expect(ids).toEqual(['S-3-0', 'S-3-1', 'S-4-0', 'S-7-0']);
  });
});
