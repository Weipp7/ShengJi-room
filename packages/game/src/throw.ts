import type { Card, Combo, EffectiveSuit, ThrowEventView, TrumpContext } from '@shengji/shared';
import { teamOfSeat } from '@shengji/shared';
import { detectCombo, findPairs } from './combo';
import { cardStrength, effectiveSuit } from './trump';

export type ThrowLeadEvaluation =
  | { type: 'not-throw'; code: 'cards-not-in-hand' | 'ordinary-combo' | 'invalid-throw' }
  | { type: 'success'; combo: Combo; event: ThrowEventView }
  | { type: 'failure'; combo: Combo; actualCards: Card[]; event: ThrowEventView };

function cardsInHand(cards: Card[], hand: Card[]): boolean {
  const handIds = new Set(hand.map((c) => c.id));
  const seen = new Set<string>();
  for (const card of cards) {
    if (!handIds.has(card.id) || seen.has(card.id)) return false;
    seen.add(card.id);
  }
  return true;
}

function sortPairGroups(pairs: Card[][], trump: TrumpContext): Card[][] {
  return [...pairs].sort((a, b) => {
    const byStrength = cardStrength(a[0], trump) - cardStrength(b[0], trump);
    if (byStrength !== 0) return byStrength;
    return a[0].id.localeCompare(b[0].id);
  });
}

function pairGroupsForThrow(cards: Card[], trump: TrumpContext): { suit: EffectiveSuit; pairs: Card[][] } | null {
  if (cards.length < 4 || cards.length % 2 !== 0) return null;
  const suit = effectiveSuit(cards[0], trump);
  if (!cards.every((card) => effectiveSuit(card, trump) === suit)) return null;
  if (detectCombo(cards, trump) !== null) return null;

  const pairs = findPairs(cards, trump);
  if (pairs.length * 2 !== cards.length || pairs.length < 2) return null;
  return { suit, pairs: sortPairGroups(pairs, trump) };
}

function canPairBeat(pair: Card[], target: Card[], targetSuit: EffectiveSuit, trump: TrumpContext): boolean {
  const pairSuit = effectiveSuit(pair[0], trump);
  if (targetSuit === 'trump') {
    return pairSuit === 'trump' && cardStrength(pair[0], trump) > cardStrength(target[0], trump);
  }
  if (pairSuit === 'trump') return true;
  return pairSuit === targetSuit && cardStrength(pair[0], trump) > cardStrength(target[0], trump);
}

function findBeatenPair(args: {
  seat: number;
  pairs: Card[][];
  hands: Card[][];
  suit: EffectiveSuit;
  trump: TrumpContext;
}): Card[] | null {
  for (const pair of args.pairs) {
    for (let offset = 1; offset <= 3; offset++) {
      const otherSeat = (args.seat + offset) % 4;
      if (teamOfSeat(otherSeat) === teamOfSeat(args.seat)) continue;
      const handPairs = findPairs(args.hands[otherSeat] ?? [], args.trump);
      if (handPairs.some((candidate) => canPairBeat(candidate, pair, args.suit, args.trump))) {
        return pair;
      }
    }
  }
  return null;
}

function eventId(seat: number, cards: Card[], success: boolean): string {
  return `throw-${seat}-${success ? 'success' : 'failure'}-${cards.map((card) => card.id).join('.')}`;
}

function makeThrowCombo(cards: Card[], pairs: Card[][], suit: EffectiveSuit, trump: TrumpContext): Combo {
  const components = pairs.map((pair) => detectCombo(pair, trump)!);
  return {
    type: 'throw-pairs',
    cards,
    suit,
    strength: Math.max(...components.map((combo) => combo.strength)),
    components,
  };
}

export function evaluateThrowLead(args: {
  seat: number;
  cards: Card[];
  hand: Card[];
  hands: Card[][];
  trump: TrumpContext;
}): ThrowLeadEvaluation {
  if (!cardsInHand(args.cards, args.hand)) return { type: 'not-throw', code: 'cards-not-in-hand' };
  if (detectCombo(args.cards, args.trump) !== null) return { type: 'not-throw', code: 'ordinary-combo' };

  const grouped = pairGroupsForThrow(args.cards, args.trump);
  if (grouped === null) return { type: 'not-throw', code: 'invalid-throw' };

  const n = grouped.pairs.length;
  const challengedCards = findBeatenPair({
    seat: args.seat,
    pairs: grouped.pairs,
    hands: args.hands,
    suit: grouped.suit,
    trump: args.trump,
  });

  if (challengedCards !== null) {
    const beneficiaryTeam = (1 - teamOfSeat(args.seat)) as 0 | 1;
    const combo = detectCombo(challengedCards, args.trump)!;
    return {
      type: 'failure',
      combo,
      actualCards: challengedCards,
      event: {
        id: eventId(args.seat, args.cards, false),
        seat: args.seat,
        attemptedCards: args.cards,
        actualCards: challengedCards,
        challengedCards,
        success: false,
        n,
        penaltyPoints: 20 * n,
        beneficiaryTeam,
        reason: 'beatable-pair',
      },
    };
  }

  const combo = makeThrowCombo(args.cards, grouped.pairs, grouped.suit, args.trump);
  return {
    type: 'success',
    combo,
    event: {
      id: eventId(args.seat, args.cards, true),
      seat: args.seat,
      attemptedCards: args.cards,
      actualCards: args.cards,
      challengedCards: [],
      success: true,
      n,
      penaltyPoints: 0,
      beneficiaryTeam: null,
      reason: null,
    },
  };
}
