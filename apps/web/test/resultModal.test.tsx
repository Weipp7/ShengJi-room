import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Card, RoomStateView } from '@shengji/shared';
import ResultModal from '../src/components/ResultModal';

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
    biddingStage: null,
    biddingTurn: null,
    turnSeat: null,
    currentTrick: [],
    lastTrick: [],
    lastTrickWinnerSeat: 2,
    throwEvents: [],
    throwPenaltyPoints: [0, 40],
    defenderPoints: 80,
    teamLevels: [2, 2],
    roundResult: {
      defenderPoints: 80,
      baseDefenderPoints: 40,
      throwPenaltyDelta: 40,
      throwPenaltyPoints: [0, 40],
      kittyCards: [c('D', 3, 0)],
      kittyBonus: 0,
      winnerTeam: 1,
      levelDelta: 0,
      nextDealerSeat: 1,
      nextLevels: [2, 2],
    },
    ...partial,
  };
}

describe('ResultModal', () => {
  it('shows throw penalty adjustment separately from final defender points', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResultModal, {
        view: mkView({}),
        onNextRound: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('闲家基础得分');
    expect(html).toContain('40');
    expect(html).toContain('甩牌惩罚');
    expect(html).toContain('+40');
    expect(html).toContain('闲家总分');
    expect(html).toContain('80');
  });

  it('keeps throw penalty ledger visible when both teams cancel out to zero delta', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResultModal, {
        view: mkView({
          roundResult: {
            defenderPoints: 40,
            baseDefenderPoints: 40,
            throwPenaltyDelta: 0,
            throwPenaltyPoints: [40, 40],
            kittyCards: [c('D', 3, 0)],
            kittyBonus: 0,
            winnerTeam: 0,
            levelDelta: 1,
            nextDealerSeat: 2,
            nextLevels: [3, 2],
          },
        }),
        onNextRound: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('甩牌惩罚');
    expect(html).toContain('蓝队 40 / 红队 40');
    expect(html).toContain('净 0');
  });

  it('explains the shengji.org observed 55-point dealer hold result', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResultModal, {
        view: mkView({
          dealerSeat: 3,
          lastTrickWinnerSeat: 3,
          defenderPoints: 55,
          teamLevels: [2, 2],
          roundResult: {
            defenderPoints: 55,
            baseDefenderPoints: 55,
            throwPenaltyDelta: 0,
            throwPenaltyPoints: [0, 0],
            kittyCards: [c('D', 3, 0)],
            kittyBonus: 0,
            winnerTeam: 1,
            levelDelta: 1,
            nextDealerSeat: 1,
            nextLevels: [2, 3],
          },
        }),
        onNextRound: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('庄家小胜 +1级');
    expect(html).toContain('闲家基础得分');
    expect(html).toContain('庄家守住底牌 (无扣底)');
    expect(html).toContain('红队 2 → 3');
    expect(html).toContain('下局庄家');
    expect(html).toContain('右家');
  });

  it('labels the 80-115 band as changing dealer without level up', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResultModal, {
        view: mkView({
          dealerSeat: 0,
          lastTrickWinnerSeat: 1,
          defenderPoints: 80,
          roundResult: {
            defenderPoints: 80,
            baseDefenderPoints: 80,
            throwPenaltyDelta: 0,
            throwPenaltyPoints: [0, 0],
            kittyCards: [c('D', 3, 0)],
            kittyBonus: 0,
            winnerTeam: 1,
            levelDelta: 0,
            nextDealerSeat: 1,
            nextLevels: [2, 2],
          },
        }),
        onNextRound: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('换庄 (不升级)');
    expect(html).toContain('闲家扣底成功，但底牌无分');
  });

  it('shows auto-continue countdown for quick robot rounds', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResultModal, {
        view: mkView({}),
        autoContinueSeconds: 10,
        onNextRound: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('10 秒后自动继续');
  });

  it('does not count a positive kitty bonus twice in the visible subtotal', () => {
    const html = renderToStaticMarkup(
      React.createElement(ResultModal, {
        view: mkView({
          lastTrickWinnerSeat: 1,
          defenderPoints: 70,
          roundResult: {
            defenderPoints: 70,
            baseDefenderPoints: 70,
            throwPenaltyDelta: 0,
            throwPenaltyPoints: [0, 0],
            kittyCards: [c('D', 5, 0), c('S', 10, 0)],
            kittyBonus: 30,
            winnerTeam: 0,
            levelDelta: 1,
            nextDealerSeat: 2,
            nextLevels: [3, 2],
          },
        }),
        onNextRound: () => {},
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('闲家基础得分');
    expect(html).toContain('40');
    expect(html).toContain('闲家扣底 +30');
    expect(html).toContain('闲家总分');
    expect(html).toContain('70');
  });
});
