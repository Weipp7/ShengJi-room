import type { Card, Combo, RoomStateView, TrickPlayView, TrumpContext } from '@shengji/shared';
import { countPoints, detectCombo, effectiveSuit, cardStrength, findPairs, type TrickPlay } from '@shengji/game';
import { explainPlay, type PlayReason } from '@shengji/bot';

export type PlayHint = {
  cardIds: string[];
  reasonCode: PlayReason;
  message: string;
};

function playCardsKey(play: TrickPlayView): string {
  const event = play.throwEvent;
  const eventKey =
    event === undefined
      ? 'no-throw'
      : [
          event.id,
          event.success ? 'success' : 'failure',
          event.n,
          event.penaltyPoints,
          event.actualCards.map((card) => card.id).join(','),
          event.challengedCards.map((card) => card.id).join(','),
        ].join(':');
  return `${play.seat}:${play.cards.map((card) => card.id).join(',')}:${eventKey}`;
}

export function playHintContextKey(view: RoomStateView): string {
  const trump = view.trump ? `${view.trump.trumpSuit ?? 'NT'}-${view.trump.level}` : 'no-trump';
  const trick = view.currentTrick.map(playCardsKey).join('|');
  return [
    view.phase,
    view.yourSeat ?? 'spectator',
    view.turnSeat ?? 'no-turn',
    trump,
    view.yourHand.map((card) => card.id).join(','),
    trick,
  ].join('::');
}

function pairGroupsForThrow(cards: TrickPlayView['cards'], trump: TrumpContext): { suit: Combo['suit']; pairs: Card[][] } | null {
  if (cards.length < 4 || cards.length % 2 !== 0) return null;
  const suit = effectiveSuit(cards[0], trump);
  if (!cards.every((card) => effectiveSuit(card, trump) === suit)) return null;
  if (detectCombo(cards, trump) !== null) return null;

  const pairs = findPairs(cards, trump);
  if (pairs.length < 2 || pairs.length * 2 !== cards.length) return null;
  const pairIds = new Set(pairs.flat().map((card) => card.id));
  if (pairIds.size !== cards.length) return null;
  return {
    suit,
    pairs: [...pairs].sort((a, b) => {
      const byStrength = cardStrength(a[0], trump) - cardStrength(b[0], trump);
      return byStrength !== 0 ? byStrength : a[0].id.localeCompare(b[0].id);
    }),
  };
}

const REASON_MESSAGES: Record<PlayReason, string> = {
  'lead-safe-throw-pairs': '你这组甩牌风险很低，可以主动甩出建立优势。',
  'lead-tractor': '你有可控拖拉机，可以主动领出建立节奏。',
  'lead-strong-pair': '你有强对子，可以先领出争取主动。',
  'lead-cheapest-single': '先出低价值散牌，保留更有用的牌。',
  'lead-preserve-shape-single': '先出安全散牌，保留对子或拖拉机。',
  'follow-forced-suit': '必须跟当前花色，优先保留更有价值的牌。',
  'win-points-minimal': '敌方当前领先且桌上有分，建议用最小可赢牌争抢。',
  'trump-points-minimal': '你已断门且桌上有分，建议用最小完整主牌型杀牌。',
  'preserve-control': '这墩分牌收益不高，建议保留控制牌。',
  'support-teammate': '队友当前领先，建议送分或保留高牌。',
  'avoid-points': '无法跟牌时先垫低风险牌，尽量少送分。',
  'follow-throw-pairs': '对方甩牌时先满足必须跟的对子，避免浪费高对。',
  'follow-tractor': '没有完整拖拉机时，先满足对子数量并保留控制牌。',
  fallback: '当前牌型较复杂，建议选择一组合法牌。',
};

function throwPairsCombo(play: TrickPlayView, trump: TrumpContext): Combo | null {
  if (!play.throwEvent?.success) return null;
  const grouped = pairGroupsForThrow(play.cards, trump);
  if (grouped === null) return null;
  const components = grouped.pairs.map((pair) => detectCombo(pair, trump)!);
  return {
    type: 'throw-pairs',
    cards: play.cards,
    suit: grouped.suit,
    strength: Math.max(...components.map((combo) => combo.strength)),
    components,
  };
}

function comboForPlay(play: TrickPlayView, trump: TrumpContext, isLead: boolean): Combo | null {
  if (isLead) return throwPairsCombo(play, trump) ?? detectCombo(play.cards, trump);
  return detectCombo(play.cards, trump);
}

function buildTrickPlays(view: RoomStateView, trump: TrumpContext): TrickPlay[] | null {
  const plays: TrickPlay[] = [];
  for (const [idx, play] of view.currentTrick.entries()) {
    const combo = comboForPlay(play, trump, idx === 0);
    if (idx === 0 && combo === null) return null;
    plays.push({ ...play, combo });
  }
  return plays;
}

export function createPlayHint(view: RoomStateView): PlayHint | null {
  if (view.phase !== 'playing') return null;
  if (view.yourSeat === null || view.turnSeat !== view.yourSeat) return null;
  if (view.trump === null) return null;

  const currentTrick = buildTrickPlays(view, view.trump);
  if (currentTrick === null) return null;
  const leadCombo = currentTrick.length > 0 ? currentTrick[0].combo : null;
  const plan = explainPlay({
    hand: view.yourHand,
    trump: view.trump,
    leadCombo,
    currentTrick,
    seat: view.yourSeat,
    trickPointsSoFar: countPoints(view.currentTrick.flatMap((play) => play.cards)),
  });

  if (plan.reason === 'fallback' || plan.cardIds.length === 0) return null;
  return {
    cardIds: plan.cardIds,
    reasonCode: plan.reason,
    message: REASON_MESSAGES[plan.reason],
  };
}
