import type { Card, TrumpContext } from '@shengji/shared';
import { KITTY_SIZE } from '@shengji/shared';
import { cardPoints, cardStrength, countPoints, effectiveSuit, isTrump } from '@shengji/game';

export type DealerProfile = 'weak' | 'balanced' | 'strong';

export type BuryCandidateView = {
  cardIds: string[];
  voidCardIds: string[] | null;
  cost: number;
};

export type BuryPlan = {
  profile: DealerProfile;
  cardIds: string[];
  candidates: BuryCandidateView[];
};

type BuryCandidate = {
  cards: Card[];
  voidGroup: Card[] | null;
};

const faceKey = (c: Card): string => (c.kind === 'joker' ? `j-${c.joker}` : `${c.suit}-${c.rank}`);

function faceCounts(hand: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of hand) counts.set(faceKey(c), (counts.get(faceKey(c)) ?? 0) + 1);
  return counts;
}

function cardBuryCost(card: Card, trump: TrumpContext, counts: Map<string, number>): number {
  const points = cardPoints(card);
  return (
    (isTrump(card, trump) ? 10000 : 0) +
    (points > 0 ? 1400 + points * 80 : 0) +
    ((counts.get(faceKey(card)) ?? 0) >= 2 ? 650 : 0) +
    cardStrength(card, trump)
  );
}

function lowestByCost(cards: Card[], count: number, trump: TrumpContext, counts: Map<string, number>): Card[] {
  return [...cards]
    .sort((a, b) => {
      const diff = cardBuryCost(a, trump, counts) - cardBuryCost(b, trump, counts);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    })
    .slice(0, count);
}

function isLowRiskBuryCard(card: Card, trump: TrumpContext, counts: Map<string, number>): boolean {
  return !isTrump(card, trump) && cardPoints(card) === 0 && (counts.get(faceKey(card)) ?? 0) < 2;
}

function dealerProfile(hand: Card[], trump: TrumpContext): DealerProfile {
  const trumpCards = hand.filter((card) => isTrump(card, trump));
  const topTrumpControls = trumpCards.filter((card) => cardStrength(card, trump) >= 114).length;

  if (trumpCards.length >= 10 || topTrumpControls >= 4) return 'strong';
  if (trumpCards.length <= 7 && topTrumpControls === 0) return 'weak';
  return 'balanced';
}

function voidBonusPerCard(profile: DealerProfile): number {
  if (profile === 'strong') return 750;
  if (profile === 'balanced') return 600;
  return 0;
}

function safeVoidGroups(hand: Card[], trump: TrumpContext, counts: Map<string, number>): Card[][] {
  const groups = new Map<string, Card[]>();
  for (const card of hand) {
    const suit = effectiveSuit(card, trump);
    if (suit === 'trump') continue;
    const g = groups.get(suit) ?? [];
    g.push(card);
    groups.set(suit, g);
  }
  return [...groups.values()].filter((cards) => {
    if (cards.length === 0 || cards.length > KITTY_SIZE) return false;
    if (countPoints(cards) > 0) return false;
    return cards.every((card) => (counts.get(faceKey(card)) ?? 0) < 2);
  });
}

function candidateCost(
  candidate: BuryCandidate,
  trump: TrumpContext,
  counts: Map<string, number>,
  voidBonus: number,
): number {
  const bonus = candidate.voidGroup === null ? 0 : candidate.voidGroup.length * voidBonus;
  return candidate.cards.reduce((sum, card) => sum + cardBuryCost(card, trump, counts), 0) - bonus;
}

export function explainBury(hand: Card[], trump: TrumpContext): BuryPlan {
  const counts = faceCounts(hand);
  const profile = dealerProfile(hand, trump);
  const voidBonus = voidBonusPerCard(profile);
  const defaultCandidate = lowestByCost(hand, KITTY_SIZE, trump, counts);
  const candidates: BuryCandidate[] = [{ cards: defaultCandidate, voidGroup: null }];
  const voidGroups = safeVoidGroups(hand, trump, counts);

  for (const voidGroup of voidGroups) {
    if (voidBonus === 0) continue;
    const voidIds = new Set(voidGroup.map((card) => card.id));
    const rest = hand.filter((card) => !voidIds.has(card.id));
    const filler = lowestByCost(rest, KITTY_SIZE - voidGroup.length, trump, counts);
    if (filler.every((card) => isLowRiskBuryCard(card, trump, counts))) {
      candidates.push({ cards: [...voidGroup, ...filler], voidGroup });
    }
  }

  const ranked = candidates.sort((a, b) => {
    const diff = candidateCost(a, trump, counts, voidBonus) - candidateCost(b, trump, counts, voidBonus);
    if (diff !== 0) return diff;
    return a.cards
      .map((card) => card.id)
      .join('|')
      .localeCompare(b.cards.map((card) => card.id).join('|'));
  });
  const best = ranked[0];

  return {
    profile,
    cardIds: best.cards.map((c) => c.id),
    candidates: ranked.map((candidate) => ({
      cardIds: candidate.cards.map((c) => c.id),
      voidCardIds: candidate.voidGroup === null ? null : candidate.voidGroup.map((c) => c.id),
      cost: candidateCost(candidate, trump, counts, voidBonus),
    })),
  };
}

// 埋底：先保证保主、保分、保对子，再在安全时主动断一门副牌，恰取 8 张。
export function decideBury(hand: Card[], trump: TrumpContext): string[] {
  return explainBury(hand, trump).cardIds;
}
