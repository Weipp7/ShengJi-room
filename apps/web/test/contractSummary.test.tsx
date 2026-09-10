import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Bid, Card, RoomStateView } from '@shengji/shared';
import ContractSummary from '../src/components/ContractSummary';

function c(suit: 'S' | 'H' | 'D' | 'C', rank: number, copy: number): Card {
  return { id: `${suit}${rank}-${copy}`, kind: 'suit', suit, rank: rank as Card & never } as Card;
}

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  const bid: Bid = {
    seat: 2,
    kind: 'suit-pair',
    suit: 'H',
    cards: [c('H', 2, 0), c('H', 2, 1)],
  };
  return {
    roomCode: 'TEST1',
    chaodiEnabled: false,
    phase: 'playing',
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
    trump: { trumpSuit: 'H', level: 2 },
    dealerSeat: 2,
    buryingSeat: null,
    currentBid: bid,
    bidHistory: [bid],
    isFirstRound: false,
    redealCount: 0,
    biddingStage: null,
    biddingTurn: null,
    bidWindowEndsAt: null,
    turnSeat: 1,
    currentTrick: [],
    lastTrick: [],
    lastTrickWinnerSeat: null,
    throwEvents: [],
    throwPenaltyPoints: [0, 0],
    defenderPoints: 45,
    teamLevels: [2, 3],
    roundResult: null,
    ...partial,
  };
}

describe('ContractSummary', () => {
  it('renders a compact fact strip for the current table state', () => {
    const html = renderToStaticMarkup(React.createElement(ContractSummary, { view: mkView({}) }));

    expect(html).toContain('contract-facts');
    expect(html).toContain('主');
    expect(html).toContain('♥ 2');
    expect(html).toContain('队伍级牌');
    expect(html).toContain('蓝队 2 / 红队 3');
    expect(html).toContain('庄');
    expect(html).toContain('对家');
    expect(html).toContain('闲家');
    expect(html).toContain('45/80');
  });
});
