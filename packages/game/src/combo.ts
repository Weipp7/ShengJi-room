import type { Card, Combo, TrumpContext } from '@shengji/shared';
import { cardStrength, effectiveSuit } from './trump';

const OFF_LEVEL_STRENGTH = 120;

// 同牌面：两张 suit+rank 相同，或同级王
export function isSameFace(a: Card, b: Card): boolean {
  if (a.kind === 'joker' && b.kind === 'joker') return a.joker === b.joker;
  if (a.kind === 'suit' && b.kind === 'suit') return a.suit === b.suit && a.rank === b.rank;
  return false;
}

// 某有效花色的完整强度档位表（升序），用于拖拉机相邻判定
function strengthLadder(suit: ReturnType<typeof effectiveSuit>, trump: TrumpContext): number[] {
  if (suit !== 'trump') {
    const ladder: number[] = [];
    for (let r = 2; r <= 14; r++) if (r !== trump.level) ladder.push(r);
    return ladder;
  }
  const ladder: number[] = [];
  if (trump.trumpSuit !== null) {
    for (let r = 2; r <= 14; r++) if (r !== trump.level) ladder.push(100 + r);
    ladder.push(OFF_LEVEL_STRENGTH, 121);
  } else {
    ladder.push(OFF_LEVEL_STRENGTH);
  }
  ladder.push(130, 131);
  return ladder;
}

// 把牌按牌面分组；每组恰 2 张时返回对子列表，否则 null
function groupIntoPairs(cards: Card[]): Card[][] | null {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = card.kind === 'joker' ? `joker-${card.joker}` : `${card.suit}-${card.rank}`;
    const g = groups.get(key) ?? [];
    g.push(card);
    groups.set(key, g);
  }
  const pairs: Card[][] = [];
  for (const g of groups.values()) {
    if (g.length !== 2) return null;
    pairs.push(g);
  }
  return pairs;
}

// 识别一手出牌：单张 / 对子 / 拖拉机（≥2 个同花色相邻对子）；非法返回 null
export function detectCombo(cards: Card[], trump: TrumpContext): Combo | null {
  if (cards.length === 0) return null;
  const suit = effectiveSuit(cards[0], trump);
  if (!cards.every((card) => effectiveSuit(card, trump) === suit)) return null;

  if (cards.length === 1) {
    return { type: 'single', cards, suit, strength: cardStrength(cards[0], trump) };
  }
  if (cards.length === 2) {
    if (!isSameFace(cards[0], cards[1])) return null;
    return { type: 'pair', cards, suit, strength: cardStrength(cards[0], trump) };
  }
  if (cards.length % 2 !== 0) return null;

  const pairs = groupIntoPairs(cards);
  if (pairs === null) return null;
  const strengths = pairs.map((p) => cardStrength(p[0], trump)).sort((a, b) => a - b);
  // 副花色级牌对彼此同强度且跨花色，不参与拖拉机；但 120 档作为阻隔档保留在梯度表中
  if (strengths.some((s) => s === OFF_LEVEL_STRENGTH)) return null;
  const ladder = strengthLadder(suit, trump);
  for (let i = 0; i < strengths.length - 1; i++) {
    const a = ladder.indexOf(strengths[i]);
    const b = ladder.indexOf(strengths[i + 1]);
    if (a === -1 || b === -1 || b - a !== 1) return null;
  }
  return { type: 'tractor', cards, suit, strength: strengths[strengths.length - 1] };
}

// 枚举给定牌集合（应为同一有效花色）中的所有对子
export function findPairs(cards: Card[], trump: TrumpContext): Card[][] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = card.kind === 'joker' ? `joker-${card.joker}` : `${card.suit}-${card.rank}`;
    const g = groups.get(key) ?? [];
    g.push(card);
    groups.set(key, g);
  }
  const pairs: Card[][] = [];
  for (const g of groups.values()) {
    if (g.length >= 2) pairs.push(g.slice(0, 2));
  }
  void trump;
  return pairs;
}

// 枚举定长（pairLen 个对子）拖拉机
export function findTractors(cards: Card[], trump: TrumpContext, pairLen: number): Card[][] {
  const pairs = findPairs(cards, trump).filter(
    (p) => cardStrength(p[0], trump) !== OFF_LEVEL_STRENGTH,
  );
  if (pairs.length < pairLen) return [];
  const suit = cards.length > 0 ? effectiveSuit(cards[0], trump) : null;
  if (suit === null) return [];
  const ladder = strengthLadder(suit, trump);
  const byIndex = new Map<number, Card[]>();
  for (const p of pairs) {
    byIndex.set(ladder.indexOf(cardStrength(p[0], trump)), p);
  }
  const results: Card[][] = [];
  const indices = [...byIndex.keys()].sort((a, b) => a - b);
  for (const start of indices) {
    const run: Card[] = [];
    for (let k = 0; k < pairLen; k++) {
      const p = byIndex.get(start + k);
      if (!p) break;
      run.push(...p);
    }
    if (run.length === pairLen * 2) results.push(run);
  }
  return results;
}
