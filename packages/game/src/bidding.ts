import type { Bid, BidKind, Card, JokerCard, Rank, Suit } from '@shengji/shared';

const SUIT_PAIR_STRENGTH: Record<Suit, number> = {
  D: 1,
  C: 2,
  H: 3,
  S: 4,
};

export function isPairBid(bid: Pick<Bid, 'kind' | 'cards'>): boolean {
  return bid.cards.length === 2 && bid.kind.endsWith('-pair');
}

// 反主对子强度：大王 > 小王 > 黑桃 > 红桃 > 草花 > 方块。
export function pairBidStrength(bid: Pick<Bid, 'kind' | 'suit'>): number {
  if (bid.kind === 'big-joker-pair') return 6;
  if (bid.kind === 'small-joker-pair') return 5;
  return bid.suit === null ? 0 : SUIT_PAIR_STRENGTH[bid.suit];
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

// 识别亮牌：单张/一对同花色级牌，或一对同类王；单王和三张以上均非法。
export function detectBid(cards: Card[], level: Rank, seat: number): Bid | null {
  if (cards.length < 1 || cards.length > 2) return null;
  const suitBid = sameSuitLevelCards(cards, level);
  if (suitBid !== null) {
    return {
      seat,
      kind: cards.length === 1 ? 'suit-single' : 'suit-pair',
      suit: suitBid.suit,
      cards,
    };
  }

  const jokerBid = sameJokers(cards);
  if (jokerBid !== null && cards.length === 2) {
    return {
      seat,
      kind: jokerBid.joker === 'big' ? 'big-joker-pair' : 'small-joker-pair',
      suit: null,
      cards,
    };
  }

  return null;
}

// 反主只能用对子。任何合法对子都能反单张；对子之间按固定强度严格递增。
export function bidBeats(candidate: Bid, current: Bid | null): boolean {
  if (current === null) return true;
  if (!isPairBid(candidate)) return false;
  if (!isPairBid(current)) return true;
  return pairBidStrength(candidate) > pairBidStrength(current);
}

// 王亮牌 → 无主局
export function trumpSuitOfBid(bid: Bid): Suit | null {
  return bid.suit;
}

export type BidOption = { kind: BidKind; suit: Suit | null; cards: Card[] };

// 手牌中的合法亮主/反主选项。已有亮牌或 counterOnly 时只返回能反主的对子。
export function availableBids(
  hand: Card[],
  level: Rank,
  current: Bid | null,
  opts: { counterOnly?: boolean } = {},
): BidOption[] {
  const options: BidOption[] = [];
  const counterOnly = opts.counterOnly === true || current !== null;
  for (const suit of ['S', 'H', 'D', 'C'] as Suit[]) {
    const levels = hand.filter((c) => c.kind === 'suit' && c.suit === suit && c.rank === level);
    if (levels.length >= 2) {
      options.push({ kind: 'suit-pair', suit, cards: levels.slice(0, 2) });
    } else if (levels.length === 1 && !counterOnly) {
      options.push({ kind: 'suit-single', suit, cards: levels });
    }
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
