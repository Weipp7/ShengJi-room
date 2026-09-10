import { describe, expect, it } from 'vitest';
import type { Bid, Card, RoomStateView, ThrowEventView } from '@shengji/shared';
import { deriveAnnouncements } from '../src/lib/announcements';

function c(suit: 'S' | 'H' | 'D' | 'C', rank: number, copy: number): Card {
  return { id: `${suit}${rank}-${copy}`, kind: 'suit', suit, rank: rank as Card & never } as Card;
}

function joker(j: 'small' | 'big', copy: number): Card {
  return { id: `${j}-${copy}`, kind: 'joker', joker: j };
}

const NICKNAMES = ['阿明', '机器人2', '机器人3', '机器人4'];

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  return {
    roomCode: 'TEST1',
    chaodiEnabled: false,
    phase: 'bidding',
    seats: NICKNAMES.map((nickname, seat) => ({
      seat,
      nickname,
      isBot: seat > 0,
      connected: true,
      isHost: seat === 0,
      handCount: 25,
    })),
    hostSeat: 0,
    yourSeat: 0,
    yourHand: [],
    trump: { trumpSuit: null, level: 2 },
    dealerSeat: null,
    buryingSeat: null,
    currentBid: null,
    bidHistory: [],
    isFirstRound: false,
    redealCount: 0,
    biddingStage: 'pre-dealer',
    biddingTurn: 0,
    bidWindowEndsAt: null,
    turnSeat: null,
    currentTrick: [],
    lastTrick: [],
    lastTrickWinnerSeat: null,
    throwEvents: [],
    throwPenaltyPoints: [0, 0],
    defenderPoints: 0,
    teamLevels: [2, 2],
    roundResult: null,
    ...partial,
  };
}

const singleBid: Bid = { seat: 1, kind: 'suit-single', suit: 'S', cards: [c('S', 2, 0)] };
const pairBid: Bid = { seat: 2, kind: 'suit-pair', suit: 'H', cards: [c('H', 2, 0), c('H', 2, 1)] };
const ntBid: Bid = { seat: 0, kind: 'big-joker-pair', suit: null, cards: [joker('big', 0), joker('big', 1)] };
const smallJokerPair: Bid = {
  seat: 1,
  kind: 'small-joker-pair',
  suit: null,
  cards: [joker('small', 0), joker('small', 1)],
};
const failedThrow: ThrowEventView = {
  id: 'throw-0-failure-S5',
  seat: 0,
  attemptedCards: [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)],
  actualCards: [c('S', 5, 0), c('S', 5, 1)],
  challengedCards: [c('S', 5, 0), c('S', 5, 1)],
  components: [
    { type: 'pair', suit: 'S', strength: 8, cards: [c('S', 8, 0), c('S', 8, 1)] },
    { type: 'pair', suit: 'S', strength: 5, cards: [c('S', 5, 0), c('S', 5, 1)] },
  ],
  success: false,
  n: 2,
  penaltyPoints: 40,
  beneficiaryTeam: 1,
  reason: 'beatable-component',
};
const successfulThrow: ThrowEventView = {
  id: 'throw-1-success-S9',
  seat: 1,
  attemptedCards: [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)],
  actualCards: [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)],
  challengedCards: [],
  components: [
    { type: 'pair', suit: 'S', strength: 12, cards: [c('S', 12, 0), c('S', 12, 1)] },
    { type: 'pair', suit: 'S', strength: 9, cards: [c('S', 9, 0), c('S', 9, 1)] },
  ],
  success: true,
  n: 2,
  penaltyPoints: 0,
  beneficiaryTeam: null,
  reason: null,
};

describe('deriveAnnouncements', () => {
  it('no events when prev is null (initial join / reconnect)', () => {
    expect(deriveAnnouncements(null, mkView({ currentBid: singleBid }))).toEqual([]);
  });

  it('no events when nothing changed', () => {
    const v = mkView({ currentBid: singleBid });
    expect(deriveAnnouncements(v, v)).toEqual([]);
  });

  it('first reveal announces bidder, bid type and cards', () => {
    const events = deriveAnnouncements(mkView({}), mkView({ currentBid: singleBid }));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('bid');
    expect(events[0].text).toContain('机器人2');
    expect(events[0].text).toContain('亮主');
    expect(events[0].text).toContain('♠');
    expect(events[0].text).toContain('主从无主改为 ♠');
    expect(events[0].text).toContain('级牌 2 不变');
    expect(events[0].cards).toEqual(singleBid.cards);
  });

  it('calls the first reveal of the first round 抢庄', () => {
    const events = deriveAnnouncements(
      mkView({ isFirstRound: true }),
      mkView({ isFirstRound: true, currentBid: singleBid }),
    );
    expect(events[0].text).toContain('抢庄');
  });

  it('announces that a first-round no-bid deal was discarded and redealt', () => {
    const events = deriveAnnouncements(
      mkView({ isFirstRound: true, redealCount: 0 }),
      mkView({ isFirstRound: true, biddingStage: 'dealing', redealCount: 1 }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'phase',
        text: '首局无人亮主，本局作废，正在重新发牌',
      }),
    );
  });

  it('your own reveal says 你', () => {
    const events = deriveAnnouncements(
      mkView({}),
      mkView({ currentBid: { ...singleBid, seat: 0 } }),
    );
    expect(events[0].text).toContain('你');
  });

  it('overcall announces counter with new trump suit', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: singleBid }),
      mkView({ currentBid: pairBid }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('机器人3');
    expect(events[0].text).toContain('反主');
    expect(events[0].text).toContain('♥');
    expect(events[0].text).toContain('主从 ♠ 改为 ♥');
    expect(events[0].text).toContain('级牌 2 不变');
  });

  it('same-suit stronger overcall says trump suit is unchanged', () => {
    const strongerSameSuit: Bid = {
      seat: 2,
      kind: 'suit-pair',
      suit: 'S',
      cards: [c('S', 2, 0), c('S', 2, 1)],
    };
    const events = deriveAnnouncements(
      mkView({ currentBid: singleBid }),
      mkView({ currentBid: strongerSameSuit }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('反主');
    expect(events[0].text).toContain('主仍是 ♠');
    expect(events[0].text).toContain('级牌 2 不变');
  });

  it('joker pair counter announces no-trump', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: pairBid }),
      mkView({ currentBid: ntBid }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('无主');
    expect(events[0].text).toContain('主从 ♥ 改为无主');
  });

  it('big-joker pair counter announces it over a small-joker pair', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: smallJokerPair }),
      mkView({ currentBid: ntBid }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('大王一对');
    expect(events[0].text).toContain('压过 小王一对');
    expect(events[0].text).toContain('主仍是 无主');
  });

  it('calls the first declaration after burying a counter', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'bidding', biddingStage: 'post-bury' }),
      mkView({
        phase: 'bidding',
        biddingStage: 'post-bury',
        currentBid: pairBid,
        bidHistory: [pairBid],
      }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('反主');
  });

  it('derives every reveal/counter from bid history when snapshots skip intermediate states', () => {
    const events = deriveAnnouncements(
      mkView({}),
      mkView({
        currentBid: ntBid,
        bidHistory: [singleBid, pairBid, ntBid],
      }),
    );
    expect(events.map((e) => e.kind)).toEqual(['bid', 'counter', 'counter']);
    expect(events[0].text).toContain('机器人2 亮主');
    expect(events[1].text).toContain('机器人3 反主');
    expect(events[1].text).toContain('压过 ♠2 单张');
    expect(events[2].text).toContain('你 反主');
    expect(events[2].text).toContain('压过 ♥2 一对');
  });

  it('bidding -> burying with a bid announces the dealer', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: pairBid }),
      mkView({ phase: 'burying', currentBid: pairBid, dealerSeat: 2 }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('phase');
    expect(events[0].text).toContain('机器人3');
    expect(events[0].text).toContain('坐庄');
  });

  it('bidding -> burying with no bid announces no-trump fallback', () => {
    const events = deriveAnnouncements(
      mkView({}),
      mkView({ phase: 'burying', currentBid: null, dealerSeat: 0 }),
    );
    expect(events[0].text).toContain('无人亮主');
    expect(events[0].text).toContain('无主');
  });

  it('post-bury counter announces that the counterer takes the kitty and re-buries', () => {
    const events = deriveAnnouncements(
      mkView({
        phase: 'bidding',
        biddingStage: 'post-bury',
        currentBid: singleBid,
        bidHistory: [singleBid],
        dealerSeat: 0,
      }),
      mkView({
        phase: 'burying',
        biddingStage: null,
        currentBid: pairBid,
        bidHistory: [singleBid, pairBid],
        dealerSeat: 0,
        buryingSeat: 2,
      }),
    );

    expect(events.map((event) => event.kind)).toEqual(['counter', 'phase']);
    expect(events[1].text).toContain('机器人3');
    expect(events[1].text).toContain('拿起当前底牌重新埋底');
    expect(events[1].text).toContain('庄家不变');
    expect(events[1].text).not.toContain('坐庄');
  });

  it('burying -> playing announces dealer leads', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'burying', currentBid: pairBid, dealerSeat: 2 }),
      mkView({ phase: 'playing', currentBid: pairBid, dealerSeat: 2, turnSeat: 2 }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('phase');
    expect(events[0].text).toContain('埋底完成');
  });

  it('announces failed throw with actual lead and penalty details', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'playing', throwEvents: [] }),
      mkView({ phase: 'playing', throwEvents: [failedThrow] }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('throw');
    expect(events[0].text).toContain('你甩牌失败');
    expect(events[0].text).toContain('强制出小');
    expect(events[0].text).toContain('罚 40 分');
    expect(events[0].cards).toEqual(failedThrow.attemptedCards);
  });

  it('announces successful throw from another player', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'playing', throwEvents: [] }),
      mkView({ phase: 'playing', throwEvents: [successfulThrow] }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('throw');
    expect(events[0].text).toContain('机器人2 甩牌成功');
    expect(events[0].text).toContain('4 张牌切分为 2 组牌型');
  });

  it('unrelated phase changes emit nothing', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'playing' }),
      mkView({ phase: 'scoring' }),
    );
    expect(events).toEqual([]);
  });
});
