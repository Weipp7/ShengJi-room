import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Card, RoomStateView, TrickPlayView } from '@shengji/shared';
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
});
