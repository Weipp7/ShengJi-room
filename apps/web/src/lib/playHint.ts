import type { Combo, RoomStateView, TrickPlayView, TrumpContext } from '@shengji/shared';
import { countPoints, detectCombo, matchThrowCombo, type TrickPlay } from '@shengji/game';
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

const REASON_MESSAGES: Record<PlayReason, string> = {
  'lead-safe-throw': '你这组甩牌风险很低，可以主动甩出建立优势。',
  'lead-probable-throw': '记牌显示这组甩牌成功率较高，可以考虑主动甩出。',
  'lead-singleton-ace': '先兑现单张 A，拿回出牌权并立即形成断门。',
  'lead-establish-king': '先用这门小牌试探并调出 A，为 K 和分牌建立机会。',
  'lead-to-signaled-ace': '对家此前表示持有另一张 A，可以用小牌把出牌权送过去。',
  'lead-transfer-trump': '副牌控制已经不多，可以用信号主牌请对家接手发牌。',
  'lead-tractor': '你有可控拖拉机，可以主动领出建立节奏。',
  'lead-strong-pair': '你有强对子，可以先领出争取主动。',
  'lead-cheapest-single': '先出低价值散牌，保留更有用的牌。',
  'lead-preserve-shape-single': '先出安全散牌，保留对子或拖拉机。',
  'follow-forced-suit': '必须跟当前花色，优先保留更有价值的牌。',
  'win-points-minimal': '敌方当前领先且桌上有分，建议用最小可赢牌争抢。',
  'trump-points-minimal': '你已断门且桌上有分，建议用最小完整主牌型杀牌。',
  'trump-points-secure': '后手仍需跟副牌或盖杀风险很低，可以用分主安全杀牌。',
  'preserve-control': '这墩分牌收益不高，建议保留控制牌。',
  'support-teammate': '队友当前领先，建议送分或保留高牌。',
  'signal-second-ace': '对家是机器人，用约定信号表示你持有另一张 A。',
  'signal-suit-control': '对家是机器人，用约定信号请求它随后领出这门。',
  'take-transfer-lead': '对家请求交出牌权，建议用最小且较安全的牌接手。',
  'unblock-teammate-throw': '对家很可能在整理这一门，先垫掉可能卡住其甩牌的大牌。',
  'avoid-points': '无法跟牌时先垫低风险牌，尽量少送分。',
  'follow-throw': '对方甩牌时先匹配拖拉机和对子结构，并尽量保留高牌。',
  'follow-tractor': '没有完整拖拉机时，先满足对子数量并保留控制牌。',
  fallback: '当前牌型较复杂，建议选择一组合法牌。',
};

function successfulThrowCombo(play: TrickPlayView): Combo | null {
  if (!play.throwEvent?.success) return null;
  const components = play.throwEvent.components;
  const strongestType = components.some((component) => component.type === 'tractor')
    ? 'tractor'
    : components.some((component) => component.type === 'pair')
      ? 'pair'
      : 'single';
  return {
    type: 'throw',
    cards: play.cards,
    suit: components[0].suit,
    strength: Math.max(
      ...components
        .filter((component) => component.type === strongestType)
        .map((component) => component.strength),
    ),
    components,
  };
}

function buildTrickPlays(view: RoomStateView, trump: TrumpContext): TrickPlay[] | null {
  const first = view.currentTrick[0];
  const leadCombo = first ? successfulThrowCombo(first) ?? detectCombo(first.cards, trump) : null;
  if (first && leadCombo === null) return null;
  const plays: TrickPlay[] = [];
  for (const [idx, play] of view.currentTrick.entries()) {
    const combo =
      idx === 0
        ? leadCombo
        : leadCombo?.type === 'throw'
          ? matchThrowCombo(play.cards, leadCombo, trump)
          : detectCombo(play.cards, trump);
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
