import type { Card, Combo, TrumpContext } from '@shengji/shared';
import { detectCombo, findPairs, findTractors } from './combo';
import { effectiveSuit } from './trump';

export type PlayCheck = { ok: true; combo: Combo | null } | { ok: false; code: string };

function cardsInHand(cards: Card[], hand: Card[]): boolean {
  const handIds = new Set(hand.map((c) => c.id));
  const seen = new Set<string>();
  for (const card of cards) {
    if (!handIds.has(card.id) || seen.has(card.id)) return false;
    seen.add(card.id);
  }
  return true;
}

// 领牌校验：必须构成合法牌型
export function validateLead(cards: Card[], hand: Card[], trump: TrumpContext): PlayCheck {
  if (!cardsInHand(cards, hand)) return { ok: false, code: 'cards-not-in-hand' };
  const combo = detectCombo(cards, trump);
  if (combo === null) return { ok: false, code: 'invalid-combo' };
  return { ok: true, combo };
}

function countPairsAmong(cards: Card[]): number {
  const groups = new Map<string, number>();
  for (const card of cards) {
    const key = card.kind === 'joker' ? `joker-${card.joker}` : `${card.suit}-${card.rank}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let pairs = 0;
  for (const n of groups.values()) pairs += Math.floor(n / 2);
  return pairs;
}

// 跟牌校验：张数一致 + 跟花色 + 尽量跟牌型（对子/拖拉机强制）
export function validateFollow(
  lead: Combo,
  cards: Card[],
  hand: Card[],
  trump: TrumpContext,
): PlayCheck {
  if (!cardsInHand(cards, hand)) return { ok: false, code: 'cards-not-in-hand' };
  if (cards.length !== lead.cards.length) return { ok: false, code: 'wrong-count' };

  const suitInHand = hand.filter((c) => effectiveSuit(c, trump) === lead.suit);
  const suitInPlay = cards.filter((c) => effectiveSuit(c, trump) === lead.suit);
  const requiredSuitCount = Math.min(suitInHand.length, lead.cards.length);
  if (suitInPlay.length < requiredSuitCount) return { ok: false, code: 'must-follow-suit' };

  // 手牌足够跟满该花色时才附加牌型强制
  if (suitInHand.length >= lead.cards.length) {
    if (lead.type === 'tractor') {
      const pairLen = lead.cards.length / 2;
      const tractors = findTractors(suitInHand, trump, pairLen);
      if (tractors.length > 0) {
        const combo = detectCombo(cards, trump);
        if (combo === null || combo.type !== 'tractor' || combo.suit !== lead.suit) {
          return { ok: false, code: 'must-play-tractor' };
        }
      } else {
        // 无同长度拖拉机 → 退化为对子强制
        const availablePairs = findPairs(suitInHand, trump).length;
        const requiredPairs = Math.min(availablePairs, pairLen);
        if (countPairsAmong(suitInPlay) < requiredPairs) {
          return { ok: false, code: 'must-play-pair' };
        }
      }
    } else if (lead.type === 'pair') {
      const availablePairs = findPairs(suitInHand, trump).length;
      const requiredPairs = Math.min(availablePairs, 1);
      if (countPairsAmong(suitInPlay) < requiredPairs) {
        return { ok: false, code: 'must-play-pair' };
      }
    }
  }

  return { ok: true, combo: detectCombo(cards, trump) };
}
