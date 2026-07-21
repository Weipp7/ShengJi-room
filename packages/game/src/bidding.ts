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

export type BidOption = { kind: BidKind; suit: Suit | null; cards: Card[] };

// 手牌中能压过当前叫主的全部选项：每花色取最强（对优于单），王对为无主
export function availableBids(hand: Card[], level: Rank, current: Bid | null): BidOption[] {
  const options: BidOption[] = [];
  for (const suit of ['S', 'H', 'D', 'C'] as Suit[]) {
    const levels = hand.filter((c) => c.kind === 'suit' && c.suit === suit && c.rank === level);
    if (levels.length >= 2) options.push({ kind: 'suit-pair', suit, cards: levels.slice(0, 2) });
    else if (levels.length === 1) options.push({ kind: 'suit-single', suit, cards: levels });
  }
  for (const j of ['small', 'big'] as const) {
    const jokers = hand.filter((c) => c.kind === 'joker' && c.joker === j);
    if (jokers.length >= 2) {
      options.push({
        kind: j === 'big' ? 'big-joker-pair' : 'small-joker-pair',
        suit: null,
        cards: jokers.slice(0, 2),
      });
    }
  }
  return options.filter((o) => bidBeats({ seat: -1, ...o }, current));
}
