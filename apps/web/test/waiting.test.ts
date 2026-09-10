import { describe, expect, it } from 'vitest';
import type { Bid, RoomStateView } from '@shengji/shared';
import { describeWaiting } from '../src/lib/waiting';

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
    biddingTurn: 1,
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

describe('describeWaiting', () => {
  const bid: Bid = { seat: 0, kind: 'suit-single', suit: 'S', cards: [] };

  it('describes the shared pre-kitty reveal window', () => {
    expect(describeWaiting(mkView({ biddingTurn: null }), false)).toBe(
      '摸底前限时亮主中，所有玩家均可亮主…',
    );
  });

  it('names the pre-dealer counter window after someone has revealed', () => {
    expect(
      describeWaiting(mkView({ currentBid: bid, biddingTurn: 1, biddingStage: 'pre-dealer' }), false),
    ).toBe('摸底前限时反主中，其他玩家均可反主…');
  });

  it('names the dealer during burying', () => {
    expect(
      describeWaiting(
        mkView({ phase: 'burying', biddingTurn: null, dealerSeat: 2, buryingSeat: 2 }),
        false,
      ),
    ).toBe('等待 机器人3 埋底…');
  });

  it('names the counter window after burying', () => {
    expect(
      describeWaiting(
        mkView({ phase: 'bidding', biddingStage: 'post-bury', biddingTurn: 1, dealerSeat: 2 }),
        false,
      ),
    ).toBe('埋底后反主中，等待 机器人2 表态…');
  });

  it('explains that everyone may reveal during dealing', () => {
    expect(
      describeWaiting(mkView({ biddingStage: 'dealing', biddingTurn: null }), false),
    ).toBe('正在发牌，所有玩家摸到级牌后均可亮主…');
  });

  it('names the player during play', () => {
    expect(
      describeWaiting(mkView({ phase: 'playing', biddingTurn: null, turnSeat: 3 }), false),
    ).toBe('等待 机器人4 出牌…');
  });

  it('describes the bounded trick review hold', () => {
    expect(
      describeWaiting(
        mkView({ phase: 'playing', biddingTurn: null, turnSeat: 2, lastTrickWinnerSeat: 2 }),
        true,
      ),
    ).toBe('机器人3 收墩，下一墩即将开始…');
  });
});
