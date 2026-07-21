import type { Card, Combo, TrumpContext } from '@shengji/shared';

export type TrickPlay = { seat: number; cards: Card[]; combo: Combo | null };

// 返回赢家 seat。plays[0] 为领牌（combo 必非 null）。
// 只有与领牌同型且（同有效花色 或 全主）的 combo 参与比较；主吃副；同组比 strength；相等先出者胜。
export function trickWinner(plays: TrickPlay[], trump: TrumpContext): number {
  void trump;
  const lead = plays[0].combo;
  if (lead === null) throw new Error('lead combo must not be null');

  let winner = plays[0];
  let winning = lead;
  for (const play of plays.slice(1)) {
    const combo = play.combo;
    if (combo === null || combo.type !== lead.type) continue;
    if (combo.suit !== lead.suit && combo.suit !== 'trump') continue;

    const winningIsTrump = winning.suit === 'trump';
    const comboIsTrump = combo.suit === 'trump';
    if (comboIsTrump && !winningIsTrump) {
      winner = play;
      winning = combo;
      continue;
    }
    if (!comboIsTrump && winningIsTrump) continue;
    if (combo.strength > winning.strength) {
      winner = play;
      winning = combo;
    }
  }
  return winner.seat;
}
