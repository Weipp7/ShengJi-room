import type { Card, TrumpContext } from '@shengji/shared';
import { KITTY_SIZE } from '@shengji/shared';
import { cardPoints, cardStrength, isTrump } from '@shengji/game';

const faceKey = (c: Card): string => (c.kind === 'joker' ? `j-${c.joker}` : `${c.suit}-${c.rank}`);

// 埋底：非主优先、非分牌优先、非对子成员优先、强度低优先，恰取 8 张
export function decideBury(hand: Card[], trump: TrumpContext): string[] {
  const faceCount = new Map<string, number>();
  for (const c of hand) faceCount.set(faceKey(c), (faceCount.get(faceKey(c)) ?? 0) + 1);

  const score = (c: Card): number =>
    (isTrump(c, trump) ? 10000 : 0) +
    (cardPoints(c) > 0 ? 1000 : 0) +
    ((faceCount.get(faceKey(c)) ?? 0) >= 2 ? 500 : 0) +
    cardStrength(c, trump);

  return [...hand]
    .sort((a, b) => score(a) - score(b))
    .slice(0, KITTY_SIZE)
    .map((c) => c.id);
}
