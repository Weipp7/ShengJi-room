import type { Bid, BidKind, Card, JokerCard, Rank, Suit } from '@shengji/shared';

const kindForCount = (
  prefix: 'suit' | 'small-joker' | 'big-joker',
  count: number,
): BidKind => {
  if (count === 1) return `${prefix}-single` as BidKind;
  if (count === 2) return `${prefix}-pair` as BidKind;
  return `${prefix}-multiple` as BidKind;
};

function bidCategory(bid: Pick<Bid, 'kind'>): number {
  if (bid.kind.startsWith('big-joker')) return 3;
  if (bid.kind.startsWith('small-joker')) return 2;
  return 1;
}

function bidStrength(bid: Bid): number {
  return bid.cards.length * 10 + bidCategory(bid);
}

function sameSuitLevelCards(cards: Card[], level: Rank): { suit: Suit; cards: Card[] } | null {
  const [first] = cards;
  if (first?.kind !== 'suit' || first.rank !== level) return null;
  if (cards.every((card) => card.kind === 'suit' && card.rank === level && card.suit === first.suit)) {
    return { suit: first.suit, cards };
  }
  return null;
}

function sameJokers(cards: Card[]): { joker: JokerCard['joker']; cards: Card[] } | null {
  const [first] = cards;
  if (first?.kind !== 'joker') return null;
  if (cards.every((card) => card.kind === 'joker' && card.joker === first.joker)) {
    return { joker: first.joker, cards };
  }
  return null;
}

// 识别亮牌：任意张同花色级牌，或任意张同类王；非法返回 null
export function detectBid(cards: Card[], level: Rank, seat: number): Bid | null {
  if (cards.length === 0) return null;
  const suitBid = sameSuitLevelCards(cards, level);
  if (suitBid !== null) return { seat, kind: kindForCount('suit', cards.length), suit: suitBid.suit, cards };

  const jokerBid = sameJokers(cards);
  if (jokerBid !== null) {
    return {
      seat,
      kind: kindForCount(jokerBid.joker === 'big' ? 'big-joker' : 'small-joker', cards.length),
      suit: null,
      cards,
    };
  }

  return null;
}

// 反主：强度必须严格更高。张数优先；同张数下 花色级牌 < 小王 < 大王。
export function bidBeats(candidate: Bid, current: Bid | null): boolean {
  if (current === null) return true;
  return bidStrength(candidate) > bidStrength(current);
}

// 王亮牌 → 无主局
export function trumpSuitOfBid(bid: Bid): Suit | null {
  return bid.suit;
}

export type BidOption = { kind: BidKind; suit: Suit | null; cards: Card[] };

// 手牌中能压过当前叫主的全部选项：每花色取最强（对优于单），王对为无主
export function availableBids(hand: Card[], level: Rank, current: Bid | null): BidOption[] {
  const options: BidOption[] = [];
  for (const suit of ['S', 'H', 'D', 'C'] as Suit[]) {
    const levels = hand.filter((c) => c.kind === 'suit' && c.suit === suit && c.rank === level);
    if (levels.length > 0) options.push({ kind: kindForCount('suit', levels.length), suit, cards: levels });
  }
  for (const j of ['small', 'big'] as const) {
    const jokers = hand.filter((c) => c.kind === 'joker' && c.joker === j);
    if (jokers.length > 0) {
      options.push({
        kind: kindForCount(j === 'big' ? 'big-joker' : 'small-joker', jokers.length),
        suit: null,
        cards: jokers,
      });
    }
  }
  return options.filter((o) => bidBeats({ seat: -1, ...o }, current));
}
