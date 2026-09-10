import { describe, it, expect } from 'vitest';
import type { Bid, Card, Rank, Suit, TrumpContext } from '@shengji/shared';
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
  evaluateThrowLead,
  countPoints,
  closePreKittyBidWindow,
  shuffle,
  type RoundState,
  type StepResult,
} from '@shengji/game';
import { decideBid, decideBury, decidePlay, explainBid, explainBury, explainPlay } from '../src/index';

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

function suitPairBid(suit: Suit, level: Rank, seat = 1): Bid {
  const bid = detectBid([cardBy(`${suit}-${level}-0`), cardBy(`${suit}-${level}-1`)], level, seat);
  if (bid === null) throw new Error('failed to build suit-pair bid');
  return bid;
}

function dealerBuryView(hand: Card[], trump: TrumpContext) {
  if (trump.trumpSuit === null) throw new Error('test helper requires a suit trump');
  return {
    hand,
    trump,
    seat: 0,
    dealerSeat: 0,
    currentBid: suitPairBid(trump.trumpSuit, trump.level),
  };
}

describe('decideBid', () => {
  it('explains opening with the strongest high-confidence bid', () => {
    const hand = [
      cardBy('S-2-0'),
      cardBy('S-14-0'),
      cardBy('S-13-0'),
      cardBy('S-12-0'),
      cardBy('S-11-0'),
      cardBy('joker-big-0'),
      cardBy('joker-big-1'),
    ];

    const plan = explainBid({ hand, level: 2, currentBid: null, seat: 0 });

    expect(plan.cardIds).toEqual(['joker-big-0', 'joker-big-1']);
    expect(plan.reason).toBe('open-strongest');
    expect(plan.legalCandidateCount).toBe(2);
    expect(plan.eligibleCandidateCount).toBe(2);
  });

  it('explains passing a low-confidence opening bid', () => {
    const hand = [
      cardBy('S-2-0'),
      cardBy('S-14-0'),
      cardBy('S-13-0'),
      cardBy('S-12-0'),
      cardBy('D-4-0'),
    ];

    const plan = explainBid({ hand, level: 2, currentBid: null, seat: 0 });

    expect(plan.cardIds).toBeNull();
    expect(plan.reason).toBe('pass-low-confidence');
    expect(plan.legalCandidateCount).toBe(1);
    expect(plan.eligibleCandidateCount).toBe(0);
  });

  it('explains protecting a teammate contract from a same-count category upgrade', () => {
    const currentBid = detectBid([cardBy('H-2-0'), cardBy('H-2-1')], 2, 2);
    expect(currentBid).not.toBeNull();

    const plan = explainBid({
      hand: [cardBy('joker-small-0'), cardBy('joker-small-1')],
      level: 2,
      currentBid,
      seat: 0,
    });

    expect(plan.cardIds).toBeNull();
    expect(plan.reason).toBe('pass-protect-current-contract');
    expect(plan.legalCandidateCount).toBe(1);
    expect(plan.eligibleCandidateCount).toBe(0);
  });

  it('explains protecting its own current contract from a same-count category upgrade', () => {
    const currentBid = detectBid([cardBy('H-2-0'), cardBy('H-2-1')], 2, 0);
    expect(currentBid).not.toBeNull();

    const plan = explainBid({
      hand: [cardBy('joker-small-0'), cardBy('joker-small-1')],
      level: 2,
      currentBid,
      seat: 0,
    });

    expect(plan.cardIds).toBeNull();
    expect(plan.reason).toBe('pass-protect-current-contract');
    expect(plan.legalCandidateCount).toBe(1);
    expect(plan.eligibleCandidateCount).toBe(0);
  });

  it('explains passing when there is no stronger bid candidate', () => {
    const currentBid = detectBid([cardBy('joker-big-0'), cardBy('joker-big-1')], 2, 1);
    expect(currentBid).not.toBeNull();

    const plan = explainBid({
      hand: [cardBy('S-2-0'), cardBy('S-2-1'), cardBy('joker-small-0'), cardBy('joker-small-1')],
      level: 2,
      currentBid,
      seat: 0,
    });

    expect(plan.cardIds).toBeNull();
    expect(plan.reason).toBe('pass-no-legal-bid');
    expect(plan.legalCandidateCount).toBe(0);
    expect(plan.eligibleCandidateCount).toBe(0);
  });

  it('explains countering with a stronger bid', () => {
    const currentBid = detectBid([cardBy('D-2-0')], 2, 1);
    expect(currentBid).not.toBeNull();

    const plan = explainBid({
      hand: [cardBy('C-2-0'), cardBy('C-2-1')],
      level: 2,
      currentBid,
      seat: 0,
    });

    expect(plan.cardIds).toEqual(['C-2-0', 'C-2-1']);
    expect(plan.reason).toBe('counter-stronger');
    expect(plan.legalCandidateCount).toBe(1);
    expect(plan.eligibleCandidateCount).toBe(1);
  });

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

  it('uses a big-joker pair to counter a small-joker pair', () => {
    const currentBid = detectBid([cardBy('joker-small-0'), cardBy('joker-small-1')], 2, 1);
    expect(currentBid).not.toBeNull();

    expect(
      decideBid({
        hand: [cardBy('joker-big-0'), cardBy('joker-big-1')],
        level: 2,
        currentBid,
        seat: 0,
      }),
    ).toEqual(['joker-big-0', 'joker-big-1']);
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
  it('prefers voiding a short safe side suit over burying lower scattered cards', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const safeClubVoid = ['C-9-0', 'C-11-0', 'C-12-0', 'C-14-0'];
    const hand = [
      ...safeClubVoid.map(cardBy),
      ...[
        'D-3-0', 'D-4-0', 'D-6-0', 'D-7-0', 'D-8-0', 'D-9-0', 'D-11-0', 'D-12-0', 'D-14-0',
        'S-5-0', 'S-10-0', 'S-13-0', 'S-14-0',
        'H-2-0', 'H-14-0', 'H-13-0', 'H-12-0', 'H-11-0',
        'joker-small-0', 'joker-big-0',
        'D-5-0', 'S-6-0', 'S-7-0', 'S-8-0', 'S-9-0', 'S-11-0', 'S-12-0',
      ].map(cardBy),
    ];

    const ids = decideBury(dealerBuryView(hand, trump));

    expect(ids).toHaveLength(8);
    expect(safeClubVoid.every((id) => ids.includes(id))).toBe(true);
  });

  it('does not force a void when the dealer is weak and safe filler is scarce', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const safeClubVoid = ['C-9-0', 'C-11-0', 'C-12-0', 'C-14-0'];
    const scarceSafeFiller = ['D-3-0', 'D-4-0', 'D-6-0'];
    const hand = [
      ...safeClubVoid.map(cardBy),
      ...scarceSafeFiller.map(cardBy),
      ...[
        'S-5-0', 'D-10-0', 'S-10-0', 'D-13-0', 'S-13-0',
        'S-3-0', 'S-3-1', 'D-7-0', 'D-7-1',
        'H-3-0', 'H-4-0', 'H-6-0',
        'S-14-0', 'D-14-0', 'S-12-0', 'D-12-0', 'S-11-0', 'D-11-0',
        'H-7-0', 'H-8-0',
        'H-9-0', 'H-10-0',
      ].map(cardBy),
    ];

    const ids = decideBury(dealerBuryView(hand, trump));

    expect(ids).toHaveLength(8);
    expect(safeClubVoid.every((id) => ids.includes(id))).toBe(false);
  });

  it('still creates a safe void for a strong dealer when filler cards stay low risk', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const safeClubVoid = ['C-9-0', 'C-11-0', 'C-12-0', 'C-14-0'];
    const hand = [
      ...safeClubVoid.map(cardBy),
      ...[
        'D-3-0', 'D-4-0', 'D-6-0', 'D-7-0', 'D-10-0',
        'S-5-0', 'S-10-0', 'S-13-0',
        'H-2-0', 'H-2-1', 'H-14-0', 'H-14-1', 'H-13-0', 'H-12-0', 'H-11-0', 'H-10-0',
        'joker-small-0', 'joker-big-0',
        'S-3-0', 'S-4-0', 'S-6-0', 'S-7-0', 'S-8-0', 'S-9-0', 'S-11-0', 'S-12-0',
        'D-14-0', 'D-12-0',
      ].map(cardBy),
    ];

    const ids = decideBury(dealerBuryView(hand, trump));

    expect(ids).toHaveLength(8);
    expect(safeClubVoid.every((id) => ids.includes(id))).toBe(true);
  });

  it('does not choose a void when a balanced dealer would need unsafe filler', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const safeClubVoid = ['C-9-0', 'C-11-0', 'C-12-0', 'C-14-0'];
    const lowRiskFiller = ['D-3-0', 'D-4-0', 'D-6-0'];
    const hand = [
      ...safeClubVoid.map(cardBy),
      ...lowRiskFiller.map(cardBy),
      ...[
        'S-5-0', 'D-10-0', 'S-10-0', 'D-13-0', 'S-13-0',
        'S-3-0', 'S-3-1', 'D-7-0', 'D-7-1',
        'H-2-0', 'H-3-0', 'H-4-0', 'H-6-0',
        'S-4-0', 'S-4-1', 'D-8-0', 'D-8-1', 'S-6-0', 'S-6-1',
        'H-7-0', 'H-8-0', 'H-9-0',
      ].map(cardBy),
    ];

    const plan = explainBury(dealerBuryView(hand, trump));
    expect(plan.profile).toBe('balanced');
    expect(plan.cardIds).toHaveLength(8);
    expect(safeClubVoid.every((id) => plan.cardIds.includes(id))).toBe(false);
  });

  it('keeps key trump controls out of the kitty', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const keyTrumps = ['joker-big-0', 'joker-small-0', 'H-2-0', 'H-14-0'];
    const hand = [
      ...keyTrumps.map(cardBy),
      ...[
        'S-3-0', 'S-4-0', 'S-6-0', 'S-7-0', 'S-8-0', 'S-9-0', 'S-11-0', 'S-12-0', 'S-14-0',
        'C-3-0', 'C-4-0', 'C-6-0', 'C-7-0', 'C-8-0', 'C-9-0', 'C-11-0', 'C-12-0',
        'D-3-0', 'D-4-0', 'D-6-0', 'D-7-0', 'D-8-0', 'D-9-0', 'D-11-0', 'D-12-0',
        'S-5-0', 'D-10-0', 'C-13-0',
      ].map(cardBy),
    ];

    const ids = decideBury(dealerBuryView(hand, trump));

    expect(ids).toHaveLength(8);
    expect(keyTrumps.some((id) => ids.includes(id))).toBe(false);
  });

  it('uses opposite strategies for dealer-side and defender-side kitty holders', () => {
    const hand = shuffle(buildDeck(), mulberry32(25)).slice(0, 33);
    const bigPair = detectBid([cardBy('joker-big-0'), cardBy('joker-big-1')], 2, 1)!;
    expect(bigPair.cards.every((card) => hand.some((held) => held.id === card.id))).toBe(true);

    const dealerPlan = explainBury({
      hand,
      trump: { trumpSuit: null, level: 2 },
      seat: 0,
      dealerSeat: 0,
      currentBid: { ...bigPair, seat: 0 },
    });
    const defenderPlan = explainBury({
      hand,
      trump: { trumpSuit: null, level: 2 },
      seat: 1,
      dealerSeat: 0,
      currentBid: bigPair,
    });

    expect(dealerPlan.role).toBe('dealer-side');
    expect(defenderPlan.role).toBe('defender-side');
    expect(dealerPlan.buriedPoints).toBe(0);
    expect(defenderPlan.buriedPoints).toBeGreaterThanOrEqual(50);
    expect(defenderPlan.buriedPoints).toBeGreaterThan(dealerPlan.buriedPoints);
    expect(defenderPlan.cardIds).not.toContain('joker-big-0');
    expect(defenderPlan.cardIds).not.toContain('joker-big-1');
  });

  it('buries points more aggressively when a defender has made the final possible counter', () => {
    const hand = shuffle(buildDeck(), mulberry32(1763)).slice(0, 33);
    const smallPair = detectBid([cardBy('joker-small-0'), cardBy('joker-small-1')], 2, 1)!;
    const bigPair = detectBid([cardBy('joker-big-0'), cardBy('joker-big-1')], 2, 1)!;
    expect([...smallPair.cards, ...bigPair.cards].every(
      (card) => hand.some((held) => held.id === card.id),
    )).toBe(true);

    const provisional = explainBury({
      hand,
      trump: { trumpSuit: null, level: 2 },
      seat: 1,
      dealerSeat: 0,
      currentBid: smallPair,
    });
    const final = explainBury({
      hand,
      trump: { trumpSuit: null, level: 2 },
      seat: 1,
      dealerSeat: 0,
      currentBid: bigPair,
    });

    expect(provisional.counterExposure).toBeGreaterThan(final.counterExposure);
    expect(final.counterExposure).toBe(0);
    expect(final.buriedPoints).toBeGreaterThan(provisional.buriedPoints);
  });

  it('preserves a playable tractor when enough loose cards can be buried', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const tractorIds = ['S-7-0', 'S-7-1', 'S-8-0', 'S-8-1'];
    const hand = [
      ...tractorIds.map(cardBy),
      ...[
        'S-3-0', 'S-4-0', 'S-6-0', 'S-9-0', 'S-11-0', 'S-12-0', 'S-13-0', 'S-14-0',
        'C-3-0', 'C-4-0', 'C-6-0', 'C-9-0', 'C-11-0', 'C-12-0', 'C-13-0', 'C-14-0',
        'D-3-0', 'D-4-0', 'D-6-0', 'D-9-0', 'D-11-0', 'D-12-0', 'D-13-0', 'D-14-0',
        'H-2-0', 'H-3-0', 'H-4-0', 'joker-small-0', 'joker-big-0',
      ].map(cardBy),
    ];

    const plan = explainBury(dealerBuryView(hand, trump));

    expect(plan.cardIds).toHaveLength(8);
    expect(tractorIds.some((id) => plan.cardIds.includes(id))).toBe(false);
    expect(plan.candidates[0].brokenTractors).toBe(0);
  });

  it('includes every stronger possible trump when the current pair can still be countered', () => {
    const hand = shuffle(buildDeck(), mulberry32(81)).slice(0, 33);
    const bid = suitPairBid('D', 2, 1);
    const plan = explainBury({
      hand,
      trump: { trumpSuit: 'D', level: 2 },
      seat: 1,
      dealerSeat: 0,
      currentBid: bid,
    });

    expect(plan.counterExposure).toBeGreaterThan(0);
    expect(plan.possibleTrumpSuits).toEqual(['D', 'C', 'H', 'S', null]);
  });

  it('does not model future trump changes when the room has no post-bury counters', () => {
    const hand = shuffle(buildDeck(), mulberry32(82)).slice(0, 33);
    const bid = suitPairBid('D', 2, 1);
    const plan = explainBury({
      hand,
      trump: { trumpSuit: 'D', level: 2 },
      seat: 0,
      dealerSeat: 0,
      currentBid: bid,
      postBuryCountersAllowed: false,
    });

    expect(plan.counterExposure).toBe(0);
    expect(plan.possibleTrumpSuits).toEqual(['D']);
  });

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
        isFirstRound: false,
        chaodiEnabled: true,
      });
      let guard = 0;
      let changed = true;
      while (changed && guard++ < 20) {
        changed = false;
        for (let seat = 0; seat < 4; seat++) {
          if (s.currentBid?.seat === seat) continue;
          const ids = decideBid({
            hand: s.hands[seat],
            level: s.level,
            currentBid: s.currentBid,
            seat,
            biddingStage: s.biddingStage,
          });
          if (ids === null) continue;
          s = expectOk(applyReveal(s, seat, ids));
          changed = true;
        }
      }
      const closed = closePreKittyBidWindow(s);
      if (!closed.ok || closed.action !== 'take-kitty') throw new Error('failed to close bid window');
      s = closed.state;
      expect(s.phase).toBe('burying');
      guard = 0;
      while (s.phase !== 'playing' && guard++ < 80) {
        if (s.phase === 'burying') {
          const seat = s.buryingSeat!;
          s = expectOk(applyBury(s, seat, decideBury({
            hand: s.hands[seat],
            trump: s.trump,
            seat,
            dealerSeat: s.dealerSeat,
            currentBid: s.currentBid,
            bidHistory: s.bidHistory,
          })));
          continue;
        }
        if (s.biddingStage !== 'post-bury') break;
        const seat = s.biddingTurn!;
        const ids = decideBid({
          hand: s.hands[seat],
          level: s.level,
          currentBid: s.currentBid,
          seat,
          biddingStage: s.biddingStage,
        });
        s = ids !== null ? expectOk(applyReveal(s, seat, ids)) : expectOk(applyPass(s, seat));
      }
      expect(s.phase).toBe('playing');
      guard = 0;
      while (s.phase === 'playing' && guard++ < 500) {
        const seat = s.turnSeat;
        const leadCombo = s.currentTrick.length > 0 ? s.currentTrick[0].combo : null;
        const plan = explainPlay({
          hand: s.hands[seat],
          trump: s.trump,
          leadCombo,
          currentTrick: s.currentTrick,
          seat,
          trickPointsSoFar: countPoints(s.currentTrick.flatMap((p) => p.cards)),
          trickHistory: s.trickHistory,
          handCounts: s.hands.map((hand) => hand.length),
          botSeats: [true, true, true, true],
          dealerSeat: s.dealerSeat,
          defenderPoints: s.defenderTrickPoints,
          knownKitty: s.lastBuryingSeat === seat ? s.kitty : undefined,
        });
        expect(plan.reason).not.toBe('fallback');
        s = expectOk(applyPlay(s, seat, plan.cardIds));
      }
      expect(s.phase).toBe('scoring');
      expect(s.result).not.toBeNull();
    }
  });

  it('lead: preserves tractor shape when a safe low single is available', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('S-7-0'),
        cardBy('S-7-1'),
        cardBy('S-8-0'),
        cardBy('S-8-1'),
        cardBy('C-3-0'),
        cardBy('D-5-0'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['C-3-0']);
    expect(plan.reason).toBe('lead-preserve-shape-single');
  });

  it('lead: starts with a tractor when no safe loose single is available', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('S-7-0'),
        cardBy('S-7-1'),
        cardBy('S-8-0'),
        cardBy('S-8-1'),
        cardBy('S-10-0'),
        cardBy('S-10-1'),
        cardBy('H-3-0'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['S-7-0', 'S-7-1', 'S-8-0', 'S-8-1']);
    expect(plan.reason).toBe('lead-tractor');
  });

  it('lead: starts with a strong pair when no safe loose single or tractor is available', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('S-14-0'),
        cardBy('S-14-1'),
        cardBy('S-10-0'),
        cardBy('S-10-1'),
        cardBy('D-13-0'),
        cardBy('D-13-1'),
        cardBy('H-3-0'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['S-14-0', 'S-14-1']);
    expect(plan.reason).toBe('lead-strong-pair');
  });

  it('lead: safely throws trump pairs when every higher pair is already in hand', () => {
    const trump: TrumpContext = { trumpSuit: null, level: 2 };
    const hand = [
      cardBy('S-2-0'),
      cardBy('S-2-1'),
      cardBy('H-2-0'),
      cardBy('H-2-1'),
      cardBy('D-2-0'),
      cardBy('D-2-1'),
      cardBy('C-2-0'),
      cardBy('C-2-1'),
      cardBy('joker-small-0'),
      cardBy('joker-small-1'),
      cardBy('joker-big-0'),
      cardBy('joker-big-1'),
    ];
    const plan = explainPlay({
      hand,
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual([
      'C-2-0',
      'C-2-1',
      'D-2-0',
      'D-2-1',
      'H-2-0',
      'H-2-1',
      'S-2-0',
      'S-2-1',
      'joker-small-0',
      'joker-small-1',
      'joker-big-0',
      'joker-big-1',
    ]);
    expect(plan.reason).toBe('lead-safe-throw');
    expect(detectCombo(plan.cardIds.map(cardBy), trump)).toBeNull();
    expect(
      evaluateThrowLead({
        seat: 0,
        cards: plan.cardIds.map(cardBy),
        hand,
        hands: [
          hand,
          [cardBy('S-14-0'), cardBy('S-14-1')],
          [cardBy('H-14-0'), cardBy('H-14-1')],
          [cardBy('D-14-0'), cardBy('D-14-1')],
        ],
        trump,
      }),
    ).toMatchObject({ type: 'success' });
  });

  it('lead: avoids an unproven side-suit throw even with multiple pairs', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('S-9-0'),
        cardBy('S-9-1'),
        cardBy('S-12-0'),
        cardBy('S-12-1'),
        cardBy('H-3-0'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.reason).not.toBe('lead-safe-throw');
    expect(plan.cardIds).toHaveLength(1);
  });

  it('lead: treats main-level and joker pairs as an ordinary tractor, not a throw', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('H-2-0'),
        cardBy('H-2-1'),
        cardBy('joker-small-0'),
        cardBy('joker-small-1'),
        cardBy('joker-big-0'),
        cardBy('joker-big-1'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.reason).toBe('lead-tractor');
    expect(detectCombo(plan.cardIds.map(cardBy), trump)?.type).toBe('tractor');
  });

  it('lead: can safely throw off-suit level pairs with main-level and joker pairs held', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const hand = [
      cardBy('S-2-0'),
      cardBy('S-2-1'),
      cardBy('D-2-0'),
      cardBy('D-2-1'),
      cardBy('C-2-0'),
      cardBy('C-2-1'),
      cardBy('H-2-0'),
      cardBy('H-2-1'),
      cardBy('joker-small-0'),
      cardBy('joker-small-1'),
      cardBy('joker-big-0'),
      cardBy('joker-big-1'),
    ];
    const plan = explainPlay({
      hand,
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.reason).toBe('lead-safe-throw');
    expect(detectCombo(plan.cardIds.map(cardBy), trump)).toBeNull();
  });

  it('lead: does not treat small and big joker pairs alone as a throw', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('joker-small-0'),
        cardBy('joker-small-1'),
        cardBy('joker-big-0'),
        cardBy('joker-big-1'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.reason).toBe('lead-tractor');
    expect(plan.cardIds).toEqual(['joker-small-0', 'joker-small-1', 'joker-big-0', 'joker-big-1']);
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

  it('opponent winning with points: uses the smallest winning single instead of spending the ace', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-10-0')];
    const plan = explainPlay({
      hand: [cardBy('S-11-0'), cardBy('S-13-0'), cardBy('S-14-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 10,
    });

    expect(plan.cardIds).toEqual(['S-11-0']);
    expect(plan.reason).toBe('win-points-minimal');
  });

  it('void in lead suit with points: trumps with the cheapest trump single', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-10-0')];
    const plan = explainPlay({
      hand: [cardBy('H-3-0'), cardBy('H-14-0'), cardBy('D-3-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 10,
    });

    expect(plan.cardIds).toEqual(['H-3-0']);
    expect(plan.reason).toBe('trump-points-minimal');
  });

  it('pair with points: uses the smallest winning pair instead of the ace pair', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-10-0'), cardBy('S-10-1')];
    const plan = explainPlay({
      hand: [
        cardBy('S-11-0'), cardBy('S-11-1'),
        cardBy('S-13-0'), cardBy('S-13-1'),
        cardBy('S-14-0'), cardBy('S-14-1'),
      ],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['S-11-0', 'S-11-1']);
    expect(plan.reason).toBe('win-points-minimal');
  });

  it('pair with no points: keeps control pairs instead of winning a small trick', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-9-0'), cardBy('S-9-1')];
    const plan = explainPlay({
      hand: [
        cardBy('S-3-0'), cardBy('S-3-1'),
        cardBy('S-11-0'), cardBy('S-11-1'),
        cardBy('S-14-0'), cardBy('S-14-1'),
      ],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['S-3-0', 'S-3-1']);
    expect(plan.reason).toBe('preserve-control');
  });

  it('tractor with points: uses the smallest winning tractor', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-5-0'), cardBy('S-5-1'), cardBy('S-6-0'), cardBy('S-6-1')];
    const plan = explainPlay({
      hand: [
        cardBy('S-7-0'), cardBy('S-7-1'), cardBy('S-8-0'), cardBy('S-8-1'),
        cardBy('S-12-0'), cardBy('S-12-1'), cardBy('S-13-0'), cardBy('S-13-1'),
      ],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['S-7-0', 'S-7-1', 'S-8-0', 'S-8-1']);
    expect(plan.reason).toBe('win-points-minimal');
  });

  it('teammate winning a tractor: saves the higher tractor and sends points', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-13-0'), cardBy('S-13-1'), cardBy('S-14-0'), cardBy('S-14-1')];
    const plan = explainPlay({
      hand: [
        cardBy('S-5-0'), cardBy('S-5-1'), cardBy('S-6-0'), cardBy('S-6-1'),
        cardBy('S-11-0'), cardBy('S-11-1'), cardBy('S-12-0'), cardBy('S-12-1'),
      ],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 2,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['S-5-0', 'S-5-1', 'S-6-0', 'S-6-1']);
    expect(plan.reason).toBe('support-teammate');
  });

  it('void in pair lead with points: trumps with the cheapest trump pair', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-10-0'), cardBy('S-10-1')];
    const plan = explainPlay({
      hand: [
        cardBy('H-3-0'), cardBy('H-3-1'),
        cardBy('H-14-0'), cardBy('H-14-1'),
        cardBy('D-3-0'), cardBy('D-4-0'),
      ],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['H-3-0', 'H-3-1']);
    expect(plan.reason).toBe('trump-points-minimal');
  });

  it('void in tractor lead with points: uses a secure point-bearing trump tractor', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-5-0'), cardBy('S-5-1'), cardBy('S-6-0'), cardBy('S-6-1')];
    const plan = explainPlay({
      hand: [
        cardBy('H-3-0'), cardBy('H-3-1'), cardBy('H-4-0'), cardBy('H-4-1'),
        cardBy('H-13-0'), cardBy('H-13-1'), cardBy('H-14-0'), cardBy('H-14-1'),
        cardBy('D-3-0'), cardBy('D-4-0'), cardBy('D-6-0'), cardBy('D-7-0'),
      ],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [{ seat: 0, cards: lead, combo: detectCombo(lead, trump) }],
      seat: 1,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['H-13-0', 'H-13-1', 'H-14-0', 'H-14-1']);
    expect(plan.reason).toBe('trump-points-secure');
  });

  it('void in a mixed throw with points: trumps only with a full matching trump structure', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const leadCards = [cardBy('S-14-0'), cardBy('S-14-1'), cardBy('S-13-0')];
    const evaluated = evaluateThrowLead({
      seat: 0,
      cards: leadCards,
      hand: leadCards,
      hands: [leadCards, [], [], []],
      trump,
    });
    if (evaluated.type !== 'success') throw new Error('expected a successful mixed throw');

    const plan = explainPlay({
      hand: [
        cardBy('H-10-0'), cardBy('H-10-1'), cardBy('H-11-0'),
        cardBy('H-3-0'), cardBy('H-3-1'), cardBy('H-4-0'),
        cardBy('D-3-0'),
      ],
      trump,
      leadCombo: evaluated.combo,
      currentTrick: [{ seat: 0, cards: leadCards, combo: evaluated.combo }],
      seat: 1,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['H-3-0', 'H-3-1', 'H-4-0']);
    expect(plan.reason).toBe('trump-points-minimal');
  });

  it('does not try to trump a mixed throw without every required component', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const leadCards = [cardBy('S-14-0'), cardBy('S-14-1'), cardBy('S-13-0')];
    const evaluated = evaluateThrowLead({
      seat: 0,
      cards: leadCards,
      hand: leadCards,
      hands: [leadCards, [], [], []],
      trump,
    });
    if (evaluated.type !== 'success') throw new Error('expected a successful mixed throw');

    const plan = explainPlay({
      hand: [cardBy('H-3-0'), cardBy('H-4-0'), cardBy('H-6-0'), cardBy('D-3-0')],
      trump,
      leadCombo: evaluated.combo,
      currentTrick: [{ seat: 0, cards: leadCards, combo: evaluated.combo }],
      seat: 1,
      trickPointsSoFar: 20,
    });

    expect(plan.reason).toBe('avoid-points');
  });

  it('follows a mixed throw lead with as many required pairs as possible', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const leadCards = [cardBy('S-9-0'), cardBy('S-9-1'), cardBy('S-12-0'), cardBy('S-12-1')];
    const leadCombo = {
      type: 'throw' as const,
      cards: leadCards,
      suit: 'S' as const,
      strength: 12,
      components: [
        detectCombo([cardBy('S-9-0'), cardBy('S-9-1')], trump)!,
        detectCombo([cardBy('S-12-0'), cardBy('S-12-1')], trump)!,
      ],
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

  it('follows an opponent throw with the lowest required pairs, independent of hand order', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const leadCards = [cardBy('S-9-0'), cardBy('S-9-1'), cardBy('S-12-0'), cardBy('S-12-1')];
    const leadCombo = {
      type: 'throw' as const,
      cards: leadCards,
      suit: 'S' as const,
      strength: 12,
      components: [
        detectCombo([cardBy('S-9-0'), cardBy('S-9-1')], trump)!,
        detectCombo([cardBy('S-12-0'), cardBy('S-12-1')], trump)!,
      ],
    };
    const plan = explainPlay({
      hand: [
        cardBy('S-14-0'), cardBy('S-14-1'),
        cardBy('S-3-0'), cardBy('S-3-1'),
        cardBy('S-4-0'), cardBy('S-4-1'),
      ],
      trump,
      leadCombo,
      currentTrick: [{ seat: 0, cards: leadCards, combo: leadCombo }],
      seat: 1,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['S-3-0', 'S-3-1', 'S-4-0', 'S-4-1']);
    expect(plan.reason).toBe('follow-throw');
  });

  it('follows a teammate throw by sending points while saving the ace pair', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const leadCards = [cardBy('S-9-0'), cardBy('S-9-1'), cardBy('S-12-0'), cardBy('S-12-1')];
    const leadCombo = {
      type: 'throw' as const,
      cards: leadCards,
      suit: 'S' as const,
      strength: 12,
      components: [
        detectCombo([cardBy('S-9-0'), cardBy('S-9-1')], trump)!,
        detectCombo([cardBy('S-12-0'), cardBy('S-12-1')], trump)!,
      ],
    };
    const plan = explainPlay({
      hand: [
        cardBy('S-14-0'), cardBy('S-14-1'),
        cardBy('S-3-0'), cardBy('S-3-1'),
        cardBy('S-5-0'), cardBy('S-5-1'),
      ],
      trump,
      leadCombo,
      currentTrick: [{ seat: 0, cards: leadCards, combo: leadCombo }],
      seat: 2,
      trickPointsSoFar: 20,
    });

    expect(plan.cardIds).toEqual(['S-5-0', 'S-5-1', 'S-3-0', 'S-3-1']);
    expect(plan.reason).toBe('follow-throw');
  });

  it('leads a provably safe mixed AAK throw', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [cardBy('S-14-0'), cardBy('S-14-1'), cardBy('S-13-0'), cardBy('C-3-0')],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['S-14-0', 'S-14-1', 'S-13-0']);
    expect(plan.reason).toBe('lead-safe-throw');
  });

  it('uses the fixed signal card to tell a bot teammate about the second ace', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-14-0')];
    const second = [cardBy('S-3-0')];
    const base = {
      hand: [cardBy('S-14-1'), cardBy('S-9-0'), cardBy('S-10-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 0, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 1, cards: second, combo: detectCombo(second, trump) },
      ],
      seat: 2,
      trickPointsSoFar: 0,
    };

    expect(explainPlay({ ...base, botSeats: [true, true, true, true] })).toMatchObject({
      cardIds: ['S-9-0'],
      reason: 'signal-second-ace',
    });
    expect(explainPlay({ ...base, botSeats: [false, true, true, true] }).cardIds).toEqual(['S-10-0']);
  });

  it('lets a score threshold override the second-ace signal', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-14-0')];
    const second = [cardBy('S-3-0')];
    const plan = explainPlay({
      hand: [cardBy('S-14-1'), cardBy('S-9-0'), cardBy('S-5-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 1, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 2, cards: second, combo: detectCombo(second, trump) },
      ],
      seat: 3,
      trickPointsSoFar: 0,
      botSeats: [true, true, true, true],
      dealerSeat: 0,
      defenderPoints: 35,
    });

    expect(plan.cardIds).toEqual(['S-5-0']);
    expect(plan.reason).toBe('support-teammate');
  });

  it('does not let a generic control signal override safe point delivery', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-14-0')];
    const second = [cardBy('S-3-0')];
    const plan = explainPlay({
      hand: [cardBy('D-14-0'), cardBy('D-9-0'), cardBy('C-10-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 0, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 1, cards: second, combo: detectCombo(second, trump) },
      ],
      seat: 2,
      trickPointsSoFar: 0,
      botSeats: [true, true, true, true],
    });

    expect(plan.cardIds).toEqual(['C-10-0']);
    expect(plan.reason).toBe('support-teammate');
  });

  it('reads the second-ace signal and leads the suit back to its bot teammate', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const trick = [
      { seat: 0, cards: [cardBy('S-14-0')], combo: detectCombo([cardBy('S-14-0')], trump) },
      { seat: 1, cards: [cardBy('S-3-0')], combo: detectCombo([cardBy('S-3-0')], trump) },
      { seat: 2, cards: [cardBy('S-9-0')], combo: detectCombo([cardBy('S-9-0')], trump) },
      { seat: 3, cards: [cardBy('S-4-0')], combo: detectCombo([cardBy('S-4-0')], trump) },
    ];
    const plan = explainPlay({
      hand: [cardBy('S-6-0'), cardBy('C-3-0'), cardBy('D-5-0')],
      trump,
      leadCombo: null,
      currentTrick: [],
      trickHistory: [trick],
      seat: 0,
      trickPointsSoFar: 0,
      botSeats: [true, true, true, true],
    });

    expect(plan.cardIds).toEqual(['S-6-0']);
    expect(plan.reason).toBe('lead-to-signaled-ace');
  });

  it('signals for a bot teammate to take over after side controls are exhausted', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [
        cardBy('H-9-0'), cardBy('H-3-0'),
        cardBy('S-10-0'), cardBy('D-5-0'), cardBy('C-3-0'), cardBy('S-6-0'),
      ],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
      botSeats: [true, true, true, true],
    });

    expect(plan.cardIds).toEqual(['H-9-0']);
    expect(plan.reason).toBe('lead-transfer-trump');
  });

  it('accepts a bot teammate transfer signal with the cheapest secure higher trump', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const oldLead = [cardBy('H-7-0')];
    const history = [[
      { seat: 0, cards: oldLead, combo: detectCombo(oldLead, trump) },
      { seat: 1, cards: [cardBy('H-8-0')], combo: detectCombo([cardBy('H-8-0')], trump) },
      { seat: 2, cards: [cardBy('H-12-0')], combo: detectCombo([cardBy('H-12-0')], trump) },
      { seat: 3, cards: [cardBy('D-4-0')], combo: detectCombo([cardBy('D-4-0')], trump) },
    ]];
    const lead = [cardBy('H-9-0')];
    const second = [cardBy('H-3-0')];
    const plan = explainPlay({
      hand: [cardBy('H-10-0'), cardBy('H-11-0'), cardBy('S-3-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 0, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 1, cards: second, combo: detectCombo(second, trump) },
      ],
      trickHistory: history,
      seat: 2,
      trickPointsSoFar: 0,
      botSeats: [true, true, true, true],
    });

    expect(plan.cardIds).toEqual(['H-10-0']);
    expect(plan.reason).toBe('take-transfer-lead');
  });

  it('uses a point trump when the last opponent is very likely forced to follow suit', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const lead = [cardBy('S-10-0')];
    const second = [cardBy('S-14-0')];
    const plan = explainPlay({
      hand: [cardBy('H-3-0'), cardBy('H-10-0'), cardBy('D-4-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 0, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 1, cards: second, combo: detectCombo(second, trump) },
      ],
      seat: 2,
      trickPointsSoFar: 10,
    });

    expect(plan.cardIds).toEqual(['H-10-0']);
    expect(plan.reason).toBe('trump-points-secure');
  });

  it('unloads a high blocker when the teammate is inferred to be long in that suit', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const oldLead = [cardBy('D-4-0')];
    const history = [[
      { seat: 0, cards: oldLead, combo: detectCombo(oldLead, trump) },
      { seat: 1, cards: [cardBy('C-3-0')], combo: detectCombo([cardBy('C-3-0')], trump) },
      { seat: 2, cards: [cardBy('D-5-0')], combo: detectCombo([cardBy('D-5-0')], trump) },
      { seat: 3, cards: [cardBy('C-4-0')], combo: detectCombo([cardBy('C-4-0')], trump) },
    ]];
    const lead = [cardBy('S-14-0')];
    const second = [cardBy('S-3-0')];
    const plan = explainPlay({
      hand: [cardBy('D-14-0'), cardBy('C-6-0'), cardBy('H-3-0')],
      trump,
      leadCombo: detectCombo(lead, trump),
      currentTrick: [
        { seat: 0, cards: lead, combo: detectCombo(lead, trump) },
        { seat: 1, cards: second, combo: detectCombo(second, trump) },
      ],
      trickHistory: history,
      seat: 2,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['D-14-0']);
    expect(plan.reason).toBe('unblock-teammate-throw');
  });

  it('delays an ace pair while a harmless loose single is available', () => {
    const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
    const plan = explainPlay({
      hand: [cardBy('S-14-0'), cardBy('S-14-1'), cardBy('D-3-0'), cardBy('H-4-0')],
      trump,
      leadCombo: null,
      currentTrick: [],
      seat: 0,
      trickPointsSoFar: 0,
    });

    expect(plan.cardIds).toEqual(['D-3-0']);
    expect(plan.reason).toBe('lead-preserve-shape-single');
  });
});
