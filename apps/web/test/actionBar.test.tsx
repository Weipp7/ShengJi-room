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
    chaodiEnabled: false,
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
    yourHand: [joker('big', 0), joker('big', 1)],
    trump: { trumpSuit: null, level: 2 },
    dealerSeat: 0,
    buryingSeat: null,
    currentBid: {
      seat: 1,
      kind: 'small-joker-pair',
      suit: null,
      cards: [joker('small', 0), joker('small', 1)],
    } satisfies Bid,
    bidHistory: [],
    biddingStage: null,
    biddingTurn: null,
    bidWindowEndsAt: null,
    isFirstRound: false,
    redealCount: 0,
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
  it('lets a defender who countered bury the new kitty', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({ yourSeat: 1, dealerSeat: 0, buryingSeat: 1 }),
        selectedCount: 8,
        holdActive: false,
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('已选 8/8');
    expect(html).toContain('确认埋牌');
    expect(html).not.toContain('disabled=""');
  });

  it('shows pair-only counter options during the post-bury window', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({ phase: 'bidding', biddingStage: 'post-bury', biddingTurn: 0 }),
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

    expect(html).toContain('王');
    expect(html).toContain('大对');
    expect(html).toContain('过');
    expect(html).not.toContain('确认埋牌');
  });

  it('lets every seated player reveal during dealing without a pass action', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({
          phase: 'bidding',
          biddingStage: 'dealing',
          biddingTurn: null,
          currentBid: null,
          bidHistory: [],
          yourHand: [],
        }),
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

    expect(html).toContain('发牌中 0/25');
    expect(html).not.toContain('>过<');
  });

  it('shows only legal stronger options during the shared pre-kitty counter window', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({
          phase: 'bidding',
          biddingStage: 'pre-dealer',
          biddingTurn: null,
          bidWindowEndsAt: Date.now() + 5_000,
        }),
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

    expect(html).toContain('摸底前自由反主');
    expect(html).toContain('bid-option bid-nt lit');
    expect(html).toContain('suit-btn-S dim');
    expect(html).not.toContain('>过<');
  });

  it('dims every option for the current bidder until another player counters', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({
          phase: 'bidding',
          biddingStage: 'pre-dealer',
          biddingTurn: null,
          bidWindowEndsAt: Date.now() + 5_000,
          yourSeat: 1,
        }),
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

    expect(html).not.toContain('bid-option bid-nt lit');
    expect(html.match(/disabled=""/g)).toHaveLength(5);
  });

  it('labels any multi-card lead selection as a possible throw play', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({ phase: 'playing', turnSeat: 0 }),
        selectedCount: 2,
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

  it('does not label a follower selection as a throw play', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar, {
        view: mkView({
          phase: 'playing',
          turnSeat: 0,
          currentTrick: [{ seat: 3, cards: [joker('small', 0)] }],
        }),
        selectedCount: 3,
        holdActive: false,
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('>出牌<');
    expect(html).not.toContain('甩牌');
  });

  it('renders the play hint action and explanation during the local play turn', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar as React.ComponentType<Record<string, unknown>>, {
        view: mkView({ phase: 'playing', turnSeat: 0 }),
        selectedCount: 0,
        holdActive: false,
        playHint: {
          cardIds: ['S-11-0'],
          reasonCode: 'win-points-minimal',
          message: '敌方当前领先且桌上有分，建议用最小可赢牌争抢。',
        },
        onHint: () => {},
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('提示');
    expect(html).toContain('敌方当前领先');
  });

  it('disables play actions while a play request is pending', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar as React.ComponentType<Record<string, unknown>>, {
        view: mkView({ phase: 'playing', turnSeat: 0 }),
        selectedCount: 1,
        pendingAction: 'play',
        holdActive: false,
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('处理中…');
    expect(html).toContain('disabled=""');
  });

  it('disables bidding actions while a pass request is pending', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionBar as React.ComponentType<Record<string, unknown>>, {
        view: mkView({ phase: 'bidding', biddingStage: 'post-bury', biddingTurn: 0 }),
        selectedCount: 0,
        pendingAction: 'pass',
        holdActive: false,
        onBid: () => {},
        onPass: () => {},
        onBury: () => {},
        onPlay: () => {},
        onNextRound: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('处理中…');
    expect(html).toContain('disabled=""');
  });
});
