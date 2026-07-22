import { describe, expect, it } from 'vitest';
import type { RoomStateView } from '@shengji/shared';
import { describeWaiting } from '../src/lib/waiting';

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
    biddingTurn: 1,
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

describe('describeWaiting', () => {
  it('names the bidder during another player bidding turn', () => {
    expect(describeWaiting(mkView({ biddingTurn: 1 }), false)).toBe('等待 机器人2 叫主…');
  });

  it('names the dealer during burying', () => {
    expect(
      describeWaiting(mkView({ phase: 'burying', biddingTurn: null, dealerSeat: 2 }), false),
    ).toBe('等待 机器人3 埋底…');
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
