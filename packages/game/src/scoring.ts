import type { Card, Rank, RoundResultView } from '@shengji/shared';
import { nextLevel, teamOfSeat } from '@shengji/shared';
import { countPoints } from './points';

export type ScoreRow = {
  min: number;
  max: number;
  winnerTeam: 'dealer' | 'defender';
  levelDelta: number;
};

export const ROUND_SCORE_TABLE: ReadonlyArray<ScoreRow> = [
  { min: 0, max: 0, winnerTeam: 'dealer', levelDelta: 3 },
  { min: 5, max: 35, winnerTeam: 'dealer', levelDelta: 2 },
  { min: 40, max: 75, winnerTeam: 'dealer', levelDelta: 1 },
  { min: 80, max: 115, winnerTeam: 'defender', levelDelta: 0 },
  { min: 120, max: 155, winnerTeam: 'defender', levelDelta: 1 },
  { min: 160, max: 195, winnerTeam: 'defender', levelDelta: 2 },
  { min: 200, max: Infinity, winnerTeam: 'defender', levelDelta: 3 },
];

// 扣底：闲家赢最后一墩时，底牌分 × 2^(最后一墩每人出牌张数)
export function kittyBonus(
  kitty: Card[],
  lastTrickCardsPerPlayer: number,
  lastTrickWonByDefender: boolean,
): number {
  if (!lastTrickWonByDefender) return 0;
  return countPoints(kitty) * 2 ** lastTrickCardsPerPlayer;
}

export type RoundInput = {
  dealerSeat: number;
  defenderTrickPoints: number;
  kitty: Card[];
  lastTrickWinnerSeat: number;
  lastTrickCardsPerPlayer: number;
  teamLevels: [Rank, Rank];
  throwPenaltyPoints?: [number, number];
};

export function settleRound(input: RoundInput): RoundResultView {
  const dealerTeam = teamOfSeat(input.dealerSeat);
  const defenderTeam = (1 - dealerTeam) as 0 | 1;
  const lastByDefender = teamOfSeat(input.lastTrickWinnerSeat) !== dealerTeam;
  const bonus = kittyBonus(input.kitty, input.lastTrickCardsPerPlayer, lastByDefender);
  const baseDefenderPoints = input.defenderTrickPoints + bonus;
  const throwPenaltyPoints = input.throwPenaltyPoints ?? [0, 0];
  const throwPenaltyDelta = throwPenaltyPoints[defenderTeam] - throwPenaltyPoints[dealerTeam];
  const defenderPoints = Math.max(0, baseDefenderPoints + throwPenaltyDelta);

  const row = ROUND_SCORE_TABLE.find((r) => defenderPoints >= r.min && defenderPoints <= r.max);
  if (!row) throw new Error(`no score row for ${defenderPoints}`);

  const winnerTeam = row.winnerTeam === 'dealer' ? dealerTeam : ((1 - dealerTeam) as 0 | 1);
  const nextLevels: [Rank, Rank] = [...input.teamLevels];
  if (row.levelDelta > 0) {
    nextLevels[winnerTeam] = nextLevel(nextLevels[winnerTeam], row.levelDelta);
  }
  // 庄家队守庄 → 对家坐庄；闲家上台 → 庄家下一位坐庄
  const nextDealerSeat =
    row.winnerTeam === 'dealer' ? (input.dealerSeat + 2) % 4 : (input.dealerSeat + 1) % 4;

  return {
    defenderPoints,
    baseDefenderPoints,
    throwPenaltyDelta,
    throwPenaltyPoints,
    kittyCards: input.kitty,
    kittyBonus: bonus,
    winnerTeam,
    levelDelta: row.levelDelta,
    nextDealerSeat,
    nextLevels,
  };
}
