import type { Card } from '@shengji/shared';

// 分牌：5 记 5 分，10 和 K 记 10 分
export function cardPoints(card: Card): number {
  if (card.kind !== 'suit') return 0;
  if (card.rank === 5) return 5;
  if (card.rank === 10 || card.rank === 13) return 10;
  return 0;
}

export function countPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}
