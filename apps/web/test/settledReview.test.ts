import { describe, expect, it } from 'vitest';
import type { Card, Rank, RoomStateView, Suit } from '@shengji/shared';
import { nextSettledReview, settledReviewKey, settledReviewStateKey } from '../src/lib/settledReview';

function c(id: string): Card {
  const [suit, rank, copy] = id.split('-');
  return { id, kind: 'suit', suit: suit as Suit, rank: Number(rank) as Rank };
}

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  const lastTrick = [
    { seat: 0, cards: [c('S-3-0')] },
    { seat: 1, cards: [c('S-14-0')] },
    { seat: 2, cards: [c('S-4-0')] },
    { seat: 3, cards: [c('S-5-0')] },
  ];
  return {
    roomCode: 'TEST1',
    phase: 'playing',
    seats: ['你', '右家', '对家', '左家'].map((nickname, seat) => ({
      seat,
      nickname,
      isBot: seat > 0,
      connected: true,
      isHost: seat === 0,
      handCount: 25,
    })),
    hostSeat: 0,
    yourSeat: 2,
    yourHand: [c('H-3-0'), c('H-4-0')],
    trump: { trumpSuit: 'H', level: 2 },
    dealerSeat: 0,
    currentBid: null,
    bidHistory: [],
    biddingStage: null,
    biddingTurn: null,
    turnSeat: 2,
    currentTrick: [],
    lastTrick,
    lastTrickWinnerSeat: 1,
    throwEvents: [],
    throwPenaltyPoints: [0, 0],
    defenderPoints: 0,
    teamLevels: [2, 2],
    roundResult: null,
    ...partial,
  };
}

describe('settled review state', () => {
  it('does not replay the previous trick when a current trick is already in progress', () => {
    const view = mkView({
      currentTrick: [{ seat: 1, cards: [c('D-3-0')] }],
      turnSeat: 2,
    });

    expect(nextSettledReview(view)).toBeNull();
  });

  it('does not use turnSeat as the winner when lastTrickWinnerSeat is missing', () => {
    const view = mkView({
      lastTrickWinnerSeat: null,
      turnSeat: 2,
    });

    const review = nextSettledReview(view);

    expect(review).not.toBeNull();
    expect(review?.winnerSeat).toBeNull();
  });

  it('keys the review from last-trick cards and the explicit winner only', () => {
    const view = mkView({});

    expect(settledReviewKey(view)).toContain('S-14-0');
    expect(settledReviewKey(view)).toContain(':1');
  });

  it('changes the state key when the next trick starts with the same last trick', () => {
    const settled = mkView({});
    const nextStarted = mkView({
      currentTrick: [{ seat: 1, cards: [c('D-3-0')] }],
      turnSeat: 2,
    });

    expect(settledReviewStateKey(settled)).not.toBe(settledReviewStateKey(nextStarted));
  });
});
