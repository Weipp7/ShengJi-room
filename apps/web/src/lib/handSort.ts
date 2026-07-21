import type { Card, TrumpContext } from '@shengji/shared';
import { sortHand } from '@shengji/game';

// 展示排序：服务端已排好，这里兜底保证顺序稳定（仅展示，不做权威校验）
export function displaySort(hand: Card[], trump: TrumpContext | null): Card[] {
  return trump ? sortHand(hand, trump) : hand;
}
