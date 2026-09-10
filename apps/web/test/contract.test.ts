import { describe, expect, it } from 'vitest';
import type { Bid, Card, RoomStateView } from '@shengji/shared';
import { describeContract } from '../src/lib/contract';

function c(suit: 'S' | 'H' | 'D' | 'C', rank: number, copy: number): Card {
  return { id: `${suit}${rank}-${copy}`, kind: 'suit', suit, rank: rank as Card & never } as Card;
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

const pairBid: Bid = {
  seat: 2,
  kind: 'suit-pair',
  suit: 'H',
  cards: [c('H', 2, 0), c('H', 2, 1)],
};

const bigJokerPair: Bid = {
  seat: 0,
  kind: 'big-joker-pair',
  suit: null,
  cards: [
    { id: 'big-0', kind: 'joker', joker: 'big' },
    { id: 'big-1', kind: 'joker', joker: 'big' },
  ],
};

describe('describeContract', () => {
  it('describes pending bidding state before anyone reveals', () => {
    const summary = describeContract(mkView({}));
    expect(summary.mode).toBe('pending');
    expect(summary.title).toContain('还没有人亮主');
    expect(summary.detail).toContain('级牌 2');
    expect(summary.cards).toEqual([]);
  });

  it('describes active bidding owner, exposed cards, trump and level', () => {
    const summary = describeContract(
      mkView({ currentBid: pairBid, trump: { trumpSuit: 'H', level: 2 }, dealerSeat: 2 }),
    );
    expect(summary.mode).toBe('bid');
    expect(summary.title).toContain('机器人3 亮主');
    expect(summary.detail).toContain('主 ♥');
    expect(summary.detail).toContain('级牌 2');
    expect(summary.detail).toContain('庄家 机器人3');
    expect(summary.cards).toEqual(pairBid.cards);
    expect(summary.facts).toEqual(
      expect.arrayContaining([
        { label: '主', value: '♥ 2', tone: 'trump' },
        { label: '队伍级牌', value: '蓝队 2 / 红队 2', tone: 'levels' },
        { label: '庄', value: '机器人3', tone: 'dealer' },
      ]),
    );
  });

  it('marks the pre-dealer counter window while bidding continues', () => {
    const summary = describeContract(
      mkView({
        currentBid: pairBid,
        bidHistory: [pairBid],
        trump: { trumpSuit: 'H', level: 2 },
        dealerSeat: 2,
        biddingStage: 'pre-dealer',
      }),
    );
    expect(summary.detail).toContain('摸底前 5 秒自由反主');
  });

  it('persists the winning bid through playing', () => {
    const summary = describeContract(
      mkView({
        phase: 'playing',
        currentBid: pairBid,
        bidHistory: [pairBid],
        trump: { trumpSuit: 'H', level: 2 },
        dealerSeat: 2,
        turnSeat: 2,
      }),
    );
    expect(summary.mode).toBe('bid');
    expect(summary.title).toContain('本局契约');
    expect(summary.detail).toContain('机器人3 亮主 ♥2 一对');
    expect(summary.detail).toContain('庄家 机器人3');
    expect(summary.cards).toEqual(pairBid.cards);
  });

  it('persists counter-bid type and previous bid after bidding ends', () => {
    const firstBid: Bid = { seat: 0, kind: 'suit-single', suit: 'S', cards: [c('S', 2, 0)] };
    const summary = describeContract(
      mkView({
        phase: 'playing',
        currentBid: pairBid,
        bidHistory: [firstBid, pairBid],
        trump: { trumpSuit: 'H', level: 2 },
        dealerSeat: 2,
        turnSeat: 2,
      }),
    );
    expect(summary.mode).toBe('bid');
    expect(summary.title).toContain('本局契约');
    expect(summary.detail).toContain('机器人3 反主 ♥2 一对');
    expect(summary.detail).toContain('压过 你 ♠2 单张');
    expect(summary.detail).toContain('主 ♥');
  });

  it('describes a joker-pair no-trump bid', () => {
    const jokerSummary = describeContract(
      mkView({
        currentBid: bigJokerPair,
        trump: { trumpSuit: null, level: 2 },
        dealerSeat: 0,
      }),
    );
    expect(jokerSummary.detail).toContain('你 亮主 大王一对');
    expect(jokerSummary.detail).toContain('本局无主');
  });

  it('marks the counter window after burying', () => {
    const summary = describeContract(
      mkView({
        phase: 'bidding',
        currentBid: pairBid,
        bidHistory: [pairBid],
        trump: { trumpSuit: 'H', level: 2 },
        dealerSeat: 2,
        biddingStage: 'post-bury',
        biddingTurn: 0,
      }),
    );
    expect(summary.title).toContain('埋底后反主');
    expect(summary.detail).toContain('埋底后反主');
    expect(summary.facts).toEqual(
      expect.arrayContaining([{ label: '反牌窗口', value: '埋底后反主', tone: 'stage' }]),
    );
  });

  it('calls the first opening bid of the first round 抢庄', () => {
    const summary = describeContract(
      mkView({ isFirstRound: true, currentBid: pairBid, dealerSeat: 2 }),
    );
    expect(summary.title).toContain('机器人3 抢庄');
    expect(summary.detail).toContain('机器人3 抢庄');
  });

  it('describes no-bid fallback dealer and no-trump contract', () => {
    const summary = describeContract(
      mkView({
        phase: 'burying',
        currentBid: null,
        trump: { trumpSuit: null, level: 2 },
        dealerSeat: 0,
      }),
    );
    expect(summary.mode).toBe('fallback');
    expect(summary.title).toContain('无人亮主');
    expect(summary.detail).toContain('本局无主');
    expect(summary.detail).toContain('庄家 你');
    expect(summary.cards).toEqual([]);
    expect(summary.facts).toEqual(
      expect.arrayContaining([
        { label: '主', value: '无主 2', tone: 'trump' },
        { label: '庄', value: '你', tone: 'dealer' },
      ]),
    );
  });

  it('surfaces the high-frequency table facts during play', () => {
    const summary = describeContract(
      mkView({
        phase: 'playing',
        currentBid: pairBid,
        bidHistory: [pairBid],
        trump: { trumpSuit: 'H', level: 2 },
        dealerSeat: 2,
        turnSeat: 1,
        defenderPoints: 45,
        teamLevels: [2, 3],
      }),
    );

    expect(summary.facts).toEqual([
      { label: '主', value: '♥ 2', tone: 'trump' },
      { label: '队伍级牌', value: '蓝队 2 / 红队 3', tone: 'levels' },
      { label: '庄', value: '机器人3', tone: 'dealer' },
      { label: '闲家', value: '45/80', tone: 'score' },
    ]);
  });

  it('shows the real negative defender score in the table facts', () => {
    const summary = describeContract(
      mkView({
        phase: 'playing',
        currentBid: pairBid,
        bidHistory: [pairBid],
        dealerSeat: 0,
        defenderPoints: -40,
      }),
    );

    expect(summary.facts).toContainEqual({ label: '闲家', value: '-40/80', tone: 'score' });
  });
});
