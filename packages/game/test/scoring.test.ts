import { describe, it, expect } from 'vitest';
import { teamOfSeat, type Combo } from '@shengji/shared';
import { ROUND_SCORE_TABLE, kittyBonus, kittyMultiplierCards, settleRound } from '../src/scoring';
import { c } from './helpers';

function lookup(points: number) {
  return ROUND_SCORE_TABLE.find((row) => points >= row.min && points <= row.max)!;
}

describe('ROUND_SCORE_TABLE', () => {
  it.each([
    [-20, 'dealer', 3],
    [0, 'dealer', 3],
    [1, 'dealer', 2],
    [39, 'dealer', 2],
    [40, 'dealer', 1],
    [79, 'dealer', 1],
    [80, 'defender', 0],
    [119, 'defender', 0],
    [120, 'defender', 1],
    [159, 'defender', 1],
    [160, 'defender', 2],
    [199, 'defender', 2],
    [200, 'defender', 3],
    [235, 'defender', 3],
  ])('defender %i pts → %s +%i', (pts, winner, delta) => {
    const row = lookup(pts);
    expect(row.winnerTeam).toBe(winner);
    expect(row.levelDelta).toBe(delta);
  });
});

describe('kittyBonus', () => {
  it('doubles by 2^cards when defenders take last trick', () => {
    const kitty = [c('S', 5, 0), c('S', 10, 0)]; // 15 分
    expect(kittyBonus(kitty, 1, true)).toBe(30);
    expect(kittyBonus(kitty, 2, true)).toBe(60);
    expect(kittyBonus(kitty, 4, true)).toBe(240); // 两连对拖拉机
    expect(kittyBonus(kitty, 2, false)).toBe(0);
  });

  it('uses the largest component card count for a mixed throw', () => {
    const tractor = [c('S', 14, 0), c('S', 14, 1), c('S', 13, 0), c('S', 13, 1)];
    const pair = [c('S', 11, 0), c('S', 11, 1)];
    const single = [c('S', 12, 0)];
    const lead: Combo = {
      type: 'throw',
      cards: [...tractor, ...pair, ...single],
      suit: 'S',
      strength: 14,
      components: [
        { type: 'tractor', cards: tractor, suit: 'S', strength: 14 },
        { type: 'pair', cards: pair, suit: 'S', strength: 11 },
        { type: 'single', cards: single, suit: 'S', strength: 12 },
      ],
    };

    expect(kittyMultiplierCards(lead)).toBe(4);
    expect(kittyBonus([c('D', 5, 0), c('D', 10, 0)], kittyMultiplierCards(lead), true)).toBe(240);
  });

  it('uses one card for an all-single throw', () => {
    const cards = [c('S', 14, 0), c('S', 13, 0), c('S', 12, 0)];
    const lead: Combo = {
      type: 'throw',
      cards,
      suit: 'S',
      strength: 14,
      components: cards.map((card, index) => ({
        type: 'single' as const,
        cards: [card],
        suit: 'S' as const,
        strength: 14 - index,
      })),
    };

    expect(kittyMultiplierCards(lead)).toBe(1);
  });
});

describe('settleRound', () => {
  const kitty = [c('S', 5, 0), c('S', 10, 0)]; // 15 分

  it('dealer holds (defender < 80) → partner becomes dealer, dealer team levels up', () => {
    const res = settleRound({
      dealerSeat: 0,
      defenderTrickPoints: 40,
      kitty,
      lastTrickWinnerSeat: 0, // 庄家队赢最后一墩，不扣底
      lastTrickCardsPerPlayer: 1,
      teamLevels: [2, 2],
    });
    expect(res.defenderPoints).toBe(40);
    expect(res.kittyBonus).toBe(0);
    expect(res.winnerTeam).toBe(teamOfSeat(0));
    expect(res.levelDelta).toBe(1);
    expect(res.nextDealerSeat).toBe(2);
    expect(res.nextLevels).toEqual([3, 2]);
  });

  it('matches the shengji.org observed 55-point dealer hold sample', () => {
    const res = settleRound({
      dealerSeat: 3,
      defenderTrickPoints: 55,
      kitty,
      lastTrickWinnerSeat: 3,
      lastTrickCardsPerPlayer: 1,
      teamLevels: [2, 2],
    });

    expect(res.defenderPoints).toBe(55);
    expect(res.kittyBonus).toBe(0);
    expect(res.winnerTeam).toBe(1);
    expect(res.levelDelta).toBe(1);
    expect(res.nextDealerSeat).toBe(1);
    expect(res.nextLevels).toEqual([2, 3]);
  });

  it('defenders win (≥80) → next seat becomes dealer, defender team levels up', () => {
    const res = settleRound({
      dealerSeat: 0,
      defenderTrickPoints: 110,
      kitty,
      lastTrickWinnerSeat: 1, // 闲家赢最后一墩 → 扣底 15*2=30
      lastTrickCardsPerPlayer: 1,
      teamLevels: [2, 2],
    });
    expect(res.defenderPoints).toBe(140);
    expect(res.kittyBonus).toBe(30);
    expect(res.winnerTeam).toBe(1);
    expect(res.levelDelta).toBe(1);
    expect(res.nextDealerSeat).toBe(1);
    expect(res.nextLevels).toEqual([2, 3]);
  });

  it('adds dealer-team failed throw penalties to defender effective points', () => {
    const res = settleRound({
      dealerSeat: 0,
      defenderTrickPoints: 40,
      kitty: [],
      lastTrickWinnerSeat: 0,
      lastTrickCardsPerPlayer: 1,
      teamLevels: [2, 2],
      throwPenaltyPoints: [0, 40],
    });

    expect(res.baseDefenderPoints).toBe(40);
    expect(res.throwPenaltyDelta).toBe(40);
    expect(res.defenderPoints).toBe(80);
    expect(res.winnerTeam).toBe(1);
  });

  it('keeps a negative defender score after defender-team throw penalties', () => {
    const res = settleRound({
      dealerSeat: 0,
      defenderTrickPoints: 20,
      kitty: [],
      lastTrickWinnerSeat: 1,
      lastTrickCardsPerPlayer: 1,
      teamLevels: [2, 2],
      throwPenaltyPoints: [60, 0],
    });

    expect(res.baseDefenderPoints).toBe(20);
    expect(res.throwPenaltyDelta).toBe(-60);
    expect(res.defenderPoints).toBe(-40);
    expect(res.winnerTeam).toBe(0);
    expect(res.levelDelta).toBe(3);
  });

  it('defenders reach exactly 80 → change dealer without level up', () => {
    const res = settleRound({
      dealerSeat: 2,
      defenderTrickPoints: 80,
      kitty,
      lastTrickWinnerSeat: 2,
      lastTrickCardsPerPlayer: 2,
      teamLevels: [5, 7],
    });
    expect(res.winnerTeam).toBe(1);
    expect(res.levelDelta).toBe(0);
    expect(res.nextDealerSeat).toBe(3);
    expect(res.nextLevels).toEqual([5, 7]);
  });

  it('capot (0 pts) → dealer team +3', () => {
    const res = settleRound({
      dealerSeat: 1,
      defenderTrickPoints: 0,
      kitty,
      lastTrickWinnerSeat: 1,
      lastTrickCardsPerPlayer: 1,
      teamLevels: [2, 2],
    });
    expect(res.winnerTeam).toBe(teamOfSeat(1));
    expect(res.levelDelta).toBe(3);
    expect(res.nextDealerSeat).toBe(3);
    expect(res.nextLevels).toEqual([2, 5]);
  });

  it('level wraps past A back to 2', () => {
    const res = settleRound({
      dealerSeat: 0,
      defenderTrickPoints: 40,
      kitty,
      lastTrickWinnerSeat: 0,
      lastTrickCardsPerPlayer: 1,
      teamLevels: [14, 2],
    });
    expect(res.nextLevels).toEqual([2, 2]);
  });
});
