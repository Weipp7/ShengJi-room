import type { Bid, Card, Rank } from '@shengji/shared';
import { bidBeats, detectBid } from '@shengji/game';

export type BotBidView = { hand: Card[]; level: Rank; currentBid: Bid | null; seat: number };

// 亮牌决策：返回亮牌 cardIds，或 null 表示过
export function decideBid(view: BotBidView): string[] | null {
  const { hand, level, currentBid, seat } = view;

  const levelBySuit = new Map<string, Card[]>();
  for (const card of hand) {
    if (card.kind === 'suit' && card.rank === level) {
      const g = levelBySuit.get(card.suit) ?? [];
      g.push(card);
      levelBySuit.set(card.suit, g);
    }
  }
  const smallJokers = hand.filter((c) => c.kind === 'joker' && c.joker === 'small');
  const bigJokers = hand.filter((c) => c.kind === 'joker' && c.joker === 'big');

  // 候选从弱到强：花色≥5张的单张级牌 → 级牌对 → 小王对 → 大王对
  const candidates: Card[][] = [];
  for (const [suit, cards] of levelBySuit) {
    const suitCount = hand.filter((c) => c.kind === 'suit' && c.suit === suit).length;
    if (suitCount >= 5) candidates.push([cards[0]]);
  }
  for (const cards of levelBySuit.values()) {
    if (cards.length >= 2) candidates.push(cards.slice(0, 2));
  }
  if (smallJokers.length >= 2) candidates.push(smallJokers.slice(0, 2));
  if (bigJokers.length >= 2) candidates.push(bigJokers.slice(0, 2));

  for (const cards of candidates) {
    const bid = detectBid(cards, level, seat);
    if (bid !== null && bidBeats(bid, currentBid)) return cards.map((c) => c.id);
  }
  return null;
}
