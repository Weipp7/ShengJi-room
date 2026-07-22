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
    currentBid: null,
    bidHistory: [],
    biddingStage: 'pre-dealer',
    biddingTurn: 0,
    turnSeat: null,
    currentTrick: [],
    lastTrick: [],
    lastTrickWinnerSeat: null,
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

const tripleBid: Bid = {
  seat: 1,
  kind: 'suit-multiple',
  suit: 'S',
  cards: [c('S', 2, 0), c('S', 2, 1), c('S', 2, 2)],
};

const bigJokerSingle: Bid = {
  seat: 0,
  kind: 'big-joker-single',
  suit: null,
  cards: [{ id: 'big-0', kind: 'joker', joker: 'big' }],
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
    expect(summary.detail).toContain('庄前反牌中');
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

  it('describes arbitrary-count suit bids and single joker bids', () => {
    const tripleSummary = describeContract(
      mkView({
        currentBid: tripleBid,
        trump: { trumpSuit: 'S', level: 2 },
        dealerSeat: 1,
      }),
    );
    expect(tripleSummary.detail).toContain('机器人2 亮主 ♠2 3张');

    const jokerSummary = describeContract(
      mkView({
        currentBid: bigJokerSingle,
        trump: { trumpSuit: null, level: 2 },
        dealerSeat: 0,
      }),
    );
    expect(jokerSummary.detail).toContain('你 亮主 大王单张');
    expect(jokerSummary.detail).toContain('本局无主');
  });

  it('marks the post-dealer counter window before burying', () => {
    const summary = describeContract(
      mkView({
        phase: 'burying',
        currentBid: pairBid,
        bidHistory: [pairBid],
        trump: { trumpSuit: 'H', level: 2 },
        dealerSeat: 2,
        biddingStage: 'post-dealer',
      }),
    );
    expect(summary.title).toContain('庄后反牌');
    expect(summary.detail).toContain('庄后反牌中');
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
  });
});
