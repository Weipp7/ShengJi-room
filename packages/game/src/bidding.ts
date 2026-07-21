import type { Bid, BidKind, Card, Rank, Suit } from '@shengji/shared';

const BID_STRENGTH: Record<BidKind, number> = {
  'suit-single': 1,
  'suit-pair': 2,
  'small-joker-pair': 3,
  'big-joker-pair': 4,
};

// 识别亮牌：单张/一对级牌，或王对；非法返回 null
export function detectBid(cards: Card[], level: Rank, seat: number): Bid | null {
  if (cards.length === 1) {
    const card = cards[0];
    if (card.kind !== 'suit' || card.rank !== level) return null;
    return { seat, kind: 'suit-single', suit: card.suit, cards };
  }
  if (cards.length === 2) {
    const [a, b] = cards;
    if (a.kind === 'joker' && b.kind === 'joker' && a.joker === b.joker) {
      return { seat, kind: a.joker === 'big' ? 'big-joker-pair' : 'small-joker-pair', suit: null, cards };
    }
    if (
      a.kind === 'suit' &&
      b.kind === 'suit' &&
      a.rank === level &&
      b.rank === level &&
      a.suit === b.suit
    ) {
      return { seat, kind: 'suit-pair', suit: a.suit, cards };
    }
  }
  return null;
}

// 反主：强度必须严格更高（同强度不同花色也不可反）
export function bidBeats(candidate: Bid, current: Bid | null): boolean {
  if (current === null) return true;
  return BID_STRENGTH[candidate.kind] > BID_STRENGTH[current.kind];
}

// 王对 → 无主局
export function trumpSuitOfBid(bid: Bid): Suit | null {
  return bid.suit;
}
