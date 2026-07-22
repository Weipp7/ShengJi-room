import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Card, RoomStateView, ThrowEventView, TrickPlayView } from '@shengji/shared';
import TrickArea from '../src/components/TrickArea';

function c(suit: 'S' | 'H' | 'D' | 'C', rank: number, copy: number): Card {
  return { id: `${suit}${rank}-${copy}`, kind: 'suit', suit, rank: rank as Card & never } as Card;
}

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  return {
    roomCode: 'TEST1',
    phase: 'scoring',
    seats: ['你', '右家', '对家', '左家'].map((nickname, seat) => ({
      seat,
      nickname,
      isBot: seat > 0,
      connected: true,
      isHost: seat === 0,
      handCount: 0,
    })),
    hostSeat: 0,
    yourSeat: 0,
    yourHand: [],
    trump: { trumpSuit: 'S', level: 2 },
    dealerSeat: 0,
    currentBid: null,
    bidHistory: [],
    biddingTurn: null,
    turnSeat: null,
    currentTrick: [],
    lastTrick: [],
    lastTrickWinnerSeat: 2,
    throwEvents: [],
    throwPenaltyPoints: [0, 0],
    defenderPoints: 0,
    teamLevels: [2, 2],
    roundResult: null,
    ...partial,
  };
}

describe('TrickArea', () => {
  it('renders the settled final-trick winner from the explicit winner seat', () => {
    const plays: TrickPlayView[] = [
      { seat: 0, cards: [c('S', 3, 0)] },
      { seat: 1, cards: [c('S', 4, 0)] },
      { seat: 2, cards: [c('S', 14, 0)] },
      { seat: 3, cards: [c('S', 5, 0)] },
    ];

    const html = renderToStaticMarkup(
      React.createElement(TrickArea, {
        view: mkView({ lastTrick: plays, lastTrickWinnerSeat: 2 }),
        settled: { plays, winnerSeat: 2 },
      }),
    );

    expect(html).toContain('对家 收下这一墩');
    expect(html).toContain('trick-top winner');
  });

  it('renders failed throw context beside the actual lead cards', () => {
    const throwEvent: ThrowEventView = {
      id: 'throw-0-failure',
      seat: 0,
      attemptedCards: [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)],
      actualCards: [c('S', 5, 0), c('S', 5, 1)],
      challengedCards: [c('S', 5, 0), c('S', 5, 1)],
      success: false,
      n: 2,
      penaltyPoints: 40,
      beneficiaryTeam: 1,
      reason: 'beatable-pair',
    };
    const plays: TrickPlayView[] = [{ seat: 0, cards: throwEvent.actualCards, throwEvent }];

    const html = renderToStaticMarkup(
      React.createElement(TrickArea, {
        view: mkView({ phase: 'playing', currentTrick: plays, throwEvents: [throwEvent] }),
        settled: null,
      }),
    );

    expect(html).toContain('甩牌失败');
    expect(html).toContain('实际领出');
    expect(html).toContain('-40');
  });

  it('renders successful throw context beside the lead cards', () => {
    const throwEvent: ThrowEventView = {
      id: 'throw-0-success',
      seat: 0,
      attemptedCards: [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)],
      actualCards: [c('S', 9, 0), c('S', 9, 1), c('S', 12, 0), c('S', 12, 1)],
      challengedCards: [],
      success: true,
      n: 2,
      penaltyPoints: 0,
      beneficiaryTeam: null,
      reason: null,
    };
    const plays: TrickPlayView[] = [{ seat: 0, cards: throwEvent.actualCards, throwEvent }];

    const html = renderToStaticMarkup(
      React.createElement(TrickArea, {
        view: mkView({ phase: 'playing', currentTrick: plays, throwEvents: [throwEvent] }),
        settled: null,
      }),
    );

    expect(html).toContain('甩牌成功');
    expect(html).toContain('2 个对子');
  });

  it('keeps throw context in the last-trick review markup', () => {
    const throwEvent: ThrowEventView = {
      id: 'throw-last-failure',
      seat: 0,
      attemptedCards: [c('S', 5, 0), c('S', 5, 1), c('S', 8, 0), c('S', 8, 1)],
      actualCards: [c('S', 5, 0), c('S', 5, 1)],
      challengedCards: [c('S', 5, 0), c('S', 5, 1)],
      success: false,
      n: 2,
      penaltyPoints: 40,
      beneficiaryTeam: 1,
      reason: 'beatable-pair',
    };
    const plays: TrickPlayView[] = [
      { seat: 0, cards: throwEvent.actualCards, throwEvent },
      { seat: 1, cards: [c('S', 6, 0), c('S', 6, 1)] },
      { seat: 2, cards: [c('S', 3, 0), c('S', 3, 1)] },
      { seat: 3, cards: [c('S', 4, 0), c('S', 4, 1)] },
    ];

    const html = renderToStaticMarkup(
      React.createElement(TrickArea, {
        view: mkView({ phase: 'playing', lastTrick: plays, lastTrickWinnerSeat: 1 }),
        settled: null,
      }),
    );

    expect(html).toContain('上一墩甩牌失败');
    expect(html).toContain('-40');
  });
});
