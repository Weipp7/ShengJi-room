import { describe, it, expect } from 'vitest';
import type { RoundState, StepResult } from '../src/round';
import {
  advanceDeal,
  closePreKittyBidWindow,
  createRound,
  applyReveal,
  applyPass,
  applyBury,
  applyPlay,
} from '../src/round';
import { validateLead, validateFollow } from '../src/follow';
import { c, joker, mulberry32 } from './helpers';

function expectOk(r: StepResult): RoundState {
  if (!r.ok) throw new Error(`step failed: ${r.error.code}`);
  return r.state;
}

function finishPostBuryBidding(s: RoundState): RoundState {
  let next = s;
  while (next.phase === 'bidding' && next.biddingStage === 'post-bury') {
    next = expectOk(applyPass(next, next.biddingTurn!));
  }
  return next;
}

function closeBidWindow(s: RoundState): RoundState {
  const result = closePreKittyBidWindow(s);
  if (!result.ok) throw new Error(`close bid window failed: ${result.error.code}`);
  if (result.action === 'redeal') throw new Error('unexpected first-round redeal');
  return result.state;
}

function buryAndStartPlaying(s: RoundState, seat: number, cardIds: string[]): RoundState {
  return finishPostBuryBidding(expectOk(applyBury(s, seat, cardIds)));
}

// 遍历 turnSeat 手牌，返回第一张可合法打出的单张 id
function pickAnyLegalSingle(s: RoundState): string {
  const hand = s.hands[s.turnSeat];
  const lead = s.currentTrick.length > 0 ? s.currentTrick[0].combo : null;
  for (const card of hand) {
    const res =
      lead === null
        ? validateLead([card], hand, s.trump)
        : validateFollow(lead, [card], hand, s.trump);
    if (res.ok) return card.id;
  }
  throw new Error('no legal single found');
}

// 优先出对子，其次单张，返回第一组合法出牌的 id 列表
function pickAnyLegalPlay(s: RoundState): string[] {
  const hand = s.hands[s.turnSeat];
  const lead = s.currentTrick.length > 0 ? s.currentTrick[0].combo : null;
  const check = (cards: typeof hand) =>
    lead === null ? validateLead(cards, hand, s.trump) : validateFollow(lead, cards, hand, s.trump);
  const wanted = lead === null ? 2 : lead.cards.length;
  if (wanted === 1) {
    return [pickAnyLegalSingle(s)];
  }
  if (wanted === 2) {
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        if (check([hand[i], hand[j]]).ok) return [hand[i].id, hand[j].id];
      }
    }
  }
  if (lead === null) {
    return [pickAnyLegalSingle(s)];
  }
  throw new Error('no legal play found');
}

function cardCount(s: RoundState): number {
  return (
    s.hands.reduce((n, h) => n + h.length, 0) +
    s.kitty.length +
    s.currentTrick.reduce((n, p) => n + p.cards.length, 0)
  );
}

describe('round state machine', () => {
  it('uses a shared timed pre-kitty window and resets its deadline after each legal counter', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(12),
      now: 1_000,
    });
    s = {
      ...s,
      hands: [
        [c('S', 2, 0)],
        [c('H', 2, 0), c('H', 2, 1)],
        [],
        [],
      ],
    };

    s = expectOk(applyReveal(s, 0, ['S-2-0'], 2_000));
    expect(s.bidHistory.map((event) => event.kind)).toEqual(['suit-single']);
    expect(s).toMatchObject({
      phase: 'bidding',
      dealerSeat: 0,
      biddingTurn: null,
      bidWindowEndsAt: 7_000,
      passStreak: 0,
      trump: { trumpSuit: 'S', level: 2 },
      currentBid: { seat: 0, kind: 'suit-single', suit: 'S' },
    });

    s = expectOk(applyReveal(s, 1, ['H-2-0', 'H-2-1'], 3_000));
    expect(s.bidHistory.map((event) => event.kind)).toEqual(['suit-single', 'suit-pair']);
    expect(s).toMatchObject({
      phase: 'bidding',
      dealerSeat: 1,
      biddingTurn: null,
      bidWindowEndsAt: 8_000,
      passStreak: 0,
      trump: { trumpSuit: 'H', level: 2 },
      currentBid: { seat: 1, kind: 'suit-pair', suit: 'H' },
    });

    const beforeExpiredReveal = structuredClone(s);
    expect(applyReveal(s, 2, [], 8_000)).toMatchObject({
      ok: false,
      error: { code: 'bid-window-closed' },
    });
    expect(s).toEqual(beforeExpiredReveal);

    expect(applyPass(s, 2)).toMatchObject({
      ok: false,
      error: { code: 'pass-not-required' },
    });
    s = closeBidWindow(s);
    expect(s.phase).toBe('burying');
    expect(s.dealerSeat).toBe(1);
    expect(s.trump.trumpSuit).toBe('H');
    expect(s.hands[1]).toHaveLength(10);
    expect(s.biddingStage).toBeNull();
  });

  it('deals progressively and allows any player to reveal only cards already received', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(99),
      progressiveDeal: true,
    });
    s = {
      ...s,
      hands: [[c('S', 2, 0), c('S', 2, 1)], [], [], []],
    };

    expect(s.dealtCount).toBe(0);
    expect(applyReveal(s, 0, ['S-2-0'])).toMatchObject({
      ok: false,
      error: { code: 'cards-not-in-hand' },
    });
    s = advanceDeal(s);
    s = expectOk(applyReveal(s, 0, ['S-2-0'], 2_000));
    expect(s.currentBid).toMatchObject({ seat: 0, kind: 'suit-single' });
    expect(applyReveal(s, 0, ['S-2-0', 'S-2-1'])).toMatchObject({
      ok: false,
      error: { code: 'cards-not-in-hand' },
    });

    while (s.dealtCount < 25) s = advanceDeal(s);
    expect(s.biddingStage).toBe('dealing');
    s = advanceDeal(s);
    expect(s.biddingStage).toBe('pre-dealer');
    expect(s.biddingTurn).toBeNull();
    expect(s.bidWindowEndsAt).not.toBeNull();
  });

  it('requests a redeal when the first-round shared window closes without a bid', () => {
    const s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(991) });
    expect(closePreKittyBidWindow(s)).toEqual({ ok: true, action: 'redeal' });
  });

  it('treats a later-round no-bid contract as final no-trump even when chaodi is enabled', () => {
    let s = createRound({
      plannedDealerSeat: 2,
      teamLevels: [2, 2],
      rng: mulberry32(992),
      isFirstRound: false,
      chaodiEnabled: true,
    });
    s = closeBidWindow(s);
    expect(s.trump.trumpSuit).toBeNull();
    expect(s.buryingSeat).toBe(2);
    s = expectOk(applyBury(s, 2, s.hands[2].slice(0, 8).map((card) => card.id)));
    expect(s.phase).toBe('playing');
    expect(s.biddingStage).toBeNull();
  });

  it('skips post-bury counters when chaodi is disabled even after a successful bid', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(993),
      isFirstRound: false,
      chaodiEnabled: false,
    });
    const bidderSeat = s.hands.findIndex((hand) =>
      hand.some((card) => card.kind === 'suit' && card.rank === s.level),
    );
    const levelCard = s.hands[bidderSeat].find(
      (card) => card.kind === 'suit' && card.rank === s.level,
    );
    expect(levelCard).toBeDefined();
    s = expectOk(applyReveal(s, bidderSeat, [levelCard!.id]));
    s = closeBidWindow(s);
    s = expectOk(applyBury(s, 0, s.hands[0].slice(0, 8).map((card) => card.id)));
    expect(s.phase).toBe('playing');
    expect(s.postBuryBidQueue).toEqual([]);
  });

  it('keeps the predetermined dealer on later rounds when another player calls', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(100),
      isFirstRound: false,
    });
    s = {
      ...s,
      hands: [[], [c('H', 2, 0)], [], []],
    };
    s = expectOk(applyReveal(s, 1, ['H-2-0']));
    expect(s.dealerSeat).toBe(0);
    expect(s.currentBid?.seat).toBe(1);
    expect(s.trump.trumpSuit).toBe('H');
  });

  it('locks dealer/current bidder after burying and restores them after another player counters', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(101),
      isFirstRound: false,
      chaodiEnabled: true,
    });
    s = {
      ...s,
      hands: [
        [
          ...Array.from({ length: 31 }, (_, i) => c('C', ((i % 12) + 3) as 3, i)),
          joker('small', 0),
          joker('small', 1),
        ],
        [c('H', 2, 0), c('H', 2, 1)],
        [c('S', 2, 0), c('S', 2, 1)],
        [c('D', 2, 0), c('D', 2, 1)],
      ],
      phase: 'burying',
      dealerSeat: 0,
      currentBid: {
        seat: 1,
        kind: 'suit-pair',
        suit: 'H',
        cards: [c('H', 2, 0), c('H', 2, 1)],
      },
      trump: { trumpSuit: 'H', level: 2 },
      buryingSeat: 0,
    };

    s = expectOk(applyBury(s, 0, s.hands[0].slice(0, 8).map((card) => card.id)));
    expect(s).toMatchObject({
      phase: 'bidding',
      biddingStage: 'post-bury',
      postBuryBidQueue: [2, 3],
      biddingTurn: 2,
    });
    expect(applyReveal(s, 2, ['S-2-0'])).toMatchObject({
      ok: false,
      error: { code: 'invalid-bid' },
    });

    s = expectOk(applyReveal(s, 2, ['S-2-0', 'S-2-1']));
    expect(s.phase).toBe('burying');
    expect(s.buryingSeat).toBe(2);
    expect(s.postBuryBidQueue).toEqual([3, 0, 1]);
    expect(s.biddingTurn).toBeNull();
    expect(s.dealerSeat).toBe(0);
    expect(s.currentBid?.seat).toBe(2);

    // 反主者拿起当前底牌，重新埋 8 张后才开启下一轮反主。
    expect(s.hands[2]).toHaveLength(10);
    expect(s.kitty).toHaveLength(0);
    s = expectOk(applyBury(s, 2, s.hands[2].slice(2).map((card) => card.id)));
    expect(s).toMatchObject({
      phase: 'bidding',
      biddingStage: 'post-bury',
      postBuryBidQueue: [3, 0, 1],
      biddingTurn: 3,
      buryingSeat: null,
    });
    expect(applyReveal(s, 3, ['D-2-0', 'D-2-1'])).toMatchObject({
      ok: false,
      error: { code: 'invalid-bid' },
    });
    expect(applyReveal(s, 2, ['S-2-0', 'S-2-1'])).toMatchObject({
      ok: false,
      error: { code: 'wrong-turn' },
    });

    // 前一轮被锁定的庄家恢复反主权；反主后同样拿底重埋，但庄家身份不变。
    s = expectOk(applyPass(s, 3));
    s = expectOk(applyReveal(s, 0, ['joker-small-0', 'joker-small-1']));
    expect(s.phase).toBe('burying');
    expect(s.buryingSeat).toBe(0);
    expect(s.dealerSeat).toBe(0);
    expect(s.hands[0]).toHaveLength(33);
    s = expectOk(applyBury(s, 0, s.hands[0].slice(-8).map((card) => card.id)));
    expect(s.postBuryBidQueue).toEqual([1, 2, 3]);
    expect(s.biddingTurn).toBe(1);
    for (const seat of [1, 2, 3]) s = expectOk(applyPass(s, seat));
    expect(s.phase).toBe('playing');
    expect(s.turnSeat).toBe(0);
  });

  it('invalid and repeated reveal attempts do not mutate state', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(13) });
    s = {
      ...s,
      hands: [
        [c('S', 2, 0)],
        [c('D', 2, 0), c('C', 3, 0), c('C', 3, 1)],
        [],
        [],
      ],
    };
    s = expectOk(applyReveal(s, 0, ['S-2-0']));

    const beforeSameStrength = structuredClone(s);
    expect(applyReveal(s, 1, ['D-2-0'])).toMatchObject({
      ok: false,
      error: { code: 'invalid-bid' },
    });
    expect(s).toEqual(beforeSameStrength);

    const beforeMalformed = structuredClone(s);
    expect(applyReveal(s, 1, ['C-3-0', 'C-3-1'])).toMatchObject({
      ok: false,
      error: { code: 'invalid-bid' },
    });
    expect(s).toEqual(beforeMalformed);

    const beforeLockedBidder = structuredClone(s);
    expect(applyReveal(s, 0, ['S-2-0'])).toMatchObject({
      ok: false,
      error: { code: 'current-bidder-locked' },
    });
    expect(s).toEqual(beforeLockedBidder);
  });

  it('uses the planned dealer team level for the whole bidding phase', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 7], rng: mulberry32(14) });
    s = {
      ...s,
      hands: [
        [c('S', 2, 0)],
        [c('H', 7, 0), c('H', 7, 1), c('D', 2, 0), c('D', 2, 1)],
        [],
        [],
      ],
    };
    s = expectOk(applyReveal(s, 0, ['S-2-0']));
    expect(applyReveal(s, 1, ['H-7-0', 'H-7-1'])).toMatchObject({
      ok: false,
      error: { code: 'invalid-bid' },
    });

    s = expectOk(applyReveal(s, 1, ['D-2-0', 'D-2-1']));
    expect(s.dealerSeat).toBe(1);
    expect(s.trump).toEqual({ trumpSuit: 'D', level: 2 });
  });

  it('full round with scripted actions reaches scoring', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(7),
      isFirstRound: false,
    });
    expect(s.phase).toBe('bidding');
    // 后续局 5 秒内无人亮主 → 无主局，计划庄家拿底。
    s = closeBidWindow(s);
    expect(s.phase).toBe('burying');
    expect(s.trump.trumpSuit).toBeNull();
    expect(s.dealerSeat).toBe(0);
    expect(s.hands[0]).toHaveLength(33);
    // 庄家埋 8 张
    s = buryAndStartPlaying(s, 0, s.hands[0].slice(0, 8).map((card) => card.id));
    expect(s.phase).toBe('playing');
    expect(s.hands[0]).toHaveLength(25);
    expect(s.kitty).toHaveLength(8);
    expect(s.turnSeat).toBe(0);
    // 单张打满 25 墩
    while (s.phase === 'playing') {
      s = expectOk(applyPlay(s, s.turnSeat, [pickAnyLegalSingle(s)]));
    }
    expect(s.phase).toBe('scoring');
    expect(s.tricksPlayed).toBe(25);
    expect(s.result).not.toBeNull();
    expect(Number.isFinite(s.result!.defenderPoints)).toBe(true);
    expect(s.hands.every((h) => h.length === 0)).toBe(true);
  });

  it('round ends when hands are empty even with multi-card plays', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(99),
      isFirstRound: false,
    });
    s = closeBidWindow(s);
    s = buryAndStartPlaying(s, 0, s.hands[0].slice(0, 8).map((card) => card.id));
    // 领牌尽量出对子 → 手牌会早于 25 墩打空
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 400) {
      s = expectOk(applyPlay(s, s.turnSeat, pickAnyLegalPlay(s)));
    }
    expect(s.phase).toBe('scoring');
    expect(s.hands.every((h) => h.length === 0)).toBe(true);
    expect(s.result).not.toBeNull();
  });

  it('keeps last trick winner stable while the next trick advances', () => {
    let s = createRound({
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      rng: mulberry32(5),
      isFirstRound: false,
    });
    s = closeBidWindow(s);
    s = buryAndStartPlaying(s, 0, s.hands[0].slice(0, 8).map((card) => card.id));

    // 第一墩用合法单张打满，记录真实收墩者。
    while (s.phase === 'playing' && s.currentTrick.length < 3) {
      s = expectOk(applyPlay(s, s.turnSeat, [pickAnyLegalSingle(s)]));
    }
    s = expectOk(applyPlay(s, s.turnSeat, [pickAnyLegalSingle(s)]));
    expect(s.lastTrick).toHaveLength(4);
    const winner = s.lastTrickWinnerSeat;
    expect(winner).not.toBeNull();
    expect(s.turnSeat).toBe(winner);

    // 下一墩领出后 turnSeat 会推进，但 lastTrickWinnerSeat 必须仍指向上一墩赢家。
    s = expectOk(applyPlay(s, s.turnSeat, [pickAnyLegalSingle(s)]));
    expect(s.currentTrick).toHaveLength(1);
    expect(s.turnSeat).not.toBe(winner);
    expect(s.lastTrickWinnerSeat).toBe(winner);
  });

  it('settles kitty bonus using cards per player from a multi-card final trick', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(31) });
    s = {
      ...s,
      phase: 'playing',
      biddingStage: null,
      dealerSeat: 0,
      trump: { trumpSuit: 'S', level: 2 },
      hands: [
        [c('H', 4, 0), c('H', 4, 1)],
        [c('H', 14, 0), c('H', 14, 1)],
        [c('H', 3, 0), c('H', 3, 1)],
        [c('H', 12, 0), c('H', 12, 1)],
      ],
      kitty: [c('D', 5, 0), c('D', 10, 0)],
      currentTrick: [],
      lastTrick: [],
      lastTrickWinnerSeat: null,
      defenderTrickPoints: 20,
      tricksPlayed: 24,
      turnSeat: 1,
      result: null,
    };

    s = expectOk(applyPlay(s, 1, ['H-14-0', 'H-14-1']));
    s = expectOk(applyPlay(s, 2, ['H-3-0', 'H-3-1']));
    s = expectOk(applyPlay(s, 3, ['H-12-0', 'H-12-1']));
    s = expectOk(applyPlay(s, 0, ['H-4-0', 'H-4-1']));

    expect(s.phase).toBe('scoring');
    expect(s.lastTrickWinnerSeat).toBe(1);
    expect(s.result?.kittyBonus).toBe(60);
    expect(s.result?.defenderPoints).toBe(80);
  });

  it('uses the largest throw component rather than every thrown card for kitty multiplication', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(32) });
    s = {
      ...s,
      phase: 'playing',
      biddingStage: null,
      dealerSeat: 0,
      trump: { trumpSuit: 'S', level: 2 },
      hands: [
        [c('D', 3, 0), c('D', 4, 0), c('D', 6, 0), c('D', 7, 0), c('D', 8, 0), c('D', 9, 0), c('D', 12, 0)],
        [c('H', 14, 0), c('H', 14, 1), c('H', 13, 0), c('H', 13, 1), c('H', 12, 0), c('H', 11, 0), c('H', 11, 1)],
        [c('H', 10, 0), c('H', 10, 1), c('H', 9, 0), c('H', 9, 1), c('H', 8, 0), c('H', 7, 0), c('H', 7, 1)],
        [c('H', 6, 0), c('H', 6, 1), c('H', 5, 0), c('H', 5, 1), c('H', 4, 0), c('H', 4, 1), c('H', 3, 0)],
      ],
      kitty: [c('D', 5, 0), c('D', 10, 0)],
      currentTrick: [],
      lastTrick: [],
      lastTrickWinnerSeat: null,
      defenderTrickPoints: 0,
      tricksPlayed: 24,
      turnSeat: 1,
      result: null,
    };

    s = expectOk(applyPlay(s, 1, ['H-14-0', 'H-14-1', 'H-13-0', 'H-13-1', 'H-12-0', 'H-11-0', 'H-11-1']));
    expect(s.currentTrick[0].throwEvent?.success).toBe(true);
    s = expectOk(applyPlay(s, 2, ['H-10-0', 'H-10-1', 'H-9-0', 'H-9-1', 'H-8-0', 'H-7-0', 'H-7-1']));
    s = expectOk(applyPlay(s, 3, ['H-6-0', 'H-6-1', 'H-5-0', 'H-5-1', 'H-4-0', 'H-4-1', 'H-3-0']));
    s = expectOk(applyPlay(s, 0, ['D-3-0', 'D-4-0', 'D-6-0', 'D-7-0', 'D-8-0', 'D-9-0', 'D-12-0']));

    expect(s.phase).toBe('scoring');
    expect(s.lastTrickWinnerSeat).toBe(1);
    expect(s.result?.kittyBonus).toBe(240); // 15 分 × 2^4，而不是 × 2^7
    expect(s.result?.baseDefenderPoints).toBe(290);
  });

  it('failed throw lead only places the lowest beatable pair and records team penalty', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(61) });
    const attempt = [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)];
    s = {
      ...s,
      phase: 'playing',
      biddingStage: null,
      dealerSeat: 0,
      trump: { trumpSuit: 'H', level: 2 },
      hands: [
        attempt,
        [c('S', 6, 0), c('S', 6, 1)],
        [c('S', 3, 0), c('S', 3, 1)],
        [c('S', 4, 0), c('S', 4, 1)],
      ],
      kitty: [],
      currentTrick: [],
      lastTrick: [],
      lastTrickWinnerSeat: null,
      defenderTrickPoints: 0,
      throwPenaltyPoints: [0, 0],
      throwEvents: [],
      tricksPlayed: 0,
      turnSeat: 0,
      result: null,
    };

    s = expectOk(applyPlay(s, 0, attempt.map((card) => card.id)));

    expect(s.currentTrick).toHaveLength(1);
    expect(s.currentTrick[0].cards.map((card) => card.id)).toEqual(['S-5-0', 'S-5-1']);
    expect(s.currentTrick[0].throwEvent).toMatchObject({
      success: false,
      penaltyPoints: 40,
      beneficiaryTeam: 1,
    });
    expect(s.throwPenaltyPoints).toEqual([0, 40]);
    expect(s.throwEvents).toHaveLength(1);
    expect(s.hands[0].map((card) => card.id)).toEqual(['S-8-0', 'S-8-1']);

    s = expectOk(applyPlay(s, 1, ['S-6-0', 'S-6-1']));
    s = expectOk(applyPlay(s, 2, ['S-3-0', 'S-3-1']));
    s = expectOk(applyPlay(s, 3, ['S-4-0', 'S-4-1']));
    expect(s.lastTrick[0].cards).toHaveLength(2);
    expect(s.lastTrickWinnerSeat).toBe(1);
    expect(s.throwPenaltyPoints).toEqual([0, 40]);
    expect(s.trickHistory).toHaveLength(1);
    expect(s.trickHistory[0]).toEqual(s.lastTrick);
  });

  it('successful throw lead enters the full trick and the leader wins the trick', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(62) });
    const attempt = [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)];
    s = {
      ...s,
      phase: 'playing',
      biddingStage: null,
      dealerSeat: 0,
      trump: { trumpSuit: 'H', level: 2 },
      hands: [
        attempt,
        [c('S', 3, 0), c('S', 3, 1), c('D', 3, 0), c('D', 4, 0)],
        [c('S', 4, 0), c('S', 4, 1), c('C', 3, 0), c('C', 4, 0)],
        [c('S', 7, 0), c('D', 8, 0), c('D', 9, 0), c('C', 9, 0)],
      ],
      kitty: [],
      currentTrick: [],
      lastTrick: [],
      lastTrickWinnerSeat: null,
      defenderTrickPoints: 0,
      throwPenaltyPoints: [0, 0],
      throwEvents: [],
      tricksPlayed: 0,
      turnSeat: 0,
      result: null,
    };

    s = expectOk(applyPlay(s, 0, attempt.map((card) => card.id)));
    expect(s.currentTrick[0].cards).toHaveLength(4);
    expect(s.currentTrick[0].combo).toMatchObject({ type: 'throw', suit: 'S' });
    expect(s.currentTrick[0].throwEvent).toMatchObject({ success: true, n: 2 });
    expect(s.throwEvents).toHaveLength(1);

    s = expectOk(applyPlay(s, 1, ['S-3-0', 'S-3-1', 'D-3-0', 'D-4-0']));
    s = expectOk(applyPlay(s, 2, ['S-4-0', 'S-4-1', 'C-3-0', 'C-4-0']));
    s = expectOk(applyPlay(s, 3, ['S-7-0', 'D-8-0', 'D-9-0', 'C-9-0']));
    expect(s.lastTrickWinnerSeat).toBe(0);
    expect(s.throwPenaltyPoints).toEqual([0, 0]);
  });

  it('teammate cards also fail a throw and penalize the throwing side', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(63) });
    const attempt = [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)];
    s = {
      ...s,
      phase: 'playing',
      biddingStage: null,
      dealerSeat: 0,
      trump: { trumpSuit: 'H', level: 2 },
      hands: [
        attempt,
        [c('S', 3, 0), c('S', 3, 1), c('D', 3, 0), c('D', 4, 0)],
        [c('S', 9, 0), c('S', 9, 1), c('C', 3, 0), c('C', 4, 0)],
        [c('S', 4, 0), c('S', 4, 1), c('D', 8, 0), c('D', 9, 0)],
      ],
      kitty: [],
      currentTrick: [],
      lastTrick: [],
      lastTrickWinnerSeat: null,
      defenderTrickPoints: 0,
      throwPenaltyPoints: [0, 0],
      throwEvents: [],
      tricksPlayed: 0,
      turnSeat: 0,
      result: null,
    };

    s = expectOk(applyPlay(s, 0, attempt.map((card) => card.id)));

    expect(s.currentTrick[0].cards.map((card) => card.id)).toEqual(['S-5-0', 'S-5-1']);
    expect(s.currentTrick[0].throwEvent).toMatchObject({ success: false, penaltyPoints: 40 });
    expect(s.throwPenaltyPoints).toEqual([0, 40]);
    expect(s.hands[0].map((card) => card.id)).toEqual(['S-8-0', 'S-8-1']);
  });

  it('reveal makes revealer the dealer and sets trump', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(11) });
    // 沿叫主轮次找到第一个持有级牌的座位并亮主
    let revealed = false;
    for (let i = 0; i < 4 && !revealed; i++) {
      const seat = i;
      const levelCard = s.hands[seat].find(
        (card) => card.kind === 'suit' && card.rank === s.trump.level,
      );
      if (levelCard) {
        s = expectOk(applyReveal(s, seat, [levelCard.id]));
        expect(s.dealerSeat).toBe(seat);
        expect(s.currentBid).not.toBeNull();
        expect(s.trump.trumpSuit).toBe(levelCard.kind === 'suit' ? levelCard.suit : null);
        revealed = true;
      }
    }
    expect(revealed).toBe(true);
    // 其余三家过 → 进入 burying，庄家即亮主者
    const dealer = s.dealerSeat;
    s = closeBidWindow(s);
    expect(s.phase).toBe('burying');
    expect(s.dealerSeat).toBe(dealer);
  });

  it('wrong turn / wrong phase / bad bury count rejected', () => {
    let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(3) });
    expect(applyPass(s, 1)).toMatchObject({
      ok: false,
      error: { code: 'pass-not-required' },
    });
    expect(applyBury(s, 0, [])).toMatchObject({ ok: false, error: { code: 'wrong-phase' } });
    s = { ...s, isFirstRound: false };
    s = closeBidWindow(s);
    expect(
      applyBury(s, 0, s.hands[0].slice(0, 7).map((card) => card.id)),
    ).toMatchObject({ ok: false, error: { code: 'bad-bury-count' } });
    expect(
      applyBury(s, 1, s.hands[1].slice(0, 8).map((card) => card.id)),
    ).toMatchObject({ ok: false, error: { code: 'not-burying-player' } });
  });

  it('all cards conserved: hands+kitty+trick = 108 minus completed tricks', () => {
    let s = createRound({
      plannedDealerSeat: 1,
      teamLevels: [5, 3],
      rng: mulberry32(42),
      isFirstRound: false,
    });
    expect(cardCount(s)).toBe(108);
    s = closeBidWindow(s);
    expect(cardCount(s)).toBe(108); // 底牌并入庄家手
    s = buryAndStartPlaying(
      s,
      s.dealerSeat,
      s.hands[s.dealerSeat].slice(0, 8).map((card) => card.id),
    );
    let played = 0;
    while (s.phase === 'playing') {
      s = expectOk(applyPlay(s, s.turnSeat, [pickAnyLegalSingle(s)]));
      played += 1;
      const completed = s.tricksPlayed * 1 * 4; // 每墩单张 4 张
      expect(cardCount(s)).toBe(108 - completed);
    }
    expect(played).toBe(100);
  });
});
