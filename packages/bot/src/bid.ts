import { teamOfSeat, type Bid, type BiddingStage, type Card, type Rank, type Suit } from '@shengji/shared';
import { availableBids, pairBidStrength, type BidOption } from '@shengji/game';

export type BotBidView = {
  hand: Card[];
  level: Rank;
  currentBid: Bid | null;
  seat: number;
  biddingStage?: BiddingStage;
};

export type BidReason =
  | 'open-strongest'
  | 'counter-stronger'
  | 'pass-no-legal-bid'
  | 'pass-low-confidence'
  | 'pass-protect-current-contract';

export type BidPlan = {
  cardIds: string[] | null;
  reason: BidReason;
  legalCandidateCount: number;
  eligibleCandidateCount: number;
};

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
  return option.cards.length * 100 + pairBidStrength(option) * 10 + Math.min(suitLength(view.hand, option.suit), 20);
}

function passReason(view: BotBidView, legalOptions: BidOption[]): BidReason {
  if (legalOptions.length === 0) return 'pass-no-legal-bid';
  if (isSameTeamCurrent(view)) return 'pass-protect-current-contract';
  return 'pass-low-confidence';
}

// 亮牌解释：候选来自规则层生成的单张/对子级牌与王对，不枚举相同牌面的排列组合。
export function explainBid(view: BotBidView): BidPlan {
  const legalOptions = availableBids(view.hand, view.level, view.currentBid, {
    counterOnly: view.biddingStage === 'post-bury',
  });
  const eligibleOptions = legalOptions.filter((option) => isEligibleCandidate(view, option));
  if (eligibleOptions.length === 0) {
    return {
      cardIds: null,
      reason: passReason(view, legalOptions),
      legalCandidateCount: legalOptions.length,
      eligibleCandidateCount: 0,
    };
  }

  const best = eligibleOptions.reduce((winner, option) =>
    candidateScore(view, option) > candidateScore(view, winner) ? option : winner,
  );
  return {
    cardIds: best.cards.map((card) => card.id),
    reason: view.currentBid === null ? 'open-strongest' : 'counter-stronger',
    legalCandidateCount: legalOptions.length,
    eligibleCandidateCount: eligibleOptions.length,
  };
}

// 亮牌决策：返回亮牌 cardIds，或 null 表示过
export function decideBid(view: BotBidView): string[] | null {
  return explainBid(view).cardIds;
}
