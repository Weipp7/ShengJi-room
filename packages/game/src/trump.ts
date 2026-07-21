import type { Card, EffectiveSuit, Suit, TrumpContext } from '@shengji/shared';

export function isTrump(card: Card, trump: TrumpContext): boolean {
  if (card.kind === 'joker') return true;
  if (card.rank === trump.level) return true;
  return trump.trumpSuit !== null && card.suit === trump.trumpSuit;
}

export function effectiveSuit(card: Card, trump: TrumpContext): EffectiveSuit {
  return isTrump(card, trump) ? 'trump' : (card as { suit: Suit }).suit;
}

// 同一有效花色内的牌力序数，越大越强；跨花色不可比。
// 主牌序（高→低）：大王 131 > 小王 130 > 主花色级牌 121 > 副花色级牌 120（彼此同级）
//   > 主花色 A..2（去掉级牌）映射到 100+rank
// 副牌序：rank 原值（级牌已归入主牌组）
export function cardStrength(card: Card, trump: TrumpContext): number {
  if (card.kind === 'joker') return card.joker === 'big' ? 131 : 130;
  if (card.rank === trump.level) {
    if (trump.trumpSuit === null) return 120; // 无主局所有级牌等价
    return card.suit === trump.trumpSuit ? 121 : 120;
  }
  if (trump.trumpSuit !== null && card.suit === trump.trumpSuit) return 100 + card.rank;
  return card.rank;
}

const SUIT_ORDER: Suit[] = ['S', 'H', 'C', 'D'];

// 展示排序：主牌组最前，其余按固定花色顺序分组，组内 strength 递减
export function sortHand(cards: Card[], trump: TrumpContext): Card[] {
  const groupIndex = (card: Card): number => {
    const es = effectiveSuit(card, trump);
    return es === 'trump' ? 0 : SUIT_ORDER.indexOf(es) + 1;
  };
  return cards.slice().sort((a, b) => {
    const ga = groupIndex(a);
    const gb = groupIndex(b);
    if (ga !== gb) return ga - gb;
    const diff = cardStrength(b, trump) - cardStrength(a, trump);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id); // 稳定展示
  });
}
