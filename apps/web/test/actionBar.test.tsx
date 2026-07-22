import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Bid, Card, RoomStateView } from '@shengji/shared';
import ActionBar from '../src/components/ActionBar';

function joker(j: 'small' | 'big', copy: number): Card {
  return { id: `${j}-${copy}`, kind: 'joker', joker: j };
}

const NICKNAMES = ['阿明', '机器人2', '机器人3', '机器人4'];

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  return {
    roomCode: 'TEST1',
    phase: 'burying',
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
    yourHand: [joker('big', 0)],
    trump: { trumpSuit: null, level: 2 },
    dealerSeat: 0,
    currentBid: { seat: 0, kind: 'small-joker-single', suit: null, cards: [joker('small', 0)] } satisfies Bid,
    bidHistory: [],
    biddingStage: 'post-dealer',
    biddingTurn: null,
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

describe('ActionBar', () => {
  it('shows post-dealer counter options before burying', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({}),
        selectedCount: 0,
        holdActive: false,
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('庄后可反');
    expect(html).toContain('王');
    expect(html).toContain('大单');
    expect(html).toContain('确认埋牌');
  });

  it('labels large lead selections as possible throw plays', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({ phase: 'playing', turnSeat: 0 }),
        selectedCount: 4,
        holdActive: false,
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('甩牌');
  });
});
