export type Suit = 'S' | 'H' | 'D' | 'C';

// 11=J 12=Q 13=K 14=A
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type SuitCard = { id: string; kind: 'suit'; suit: Suit; rank: Rank };
export type JokerCard = { id: string; kind: 'joker'; joker: 'small' | 'big' };
export type Card = SuitCard | JokerCard;

export type TrumpContext = { trumpSuit: Suit | null; level: Rank };

export type EffectiveSuit = Suit | 'trump';

export type ComboType = 'single' | 'pair' | 'tractor' | 'throw-pairs';

export type Combo = {
  type: ComboType;
  cards: Card[];
  suit: EffectiveSuit;
  strength: number;
  components?: Combo[];
};

export type BidKind =
  | 'suit-single'
  | 'suit-pair'
  | 'suit-multiple'
  | 'small-joker-single'
  | 'small-joker-pair'
  | 'small-joker-multiple'
  | 'big-joker-single'
  | 'big-joker-pair'
  | 'big-joker-multiple';

export type Bid = { seat: number; kind: BidKind; suit: Suit | null; cards: Card[] };
