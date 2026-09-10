import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RoomStateView } from '@shengji/shared';
import StatusBar from '../src/components/StatusBar';

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  return {
    roomCode: 'ROOM1',
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
    currentBid: null,
    bidHistory: [],
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

describe('StatusBar', () => {
  it('keeps global room status separate from the contract fact panel', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBar, {
        view: mkView({}),
        onLeave: () => {},
      }),
    );

    expect(html).toContain('房间');
    expect(html).toContain('ROOM1');
    expect(html).toContain('炒底 OFF');
    expect(html).toContain('出牌');
    expect(html).toContain('轮到');
    expect(html).toContain('右家');
    expect(html).not.toContain('级牌');
    expect(html).not.toContain('闲家');
    expect(html).not.toContain('庄');
  });

  it('shows when the room was created with chaodi enabled', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBar, { view: mkView({ chaodiEnabled: true }), onLeave: () => {} }),
    );
    expect(html).toContain('炒底 ON');
  });
});
