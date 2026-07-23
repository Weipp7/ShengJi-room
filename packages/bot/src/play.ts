import type { Card, Combo, EffectiveSuit, TrumpContext } from '@shengji/shared';
import { teamOfSeat } from '@shengji/shared';
import {
  buildDeck,
  cardPoints,
  cardStrength,
  detectCombo,
  effectiveSuit,
  findPairs,
  findTractors,
  trickWinner,
  validateFollow,
  type TrickPlay,
} from '@shengji/game';

export type BotPlayView = {
  hand: Card[];
  trump: TrumpContext;
  leadCombo: Combo | null;
  currentTrick: TrickPlay[];
  seat: number;
  trickPointsSoFar: number;
};

export type PlayReason =
  | 'lead-safe-throw-pairs'
  | 'lead-tractor'
  | 'lead-strong-pair'
  | 'lead-cheapest-single'
  | 'lead-preserve-shape-single'
  | 'follow-forced-suit'
  | 'win-points-minimal'
  | 'trump-points-minimal'
  | 'preserve-control'
  | 'support-teammate'
  | 'avoid-points'
  | 'follow-throw-pairs'
  | 'follow-tractor'
  | 'fallback';

export type PlayPlan = {
  cardIds: string[];
  reason: PlayReason;
};

// 垫牌避分：分牌重罚，其次留强度高的牌
const avoidScore = (c: Card, trump: TrumpContext): number =>
  cardPoints(c) * 40 + cardStrength(c, trump);

// 送分：分牌优先（负分奖励），同分留强牌
const dumpScore = (c: Card, trump: TrumpContext): number =>
  -cardPoints(c) * 40 + cardStrength(c, trump);

const faceKey = (c: Card): string => (c.kind === 'joker' ? `j-${c.joker}` : `${c.suit}-${c.rank}`);

function faceCounts(hand: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of hand) counts.set(faceKey(c), (counts.get(faceKey(c)) ?? 0) + 1);
  return counts;
}

function cardsStrength(cards: Card[], trump: TrumpContext): number {
  return Math.max(...cards.map((card) => cardStrength(card, trump)));
}

function pairCanBeat(target: Card[], candidate: Card[], trump: TrumpContext): boolean {
  const targetSuit = effectiveSuit(target[0], trump);
  const candidateSuit = effectiveSuit(candidate[0], trump);
  if (targetSuit === 'trump') {
    return candidateSuit === 'trump' && cardStrength(candidate[0], trump) > cardStrength(target[0], trump);
  }
  if (candidateSuit === 'trump') return true;
  return candidateSuit === targetSuit && cardStrength(candidate[0], trump) > cardStrength(target[0], trump);
}

function sortByStrength(cards: Card[][], trump: TrumpContext): Card[][] {
  return [...cards].sort((a, b) => {
    const diff = cardsStrength(a, trump) - cardsStrength(b, trump);
    return diff !== 0 ? diff : a.map((card) => card.id).join('|').localeCompare(b.map((card) => card.id).join('|'));
  });
}

function groupScore(cards: Card[], trump: TrumpContext, score: (card: Card, trump: TrumpContext) => number): number {
  return cards.reduce((sum, card) => sum + score(card, trump), 0);
}

function sortByGroupScore(
  groups: Card[][],
  trump: TrumpContext,
  score: (card: Card, trump: TrumpContext) => number,
): Card[][] {
  return [...groups].sort((a, b) => {
    const diff = groupScore(a, trump, score) - groupScore(b, trump, score);
    if (diff !== 0) return diff;
    return cardsStrength(a, trump) - cardsStrength(b, trump);
  });
}

function provablyUnbeatablePair(pair: Card[], trump: TrumpContext, counts: Map<string, number>): boolean {
  const deckPairs = findPairs(buildDeck(), trump);
  return deckPairs
    .filter((candidate) => pairCanBeat(pair, candidate, trump))
    .every((candidate) => (counts.get(faceKey(candidate[0])) ?? 0) >= 2);
}

function safeThrowPairs(hand: Card[], trump: TrumpContext, counts: Map<string, number>): Card[] | null {
  const pairs = findPairs(hand, trump).filter((pair) => provablyUnbeatablePair(pair, trump, counts));
  const bySuit = new Map<EffectiveSuit, Card[][]>();
  for (const pair of pairs) {
    const suit = effectiveSuit(pair[0], trump);
    const group = bySuit.get(suit) ?? [];
    group.push(pair);
    bySuit.set(suit, group);
  }

  const candidates = [...bySuit.values()]
    .filter((group) => group.length >= 2)
    .map((group) => sortByStrength(group, trump).flat())
    .filter((cards) => detectCombo(cards, trump) === null)
    .sort((a, b) => {
      const byLength = b.length - a.length;
      if (byLength !== 0) return byLength;
      return cardsStrength(b, trump) - cardsStrength(a, trump);
    });

  return candidates[0] ?? null;
}

function trumpingGroups(lead: Combo, winning: Combo, cards: Card[], trump: TrumpContext): Card[][] {
  const trumpCards = cards.filter((card) => effectiveSuit(card, trump) === 'trump');
  let groups: Card[][] = [];
  if (lead.type === 'single') {
    groups = trumpCards.map((card) => [card]);
  } else if (lead.type === 'pair') {
    groups = findPairs(trumpCards, trump);
  } else if (lead.type === 'tractor') {
    groups = findTractors(trumpCards, trump, lead.cards.length / 2);
  }
  return sortByStrength(groups, trump).filter((group) => {
    if (group.length !== lead.cards.length) return false;
    return winning.suit === 'trump' ? cardsStrength(group, trump) > winning.strength : true;
  });
}

export function decidePlay(view: BotPlayView): string[] {
  return explainPlay(view).cardIds;
}

export function explainPlay(view: BotPlayView): PlayPlan {
  return view.leadCombo === null ? decideLead(view) : decideFollow(view);
}

function groupByEffectiveSuit(hand: Card[], trump: TrumpContext): Map<EffectiveSuit, Card[]> {
  const groups = new Map<EffectiveSuit, Card[]>();
  for (const card of hand) {
    const suit = effectiveSuit(card, trump);
    const g = groups.get(suit) ?? [];
    g.push(card);
    groups.set(suit, g);
  }
  return groups;
}

function plan(cards: Card[], reason: PlayReason): PlayPlan {
  return { cardIds: cards.map((c) => c.id), reason };
}

function decideLead(view: BotPlayView): PlayPlan {
  const { hand, trump } = view;
  const groups = groupByEffectiveSuit(hand, trump);
  const counts = faceCounts(hand);
  const safeSingles = hand.filter(
    (card) =>
      effectiveSuit(card, trump) !== 'trump' &&
      cardPoints(card) === 0 &&
      (counts.get(faceKey(card)) ?? 0) < 2,
  );
  if (safeSingles.length > 0) {
    const sorted = [...safeSingles].sort((a, b) => avoidScore(a, trump) - avoidScore(b, trump));
    return plan([sorted[0]], 'lead-preserve-shape-single');
  }

  const safeThrow = safeThrowPairs(hand, trump, counts);
  if (safeThrow !== null) {
    return plan(safeThrow, 'lead-safe-throw-pairs');
  }

  // 两连对拖拉机优先领出（取最强一组）
  for (const cards of groups.values()) {
    const tractors = findTractors(cards, trump, 2);
    if (tractors.length > 0) {
      return plan(tractors[tractors.length - 1], 'lead-tractor');
    }
  }
  // 大对子（副牌 A 对或主牌高强度对）领出
  for (const cards of groups.values()) {
    for (const pair of findPairs(cards, trump)) {
      const s = cardStrength(pair[0], trump);
      if (s === 14 || s >= 114) return plan(pair, 'lead-strong-pair');
    }
  }
  // 最低价值单张
  const sorted = [...hand].sort((a, b) => avoidScore(a, trump) - avoidScore(b, trump));
  return plan([sorted[0]], 'lead-cheapest-single');
}

function decideFollow(view: BotPlayView): PlayPlan {
  const { hand, trump, currentTrick, seat } = view;
  const lead = view.leadCombo!;
  const n = lead.cards.length;
  const suitCards = hand.filter((c) => effectiveSuit(c, trump) === lead.suit);

  const winnerSeat = trickWinner(currentTrick, trump);
  const winning = currentTrick.find((p) => p.seat === winnerSeat)!.combo!;
  const teammateWinning = teamOfSeat(winnerSeat) === teamOfSeat(seat);
  const orderScore = teammateWinning ? dumpScore : avoidScore;
  const sortByOrder = (cards: Card[]): Card[] =>
    [...cards].sort((a, b) => orderScore(a, trump) - orderScore(b, trump));

  let play: Card[];
  let reason: PlayReason = teammateWinning ? 'support-teammate' : 'avoid-points';
  if (suitCards.length <= n) {
    // 该花色全出 + 垫牌补足
    const suitIds = new Set(suitCards.map((c) => c.id));
    const restCards = hand.filter((c) => !suitIds.has(c.id));
    const rest = sortByOrder(restCards);
    const trumpWinners =
      suitCards.length === 0 && !teammateWinning && view.trickPointsSoFar > 0
        ? trumpingGroups(lead, winning, restCards, trump)
        : [];
    if (trumpWinners.length > 0) {
      play = trumpWinners[0];
      reason = 'trump-points-minimal';
    } else {
      play = [...suitCards, ...rest.slice(0, n - suitCards.length)];
      reason = suitCards.length > 0 ? 'follow-forced-suit' : teammateWinning ? 'support-teammate' : 'avoid-points';
    }
  } else if (lead.type === 'single') {
    const byStrength = [...suitCards].sort(
      (a, b) => cardStrength(a, trump) - cardStrength(b, trump),
    );
    const smallestWinner = byStrength.find((card) => cardStrength(card, trump) > winning.strength);
    const canBeat = winning.suit === lead.suit && smallestWinner !== undefined;
    if (!teammateWinning && view.trickPointsSoFar > 0 && canBeat) {
      play = [smallestWinner];
      reason = 'win-points-minimal';
    } else {
      play = [sortByOrder(suitCards)[0]];
      reason = teammateWinning ? 'support-teammate' : 'preserve-control';
    }
  } else if (lead.type === 'pair') {
    const pairs = findPairs(suitCards, trump);
    if (pairs.length > 0) {
      const winningPairs = sortByStrength(pairs, trump).filter(
        (pair) => winning.suit === lead.suit && cardStrength(pair[0], trump) > winning.strength,
      );
      if (!teammateWinning && view.trickPointsSoFar > 0 && winningPairs.length > 0) {
        play = winningPairs[0];
        reason = 'win-points-minimal';
      } else {
        play = sortByGroupScore(pairs, trump, orderScore)[0];
        reason = teammateWinning ? 'support-teammate' : 'preserve-control';
      }
    } else {
      play = sortByOrder(suitCards).slice(0, 2);
      reason = 'follow-forced-suit';
    }
  } else if (lead.type === 'throw-pairs') {
    const pairLen = n / 2;
    const pairs = findPairs(suitCards, trump);
    const need = Math.min(pairs.length, pairLen);
    const used = new Set<string>();
    play = [];
    for (const p of sortByGroupScore(pairs, trump, orderScore).slice(0, need)) {
      play.push(...p);
      for (const c of p) used.add(c.id);
    }
    const rest = sortByOrder(suitCards.filter((c) => !used.has(c.id)));
    play.push(...rest.slice(0, n - play.length));
    reason = 'follow-throw-pairs';
  } else {
    // tractor
    const pairLen = n / 2;
    const tractors = findTractors(suitCards, trump, pairLen);
    if (tractors.length > 0) {
      const winningTractors = sortByStrength(tractors, trump).filter(
        (tractor) => winning.suit === lead.suit && cardsStrength(tractor, trump) > winning.strength,
      );
      if (!teammateWinning && view.trickPointsSoFar > 0 && winningTractors.length > 0) {
        play = winningTractors[0];
        reason = 'win-points-minimal';
      } else {
        play = sortByGroupScore(tractors, trump, orderScore)[0];
        reason = teammateWinning ? 'support-teammate' : 'preserve-control';
      }
    } else {
      const pairs = findPairs(suitCards, trump);
      const need = Math.min(pairs.length, pairLen);
      const used = new Set<string>();
      play = [];
      for (const p of sortByGroupScore(pairs, trump, orderScore).slice(0, need)) {
        play.push(...p);
        for (const c of p) used.add(c.id);
      }
      const rest = sortByOrder(suitCards.filter((c) => !used.has(c.id)));
      play.push(...rest.slice(0, n - play.length));
      reason = 'follow-tractor';
    }
  }

  const check = validateFollow(lead, play, hand, trump);
  if (check.ok) return plan(play, reason);
  // 理论不可达的兜底：花色牌优先 + 垫牌补齐
  const suitIds = new Set(suitCards.map((c) => c.id));
  const fallback = [
    ...sortByOrder(suitCards),
    ...sortByOrder(hand.filter((c) => !suitIds.has(c.id))),
  ].slice(0, n);
  return plan(fallback, 'fallback');
}
