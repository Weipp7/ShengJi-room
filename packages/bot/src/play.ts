import type { Card, Combo, EffectiveSuit, TrumpContext } from '@shengji/shared';
import { teamOfSeat } from '@shengji/shared';
import {
  cardPoints,
  cardStrength,
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

// 垫牌避分：分牌重罚，其次留强度高的牌
const avoidScore = (c: Card, trump: TrumpContext): number =>
  cardPoints(c) * 40 + cardStrength(c, trump);

// 送分：分牌优先（负分奖励），同分留强牌
const dumpScore = (c: Card, trump: TrumpContext): number =>
  -cardPoints(c) * 40 + cardStrength(c, trump);

export function decidePlay(view: BotPlayView): string[] {
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

function decideLead(view: BotPlayView): string[] {
  const { hand, trump } = view;
  const groups = groupByEffectiveSuit(hand, trump);
  // 两连对拖拉机优先领出（取最强一组）
  for (const cards of groups.values()) {
    const tractors = findTractors(cards, trump, 2);
    if (tractors.length > 0) {
      return tractors[tractors.length - 1].map((c) => c.id);
    }
  }
  // 大对子（副牌 A 对或主牌高强度对）领出
  for (const cards of groups.values()) {
    for (const pair of findPairs(cards, trump)) {
      const s = cardStrength(pair[0], trump);
      if (s === 14 || s >= 114) return pair.map((c) => c.id);
    }
  }
  // 最低价值单张
  const sorted = [...hand].sort((a, b) => avoidScore(a, trump) - avoidScore(b, trump));
  return [sorted[0].id];
}

function decideFollow(view: BotPlayView): string[] {
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
  if (suitCards.length <= n) {
    // 该花色全出 + 垫牌补足
    const suitIds = new Set(suitCards.map((c) => c.id));
    const rest = sortByOrder(hand.filter((c) => !suitIds.has(c.id)));
    play = [...suitCards, ...rest.slice(0, n - suitCards.length)];
  } else if (lead.type === 'single') {
    const byStrength = [...suitCards].sort(
      (a, b) => cardStrength(a, trump) - cardStrength(b, trump),
    );
    const strongest = byStrength[byStrength.length - 1];
    const canBeat =
      winning.suit === lead.suit && cardStrength(strongest, trump) > winning.strength;
    play = !teammateWinning && canBeat ? [strongest] : [sortByOrder(suitCards)[0]];
  } else if (lead.type === 'pair') {
    const pairs = findPairs(suitCards, trump);
    if (pairs.length > 0) {
      const sortedPairs = [...pairs].sort(
        (a, b) => cardStrength(a[0], trump) - cardStrength(b[0], trump),
      );
      const strongest = sortedPairs[sortedPairs.length - 1];
      const canBeat =
        winning.suit === lead.suit && cardStrength(strongest[0], trump) > winning.strength;
      if (!teammateWinning && canBeat) {
        play = strongest;
      } else {
        const cheapest = [...pairs].sort(
          (a, b) => orderScore(a[0], trump) - orderScore(b[0], trump),
        )[0];
        play = cheapest;
      }
    } else {
      play = sortByOrder(suitCards).slice(0, 2);
    }
  } else {
    // tractor
    const pairLen = n / 2;
    const tractors = findTractors(suitCards, trump, pairLen);
    if (tractors.length > 0) {
      play = tractors[tractors.length - 1];
    } else {
      const pairs = findPairs(suitCards, trump);
      const need = Math.min(pairs.length, pairLen);
      const used = new Set<string>();
      play = [];
      for (const p of pairs.slice(0, need)) {
        play.push(...p);
        for (const c of p) used.add(c.id);
      }
      const rest = sortByOrder(suitCards.filter((c) => !used.has(c.id)));
      play.push(...rest.slice(0, n - play.length));
    }
  }

  const check = validateFollow(lead, play, hand, trump);
  if (check.ok) return play.map((c) => c.id);
  // 理论不可达的兜底：花色牌优先 + 垫牌补齐
  const suitIds = new Set(suitCards.map((c) => c.id));
  const fallback = [
    ...sortByOrder(suitCards),
    ...sortByOrder(hand.filter((c) => !suitIds.has(c.id))),
  ].slice(0, n);
  return fallback.map((c) => c.id);
}
