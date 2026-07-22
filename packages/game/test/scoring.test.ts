import { describe, it, expect } from 'vitest';
import { teamOfSeat } from '@shengji/shared';
import { ROUND_SCORE_TABLE, kittyBonus, settleRound } from '../src/scoring';
import { c } from './helpers';

function lookup(points: number) {
  return ROUND_SCORE_TABLE.find((row) => points >= row.min && points <= row.max)!;
}

describe('ROUND_SCORE_TABLE', () => {
  it.each([
    [0, 'dealer', 3],
    [5, 'dealer', 2],
    [35, 'dealer', 2],
    [40, 'dealer', 1],
    [75, 'dealer', 1],
    [80, 'defender', 0],
    [115, 'defender', 0],
    [120, 'defender', 1],
    [155, 'defender', 1],
    [160, 'defender', 2],
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

  it('subtracts defender-team failed throw penalties from defender effective points without going below zero', () => {
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
    expect(res.defenderPoints).toBe(0);
    expect(res.winnerTeam).toBe(0);
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
