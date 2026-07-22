import { describe, expect, it } from 'vitest';
import type { Card, Rank, RoomStateView, Suit, ThrowEventView } from '@shengji/shared';
import { createPlayHint, playHintContextKey } from '../src/lib/playHint';

function c(suit: Suit, rank: Rank, copy: number): Card {
  return { id: `${suit}-${rank}-${copy}`, kind: 'suit', suit, rank };
}

function mkView(partial: Partial<RoomStateView>): RoomStateView {
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
    yourSeat: 0,
    yourHand: [c('S', 11, 0), c('S', 14, 0), c('D', 3, 0)],
    trump: { trumpSuit: 'H', level: 2 },
    dealerSeat: 0,
    currentBid: null,
    bidHistory: [],
    biddingStage: null,
    biddingTurn: null,
    turnSeat: 0,
    currentTrick: [{ seat: 1, cards: [c('S', 10, 0)] }],
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

describe('createPlayHint', () => {
  it('suggests the smallest winning card with an explanation when an opponent is taking points', () => {
    const hint = createPlayHint(mkView({}));

    expect(hint?.cardIds).toEqual(['S-11-0']);
    expect(hint?.reasonCode).toBe('win-points-minimal');
    expect(hint?.message).toContain('敌方');
    expect(hint?.message).toContain('有分');
  });

  it('returns null when it is not the local player turn', () => {
    const hint = createPlayHint(mkView({ turnSeat: 1 }));

    expect(hint).toBeNull();
  });

  it('rebuilds a successful throw-pairs lead before suggesting a follow play', () => {
    const leadCards = [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)];
    const throwEvent: ThrowEventView = {
      id: 'throw-seat-1',
      seat: 1,
      attemptedCards: leadCards,
      actualCards: leadCards,
      challengedCards: [],
      success: true,
      n: 2,
      penaltyPoints: 0,
      beneficiaryTeam: null,
      reason: null,
    };
    const hint = createPlayHint(
      mkView({
        yourSeat: 2,
        turnSeat: 2,
        yourHand: [
          c('S', 14, 0),
          c('S', 14, 1),
          c('S', 3, 0),
          c('S', 3, 1),
          c('S', 4, 0),
          c('S', 4, 1),
        ],
        currentTrick: [{ seat: 1, cards: leadCards, throwEvent }],
      }),
    );

    expect(hint?.cardIds).toEqual(['S-3-0', 'S-3-1', 'S-4-0', 'S-4-1']);
    expect(hint?.reasonCode).toBe('follow-throw-pairs');
    expect(hint?.message).toContain('甩牌');
  });

  it('includes throw event metadata in the hint context key', () => {
    const leadCards = [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)];
    const successEvent: ThrowEventView = {
      id: 'throw-seat-1',
      seat: 1,
      attemptedCards: leadCards,
      actualCards: leadCards,
      challengedCards: [],
      success: true,
      n: 2,
      penaltyPoints: 0,
      beneficiaryTeam: null,
      reason: null,
    };
    const correctedEvent: ThrowEventView = {
      ...successEvent,
      success: false,
      actualCards: [c('S', 9, 0), c('S', 9, 1)],
      challengedCards: [c('S', 9, 0), c('S', 9, 1)],
      penaltyPoints: 40,
      beneficiaryTeam: 0,
      reason: 'beatable-pair',
    };

    const before = playHintContextKey(mkView({ currentTrick: [{ seat: 1, cards: leadCards, throwEvent: successEvent }] }));
    const after = playHintContextKey(mkView({ currentTrick: [{ seat: 1, cards: leadCards, throwEvent: correctedEvent }] }));

    expect(before).not.toBe(after);
  });
});
