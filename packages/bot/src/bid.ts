import { teamOfSeat, type Bid, type BiddingStage, type Card, type Rank, type Suit } from '@shengji/shared';
import { availableBids, type BidOption } from '@shengji/game';

export type BotBidView = {
  hand: Card[];
  level: Rank;
  currentBid: Bid | null;
  seat: number;
  biddingStage?: BiddingStage;
};

function bidCategory(kind: Bid['kind']): number {
  if (kind.startsWith('big-joker')) return 3;
  if (kind.startsWith('small-joker')) return 2;
  return 1;
}

function suitLength(hand: Card[], suit: Suit | null): number {
  if (suit === null) return 0;
  return hand.filter((card) => card.kind === 'suit' && card.suit === suit).length;
}

function isSameTeamCurrent(view: BotBidView): boolean {
  return view.currentBid !== null && teamOfSeat(view.currentBid.seat) === teamOfSeat(view.seat);
}

function isEligibleCandidate(view: BotBidView, option: BidOption): boolean {
  if (view.currentBid === null && option.kind === 'suit-single' && suitLength(view.hand, option.suit) < 5) {
    return false;
  }
  if (isSameTeamCurrent(view) && view.currentBid !== null && option.cards.length <= view.currentBid.cards.length) {
    return false;
  }
  return true;
}

function candidateScore(view: BotBidView, option: BidOption): number {
  return option.cards.length * 100 + bidCategory(option.kind) * 10 + Math.min(suitLength(view.hand, option.suit), 20);
}

// 亮牌决策：返回亮牌 cardIds，或 null 表示过
export function decideBid(view: BotBidView): string[] | null {
  const options = availableBids(view.hand, view.level, view.currentBid).filter((option) =>
    isEligibleCandidate(view, option),
  );
  if (options.length === 0) return null;

  const best = options.reduce((winner, option) =>
    candidateScore(view, option) > candidateScore(view, winner) ? option : winner,
  );
  return best.cards.map((card) => card.id);
}
