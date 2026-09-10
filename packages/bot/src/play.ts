import type { Card, Combo, EffectiveSuit, Rank, TrumpContext } from '@shengji/shared';
import { HAND_SIZE, KITTY_SIZE, teamOfSeat } from '@shengji/shared';
import {
  buildDeck,
  cardPoints,
  cardStrength,
  decomposeThrowCards,
  detectCombo,
  effectiveSuit,
  findPairs,
  findTractors,
  matchThrowCombo,
  selectThrowFollowCards,
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
  /** 已完成的公开牌墩；不包含 currentTrick。 */
  trickHistory?: TrickPlay[][];
  /** 四家当前剩余张数，只用于概率分配，不包含任何隐藏牌面。 */
  handCounts?: number[];
  /** 用于启用机器人对家信号；真人对家永不发送或解释暗号。 */
  botSeats?: boolean[];
  dealerSeat?: number;
  defenderPoints?: number;
  /** 只有最后一位埋底者本人知道底牌时才提供。 */
  knownKitty?: Card[];
};

export type PlayReason =
  | 'lead-safe-throw'
  | 'lead-probable-throw'
  | 'lead-singleton-ace'
  | 'lead-establish-king'
  | 'lead-to-signaled-ace'
  | 'lead-transfer-trump'
  | 'lead-tractor'
  | 'lead-strong-pair'
  | 'lead-cheapest-single'
  | 'lead-preserve-shape-single'
  | 'follow-forced-suit'
  | 'win-points-minimal'
  | 'trump-points-minimal'
  | 'trump-points-secure'
  | 'preserve-control'
  | 'support-teammate'
  | 'signal-second-ace'
  | 'signal-suit-control'
  | 'take-transfer-lead'
  | 'unblock-teammate-throw'
  | 'avoid-points'
  | 'follow-throw'
  | 'follow-tractor'
  | 'fallback';

export type PlayPlan = {
  cardIds: string[];
  reason: PlayReason;
};

type CardMemory = {
  playedCards: Card[];
  unknownCards: Card[];
  voidSuits: Array<Set<EffectiveSuit>>;
  handCounts: number[];
  unknownKittyCount: number;
};

type ThrowCandidate = {
  cards: Card[];
  probability: number;
  score: number;
};

const FULL_DECK = buildDeck();
const SIGNAL_RANKS: Rank[] = [9, 8, 7, 6];

// 垫牌避分：分牌重罚，其次留强度高的牌。
const avoidScore = (card: Card, trump: TrumpContext): number =>
  cardPoints(card) * 40 + cardStrength(card, trump);

// 送分：分牌优先（负分奖励），同分留强牌。
const dumpScore = (card: Card, trump: TrumpContext): number =>
  -cardPoints(card) * 40 + cardStrength(card, trump);

const faceKey = (card: Card): string =>
  card.kind === 'joker' ? `j-${card.joker}` : `${card.suit}-${card.rank}`;

function signalRank(level: Rank): Rank {
  return SIGNAL_RANKS.find((rank) => rank !== level)!;
}

function faceCounts(cards: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(faceKey(card), (counts.get(faceKey(card)) ?? 0) + 1);
  return counts;
}

function cardsStrength(cards: Card[], trump: TrumpContext): number {
  return Math.max(...cards.map((card) => cardStrength(card, trump)));
}

function groupPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

function plan(cards: readonly Card[], reason: PlayReason): PlayPlan {
  return { cardIds: cards.map((card) => card.id), reason };
}

function sortByStrength(groups: Card[][], trump: TrumpContext): Card[][] {
  return [...groups].sort((a, b) => {
    const diff = cardsStrength(a, trump) - cardsStrength(b, trump);
    return diff !== 0
      ? diff
      : a.map((card) => card.id).join('|').localeCompare(b.map((card) => card.id).join('|'));
  });
}

function groupScore(
  cards: Card[],
  trump: TrumpContext,
  score: (card: Card, trump: TrumpContext) => number,
): number {
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

function groupByEffectiveSuit(hand: Card[], trump: TrumpContext): Map<EffectiveSuit, Card[]> {
  const groups = new Map<EffectiveSuit, Card[]>();
  for (const card of hand) {
    const suit = effectiveSuit(card, trump);
    const group = groups.get(suit) ?? [];
    group.push(card);
    groups.set(suit, group);
  }
  return groups;
}

function historyPlays(view: BotPlayView): TrickPlay[] {
  return [...(view.trickHistory ?? []).flat(), ...view.currentTrick];
}

function inferHandCounts(view: BotPlayView, plays: TrickPlay[]): number[] {
  if (view.handCounts?.length === 4) return [...view.handCounts];
  const counts = [HAND_SIZE, HAND_SIZE, HAND_SIZE, HAND_SIZE];
  for (const play of plays) counts[play.seat] -= play.cards.length;
  counts[view.seat] = view.hand.length;
  return counts;
}

function buildMemory(view: BotPlayView): CardMemory {
  const allPlays = historyPlays(view);
  const playedCards = allPlays.flatMap((play) => play.cards);
  const knownKitty = view.knownKitty ?? [];
  const knownIds = new Set([...view.hand, ...playedCards, ...knownKitty].map((card) => card.id));
  const unknownCards = FULL_DECK.filter((card) => !knownIds.has(card.id));
  const voidSuits = Array.from({ length: 4 }, () => new Set<EffectiveSuit>());

  for (const trick of [...(view.trickHistory ?? []), view.currentTrick]) {
    const lead = trick[0]?.combo;
    if (lead === null || lead === undefined) continue;
    for (const follow of trick.slice(1)) {
      const followed = follow.cards.filter(
        (card) => effectiveSuit(card, view.trump) === lead.suit,
      ).length;
      if (followed < lead.cards.length) voidSuits[follow.seat].add(lead.suit);
    }
  }

  return {
    playedCards,
    unknownCards,
    voidSuits,
    handCounts: inferHandCounts(view, allPlays),
    unknownKittyCount: view.knownKitty === undefined ? KITTY_SIZE : 0,
  };
}

// 超几何分布：从 total 个未知位置抽 draws 个，完全抽不到 successes 的概率。
function probabilityNoSuccess(total: number, successes: number, draws: number): number {
  if (successes <= 0 || draws <= 0) return 1;
  if (total <= 0 || draws > total || total - successes < draws) return 0;
  let probability = 1;
  for (let i = 0; i < draws; i++) probability *= (total - successes - i) / (total - i);
  return Math.max(0, Math.min(1, probability));
}

// 指定的 distinctCards 张未知牌全部落到一个 draws 张区域中的概率。
function probabilityAllInZone(total: number, draws: number, distinctCards: number): number {
  if (distinctCards <= 0) return 1;
  if (draws < distinctCards || total < distinctCards) return 0;
  let probability = 1;
  for (let i = 0; i < distinctCards; i++) probability *= (draws - i) / (total - i);
  return Math.max(0, Math.min(1, probability));
}

function eligiblePool(
  view: BotPlayView,
  memory: CardMemory,
  suit: EffectiveSuit,
): { total: number; seats: number[] } {
  const seats = [0, 1, 2, 3].filter(
    (seat) => seat !== view.seat && !memory.voidSuits[seat].has(suit),
  );
  return {
    total: memory.unknownKittyCount + seats.reduce((sum, seat) => sum + memory.handCounts[seat], 0),
    seats,
  };
}

function unseenSuitCount(memory: CardMemory, suit: EffectiveSuit, trump: TrumpContext): number {
  return memory.unknownCards.filter((card) => effectiveSuit(card, trump) === suit).length;
}

function playerSuitProbability(
  view: BotPlayView,
  memory: CardMemory,
  seat: number,
  suit: EffectiveSuit,
): number {
  if (seat === view.seat) {
    return view.hand.some((card) => effectiveSuit(card, view.trump) === suit) ? 1 : 0;
  }
  if (memory.voidSuits[seat].has(suit)) return 0;
  const pool = eligiblePool(view, memory, suit);
  if (!pool.seats.includes(seat)) return 0;
  const unseen = unseenSuitCount(memory, suit, view.trump);
  return 1 - probabilityNoSuccess(pool.total, unseen, memory.handCounts[seat]);
}

function expectedSuitCount(
  view: BotPlayView,
  memory: CardMemory,
  seat: number,
  suit: EffectiveSuit,
): number {
  if (seat === view.seat) {
    return view.hand.filter((card) => effectiveSuit(card, view.trump) === suit).length;
  }
  if (memory.voidSuits[seat].has(suit)) return 0;
  const pool = eligiblePool(view, memory, suit);
  if (pool.total <= 0 || !pool.seats.includes(seat)) return 0;
  return unseenSuitCount(memory, suit, view.trump) * memory.handCounts[seat] / pool.total;
}

function targetHigherSingleProbability(
  view: BotPlayView,
  memory: CardMemory,
  targetSeat: number,
  combo: Combo,
): number {
  if (memory.voidSuits[targetSeat].has(combo.suit)) return 0;
  const pool = eligiblePool(view, memory, combo.suit);
  const higher = memory.unknownCards.filter(
    (card) =>
      effectiveSuit(card, view.trump) === combo.suit &&
      cardStrength(card, view.trump) > combo.strength,
  ).length;
  return 1 - probabilityNoSuccess(pool.total, higher, memory.handCounts[targetSeat]);
}

function higherPairsFor(combo: Combo, trump: TrumpContext): Card[][] {
  const seen = new Set<string>();
  return findPairs(
    FULL_DECK.filter((card) => effectiveSuit(card, trump) === combo.suit),
    trump,
  ).filter((pair) => {
    const key = faceKey(pair[0]);
    if (seen.has(key)) return false;
    seen.add(key);
    return cardStrength(pair[0], trump) > combo.strength;
  });
}

function targetPairProbability(
  view: BotPlayView,
  memory: CardMemory,
  targetSeat: number,
  combo: Combo,
): number {
  if (memory.voidSuits[targetSeat].has(combo.suit)) return 0;
  const unknownCounts = faceCounts(memory.unknownCards);
  const pool = eligiblePool(view, memory, combo.suit);
  let none = 1;
  for (const pair of higherPairsFor(combo, view.trump)) {
    if ((unknownCounts.get(faceKey(pair[0])) ?? 0) < 2) continue;
    const p = probabilityAllInZone(pool.total, memory.handCounts[targetSeat], 2);
    none *= 1 - p;
  }
  return 1 - none;
}

function higherTractorsFor(combo: Combo, trump: TrumpContext): Card[][] {
  const suitCards = FULL_DECK.filter((card) => effectiveSuit(card, trump) === combo.suit);
  return findTractors(suitCards, trump, combo.cards.length / 2).filter(
    (cards) => cardsStrength(cards, trump) > combo.strength,
  );
}

function targetTractorProbability(
  view: BotPlayView,
  memory: CardMemory,
  targetSeat: number,
  combo: Combo,
): number {
  if (memory.voidSuits[targetSeat].has(combo.suit)) return 0;
  const unknownCounts = faceCounts(memory.unknownCards);
  const pool = eligiblePool(view, memory, combo.suit);
  let none = 1;
  for (const tractor of higherTractorsFor(combo, view.trump)) {
    const faces = [...new Set(tractor.map(faceKey))];
    if (faces.some((face) => (unknownCounts.get(face) ?? 0) < 2)) continue;
    const p = probabilityAllInZone(pool.total, memory.handCounts[targetSeat], tractor.length);
    none *= 1 - p;
  }
  return 1 - none;
}

function targetBeatProbability(
  view: BotPlayView,
  memory: CardMemory,
  targetSeat: number,
  combo: Combo,
): number {
  if (combo.type === 'single') return targetHigherSingleProbability(view, memory, targetSeat, combo);
  if (combo.type === 'pair') return targetPairProbability(view, memory, targetSeat, combo);
  if (combo.type === 'tractor') return targetTractorProbability(view, memory, targetSeat, combo);
  const components = combo.components ?? [];
  const strongestType = components.some((part) => part.type === 'tractor')
    ? 'tractor'
    : components.some((part) => part.type === 'pair')
      ? 'pair'
      : 'single';
  const strongest = components
    .filter((part) => part.type === strongestType)
    .sort((a, b) => b.strength - a.strength)[0];
  return strongest ? targetBeatProbability(view, memory, targetSeat, strongest) : 0;
}

function componentUnbeatenProbability(
  view: BotPlayView,
  memory: CardMemory,
  component: Combo,
): number {
  if (component.type === 'single') {
    const higher = memory.unknownCards.filter(
      (card) =>
        effectiveSuit(card, view.trump) === component.suit &&
        cardStrength(card, view.trump) > component.strength,
    ).length;
    if (higher === 0) return 1;
    const pool = eligiblePool(view, memory, component.suit);
    // 甩牌检查另外三家；只有未知底牌能藏住更大的单张。
    return probabilityAllInZone(pool.total, memory.unknownKittyCount, higher);
  }

  let none = 1;
  for (const seat of [0, 1, 2, 3]) {
    if (seat === view.seat) continue;
    none *= 1 - targetBeatProbability(view, memory, seat, component);
  }
  return Math.max(0, Math.min(1, none));
}

function shapeProtectedIds(hand: Card[], trump: TrumpContext): Set<string> {
  const protectedIds = new Set(findPairs(hand, trump).flat().map((card) => card.id));
  for (const cards of groupByEffectiveSuit(hand, trump).values()) {
    const pairCount = findPairs(cards, trump).length;
    for (let length = 2; length <= pairCount; length++) {
      for (const tractor of findTractors(cards, trump, length)) {
        for (const card of tractor) protectedIds.add(card.id);
      }
    }
  }
  return protectedIds;
}

function allOtherSeats(view: BotPlayView): number[] {
  return [0, 1, 2, 3].filter((seat) => seat !== view.seat);
}

function addThrowCandidate(
  candidates: Map<string, Card[]>,
  cards: Card[],
  trump: TrumpContext,
): void {
  if (cards.length < 2 || detectCombo(cards, trump) !== null) return;
  const components = decomposeThrowCards(cards, trump);
  if (components === null || components.length < 2) return;
  const ids = [...cards].map((card) => card.id).sort();
  const key = ids.join('|');
  if (!candidates.has(key)) candidates.set(key, cards);
}

function safePairThrow(
  view: BotPlayView,
  memory: CardMemory,
  groups: Map<EffectiveSuit, Card[]>,
): Card[] | null {
  const candidates: Card[][] = [];
  for (const cards of groups.values()) {
    const safePairs = findPairs(cards, view.trump).filter((pair) => {
      const combo = detectCombo(pair, view.trump)!;
      return componentUnbeatenProbability(view, memory, combo) >= 0.999999;
    });
    if (safePairs.length < 2) continue;
    const flattened = sortByStrength(safePairs, view.trump).flat();
    if (detectCombo(flattened, view.trump) === null) candidates.push(flattened);
  }
  return candidates.sort((a, b) =>
    b.length - a.length || cardsStrength(b, view.trump) - cardsStrength(a, view.trump)
  )[0] ?? null;
}

function bestThrowCandidate(
  view: BotPlayView,
  memory: CardMemory,
  groups: Map<EffectiveSuit, Card[]>,
): ThrowCandidate | null {
  const generated = new Map<string, Card[]>();
  const exactPairs = safePairThrow(view, memory, groups);
  if (exactPairs) addThrowCandidate(generated, exactPairs, view.trump);

  for (const cards of groups.values()) {
    // 一整门本来就是合法拖拉机时，不拆其中几段伪装成甩牌。
    if (detectCombo(cards, view.trump)?.type === 'tractor') continue;
    const byStrength = [...cards].sort(
      (a, b) => cardStrength(b, view.trump) - cardStrength(a, view.trump) || a.id.localeCompare(b.id),
    );
    for (let length = 2; length <= Math.min(10, byStrength.length); length++) {
      addThrowCandidate(generated, byStrength.slice(0, length), view.trump);
    }
    if (cards.length <= 12) addThrowCandidate(generated, cards, view.trump);

    const pairs = findPairs(cards, view.trump);
    const pairIds = new Set(pairs.flat().map((card) => card.id));
    const loose = byStrength.filter((card) => !pairIds.has(card.id)).slice(0, 3);
    for (const pair of pairs) {
      for (const single of loose) addThrowCandidate(generated, [...pair, single], view.trump);
    }
    for (let length = 2; length <= Math.min(3, pairs.length); length++) {
      for (const tractor of findTractors(cards, view.trump, length)) {
        for (const single of loose) addThrowCandidate(generated, [...tractor, single], view.trump);
      }
    }
  }

  const evaluated: ThrowCandidate[] = [];
  for (const cards of generated.values()) {
    const components = decomposeThrowCards(cards, view.trump)!;
    const probabilities = components.map((component) =>
      componentUnbeatenProbability(view, memory, component),
    );
    const probability = probabilities.reduce((product, value) => product * value, 1);
    const containsSingle = components.some((component) => component.type === 'single');
    const minimum = cards.length >= 6 ? 0.96 : containsSingle ? 0.97 : 0.9;
    if (probability < minimum) continue;
    const penaltyCards = Math.max(...components.map((component) => component.cards.length));
    const knownOpponentVoid = allOtherSeats(view).filter(
      (seat) =>
        teamOfSeat(seat) !== teamOfSeat(view.seat) &&
        memory.voidSuits[seat].has(components[0].suit),
    ).length;
    const score =
      probability * cards.length * 14 -
      (1 - probability) * 20 * penaltyCards -
      knownOpponentVoid * cards.length * 3 -
      groupPoints(cards) * 0.15;
    evaluated.push({ cards, probability, score });
  }

  return evaluated.sort((a, b) =>
    b.score - a.score || b.probability - a.probability || b.cards.length - a.cards.length
  )[0] ?? null;
}

function isSideAce(card: Card, trump: TrumpContext): boolean {
  return card.kind === 'suit' && card.rank === 14 && effectiveSuit(card, trump) !== 'trump';
}

function partnerSeat(seat: number): number {
  return (seat + 2) % 4;
}

function teammateIsBot(view: BotPlayView): boolean {
  return view.botSeats?.[partnerSeat(view.seat)] === true;
}

function firstLeadOfSuit(view: BotPlayView, suit: EffectiveSuit): boolean {
  return !(view.trickHistory ?? []).some((trick) => trick[0]?.combo?.suit === suit);
}

function signalCardOfSuit(
  cards: Card[],
  suit: EffectiveSuit,
  trump: TrumpContext,
): Card | undefined {
  const rank = signalRank(trump.level);
  return cards.find(
    (card) =>
      card.kind === 'suit' &&
      card.rank === rank &&
      effectiveSuit(card, trump) === suit,
  );
}

function nearDefenderThreshold(view: BotPlayView, availablePoints: number): boolean {
  if (view.dealerSeat === undefined || view.defenderPoints === undefined) return false;
  if (teamOfSeat(view.seat) === teamOfSeat(view.dealerSeat)) return false;
  const next = [40, 80, 120, 160, 200].find((value) => value > view.defenderPoints!);
  return next !== undefined && view.defenderPoints + availablePoints >= next;
}

function secondAceSignal(
  view: BotPlayView,
  teammateWinning: boolean,
  survivalProbability: number,
): Card | null {
  if (!teammateIsBot(view) || !teammateWinning || survivalProbability < 0.78) return null;
  const lead = view.leadCombo;
  const leadCard = lead?.cards[0];
  if (
    lead?.type !== 'single' ||
    leadCard === undefined ||
    !isSideAce(leadCard, view.trump) ||
    view.currentTrick[0]?.seat !== partnerSeat(view.seat) ||
    !firstLeadOfSuit(view, lead.suit)
  ) return null;
  const hasOtherAce = view.hand.some((card) => faceKey(card) === faceKey(leadCard));
  if (!hasOtherAce) return null;
  const signal = signalCardOfSuit(view.hand, lead.suit, view.trump);
  if (!signal) return null;
  const runnable = view.hand.filter(
    (card) => effectiveSuit(card, view.trump) === lead.suit && cardPoints(card) > 0,
  );
  if (nearDefenderThreshold(view, Math.max(0, ...runnable.map(cardPoints)))) return null;
  return signal;
}

function signaledAceSuits(view: BotPlayView): EffectiveSuit[] {
  if (!teammateIsBot(view)) return [];
  const suits: EffectiveSuit[] = [];
  const rank = signalRank(view.trump.level);
  for (const trick of view.trickHistory ?? []) {
    const lead = trick[0];
    const leadCard = lead?.cards[0];
    if (
      lead?.seat !== view.seat ||
      lead.combo?.type !== 'single' ||
      leadCard === undefined ||
      !isSideAce(leadCard, view.trump)
    ) continue;
    const teammatePlay = trick.find((play) => play.seat === partnerSeat(view.seat));
    const signaled = teammatePlay?.cards.some(
      (card) =>
        card.kind === 'suit' &&
        card.rank === rank &&
        effectiveSuit(card, view.trump) === lead.combo!.suit,
    );
    const playedAces = historyPlays(view).flatMap((play) => play.cards)
      .filter((card) => faceKey(card) === faceKey(leadCard)).length;
    if (signaled && playedAces === 1) suits.push(lead.combo.suit);
  }
  return suits;
}

function controlSignalSuits(view: BotPlayView): EffectiveSuit[] {
  if (!teammateIsBot(view)) return [];
  const rank = signalRank(view.trump.level);
  const requested: EffectiveSuit[] = [];
  for (const trick of view.trickHistory ?? []) {
    const lead = trick[0]?.combo;
    const senderIndex = trick.findIndex((play) => play.seat === partnerSeat(view.seat));
    const sender = senderIndex >= 0 ? trick[senderIndex] : undefined;
    if (lead?.cards.length !== 1 || sender?.cards.length !== 1) continue;
    if (senderIndex === 0 || trickWinner(trick.slice(0, senderIndex), view.trump) !== view.seat) continue;
    const card = sender.cards[0];
    if (card.kind !== 'suit' || card.rank !== rank) continue;
    const suit = effectiveSuit(card, view.trump);
    if (suit === 'trump' || suit === lead.suit) continue;
    const acesPlayed = historyPlays(view).flatMap((play) => play.cards).filter(
      (played) =>
        played.kind === 'suit' &&
        played.rank === 14 &&
        effectiveSuit(played, view.trump) === suit,
    ).length;
    if (acesPlayed < 2) requested.push(suit);
  }
  return requested;
}

function leadToSignaledAce(view: BotPlayView, memory: CardMemory): Card | null {
  for (const suit of [...signaledAceSuits(view), ...controlSignalSuits(view)]) {
    const cards = view.hand
      .filter((card) => effectiveSuit(card, view.trump) === suit && cardPoints(card) === 0)
      .sort((a, b) => cardStrength(a, view.trump) - cardStrength(b, view.trump));
    if (cards.length === 0) continue;
    const lastOpponent = (view.seat + 3) % 4;
    if (playerSuitProbability(view, memory, lastOpponent, suit) < 0.7) continue;
    return cards[0];
  }
  return null;
}

function establishKingLead(view: BotPlayView): Card | null {
  for (const [suit, cards] of groupByEffectiveSuit(view.hand, view.trump)) {
    if (suit === 'trump' || cards.length < 3) continue;
    const hasAce = cards.some((card) => isSideAce(card, view.trump));
    const hasKing = cards.some((card) => card.kind === 'suit' && card.rank === 13);
    if (hasAce || !hasKing) continue;
    const counts = faceCounts(cards);
    const probes = cards
      .filter(
        (card) =>
          card.kind === 'suit' &&
          card.rank < 10 &&
          cardPoints(card) === 0 &&
          (counts.get(faceKey(card)) ?? 0) === 1,
      )
      .sort((a, b) => cardStrength(a, view.trump) - cardStrength(b, view.trump));
    if (probes.length > 0) return probes[0];
  }
  return null;
}

function leadTransferTrump(view: BotPlayView, memory: CardMemory): Card | null {
  if (!teammateIsBot(view) || view.trump.trumpSuit === null || view.hand.length <= 5) return null;
  const groups = groupByEffectiveSuit(view.hand, view.trump);
  const sideControls = [...groups.entries()].some(([suit, cards]) =>
    suit !== 'trump' && (
      cards.some((card) => isSideAce(card, view.trump)) ||
      findPairs(cards, view.trump).some((pair) => cardStrength(pair[0], view.trump) >= 12)
    ),
  );
  if (sideControls) return null;
  const sidePoints = view.hand
    .filter((card) => effectiveSuit(card, view.trump) !== 'trump')
    .reduce((sum, card) => sum + cardPoints(card), 0);
  if (sidePoints < 10) return null;
  const trumpCards = groups.get('trump') ?? [];
  const protectedIds = shapeProtectedIds(trumpCards, view.trump);
  const signal = signalCardOfSuit(trumpCards, 'trump', view.trump);
  if (!signal || protectedIds.has(signal.id) || cardPoints(signal) > 0) return null;
  const signalCombo = detectCombo([signal], view.trump)!;
  if (targetHigherSingleProbability(view, memory, partnerSeat(view.seat), signalCombo) < 0.45) return null;
  return signal;
}

function isTransferLead(view: BotPlayView): boolean {
  if (!teammateIsBot(view) || view.leadCombo?.type !== 'single') return false;
  const lead = view.currentTrick[0];
  const card = lead?.cards[0];
  return (
    lead?.seat === partnerSeat(view.seat) &&
    card?.kind === 'suit' &&
    view.trump.trumpSuit !== null &&
    card.suit === view.trump.trumpSuit &&
    card.rank === signalRank(view.trump.level) &&
    effectiveSuit(card, view.trump) === 'trump'
  );
}

function decideLead(view: BotPlayView): PlayPlan {
  const memory = buildMemory(view);
  const groups = groupByEffectiveSuit(view.hand, view.trump);
  const counts = faceCounts(view.hand);

  const feedAce = leadToSignaledAce(view, memory);
  if (feedAce) return plan([feedAce], 'lead-to-signaled-ace');

  const throwCandidate = bestThrowCandidate(view, memory, groups);
  if (throwCandidate && throwCandidate.score >= 25) {
    return plan(
      throwCandidate.cards,
      throwCandidate.probability >= 0.999999 ? 'lead-safe-throw' : 'lead-probable-throw',
    );
  }

  const singletonAces = [...groups.entries()]
    .filter(([suit, cards]) => suit !== 'trump' && cards.length === 1 && isSideAce(cards[0], view.trump))
    .map(([, cards]) => cards[0]);
  if (singletonAces.length > 0) return plan([singletonAces[0]], 'lead-singleton-ace');

  const kingProbe = establishKingLead(view);
  if (kingProbe) return plan([kingProbe], 'lead-establish-king');

  const transfer = leadTransferTrump(view, memory);
  if (transfer) return plan([transfer], 'lead-transfer-trump');

  const protectedIds = shapeProtectedIds(view.hand, view.trump);
  const safeSingles = view.hand.filter(
    (card) =>
      effectiveSuit(card, view.trump) !== 'trump' &&
      cardPoints(card) === 0 &&
      (counts.get(faceKey(card)) ?? 0) < 2 &&
      !protectedIds.has(card.id),
  );
  if (safeSingles.length > 0) {
    const sorted = [...safeSingles].sort((a, b) => {
      const suitA = effectiveSuit(a, view.trump);
      const suitB = effectiveSuit(b, view.trump);
      const lengthA = groups.get(suitA)?.length ?? 0;
      const lengthB = groups.get(suitB)?.length ?? 0;
      return lengthA - lengthB || avoidScore(a, view.trump) - avoidScore(b, view.trump);
    });
    return plan([sorted[0]], 'lead-preserve-shape-single');
  }

  const tractors: Card[][] = [];
  for (const cards of groups.values()) {
    const pairCount = findPairs(cards, view.trump).length;
    for (let length = 2; length <= pairCount; length++) {
      tractors.push(...findTractors(cards, view.trump, length));
    }
  }
  if (tractors.length > 0) {
    const selected = tractors.sort((a, b) =>
      b.length - a.length || cardsStrength(b, view.trump) - cardsStrength(a, view.trump)
    )[0];
    return plan(selected, 'lead-tractor');
  }

  const strongPairs = [...groups.values()]
    .flatMap((cards) => findPairs(cards, view.trump))
    .filter((pair) => {
      const strength = cardStrength(pair[0], view.trump);
      return strength >= 13 || (effectiveSuit(pair[0], view.trump) === 'trump' && strength >= 114);
    })
    .sort((a, b) => cardsStrength(b, view.trump) - cardsStrength(a, view.trump));
  if (strongPairs.length > 0) return plan(strongPairs[0], 'lead-strong-pair');

  const sorted = [...view.hand].sort(
    (a, b) => avoidScore(a, view.trump) - avoidScore(b, view.trump),
  );
  return plan([sorted[0]], 'lead-cheapest-single');
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
  } else if (lead.type === 'throw') {
    const preferStrong = winning.suit === 'trump';
    const candidate = selectThrowFollowCards(
      trumpCards,
      lead,
      trump,
      preferStrong
        ? (card) => -cardStrength(card, trump) * 100 + cardPoints(card)
        : (card) => avoidScore(card, trump),
    );
    const combo = matchThrowCombo(candidate, lead, trump);
    if (combo !== null && (winning.suit !== 'trump' || combo.strength > winning.strength)) {
      groups = [candidate];
    }
  }
  return sortByStrength(groups, trump).filter((group) => {
    if (group.length !== lead.cards.length) return false;
    return winning.suit === 'trump' ? cardsStrength(group, trump) > winning.strength : true;
  });
}

function laterSeats(view: BotPlayView): number[] {
  const count = 3 - view.currentTrick.length;
  return Array.from({ length: Math.max(0, count) }, (_, index) => (view.seat + index + 1) % 4);
}

function comboForFollowCards(cards: Card[], lead: Combo, trump: TrumpContext): Combo | null {
  return lead.type === 'throw' ? matchThrowCombo(cards, lead, trump) : detectCombo(cards, trump);
}

function targetTrumpStructureProbability(
  view: BotPlayView,
  memory: CardMemory,
  targetSeat: number,
  lead: Combo,
): number {
  if (memory.voidSuits[targetSeat].has('trump')) return 0;
  if (lead.type === 'single') return playerSuitProbability(view, memory, targetSeat, 'trump');
  const dummy: Combo = { ...lead, suit: 'trump', strength: Number.NEGATIVE_INFINITY };
  if (lead.type === 'pair') return targetPairProbability(view, memory, targetSeat, dummy);
  if (lead.type === 'tractor') return targetTractorProbability(view, memory, targetSeat, dummy);
  const components = lead.components ?? [];
  return components.reduce((probability, component) => {
    const part = { ...component, suit: 'trump' as const, strength: Number.NEGATIVE_INFINITY };
    return probability * targetBeatProbability(view, memory, targetSeat, part);
  }, 1);
}

function survivalAfterPlay(
  view: BotPlayView,
  memory: CardMemory,
  combo: Combo,
): number {
  let survival = 1;
  for (const seat of laterSeats(view)) {
    if (teamOfSeat(seat) === teamOfSeat(view.seat)) continue;
    if (combo.suit === 'trump' && view.leadCombo?.suit !== 'trump') {
      const hasLeadSuit = playerSuitProbability(view, memory, seat, view.leadCombo!.suit);
      survival *= 1 - (1 - hasLeadSuit) * targetBeatProbability(view, memory, seat, combo);
    } else if (combo.suit !== 'trump' && view.leadCombo?.suit !== 'trump') {
      const hasLeadSuit = playerSuitProbability(view, memory, seat, view.leadCombo!.suit);
      const higherInSuit = targetBeatProbability(view, memory, seat, combo);
      const canTrump = targetTrumpStructureProbability(view, memory, seat, view.leadCombo!);
      survival *= 1 - higherInSuit - (1 - hasLeadSuit) * canTrump;
    } else {
      survival *= 1 - targetBeatProbability(view, memory, seat, combo);
    }
  }
  return Math.max(0, Math.min(1, survival));
}

function currentWinnerSurvival(
  view: BotPlayView,
  memory: CardMemory,
  winning: Combo,
): number {
  return survivalAfterPlay(view, memory, winning);
}

function partnerLongSuit(
  view: BotPlayView,
  memory: CardMemory,
): { suit: EffectiveSuit; expected: number } | null {
  const partner = partnerSeat(view.seat);
  const suits: EffectiveSuit[] = ['S', 'H', 'C', 'D'];
  const candidates = suits
    .filter((suit) => suit !== view.trump.trumpSuit)
    .map((suit) => {
      const leadEvidence = (view.trickHistory ?? []).filter(
        (trick) => trick[0]?.seat === partner && trick[0]?.combo?.suit === suit,
      ).length;
      return { suit, expected: expectedSuitCount(view, memory, partner, suit) + leadEvidence * 0.35 };
    })
    .sort((a, b) => b.expected - a.expected);
  const strongest = candidates[0];
  const runnerUp = candidates[1];
  return strongest?.expected >= 3.5 &&
    (runnerUp === undefined || strongest.expected - runnerUp.expected >= 0.7)
    ? strongest
    : null;
}

function contextualCardCosts(
  view: BotPlayView,
  memory: CardMemory,
  teammateWinning: boolean,
  teammateSurvival: number,
): (card: Card, trump: TrumpContext) => number {
  const protectedIds = shapeProtectedIds(view.hand, view.trump);
  const longSuit = teammateWinning && teammateSurvival >= 0.82
    ? partnerLongSuit(view, memory)
    : null;
  return (card, trump) => {
    const supporting = teammateWinning && teammateSurvival >= 0.68;
    let cost = supporting ? dumpScore(card, trump) : avoidScore(card, trump);
    if (protectedIds.has(card.id)) cost += 28;
    if (isSideAce(card, trump)) cost += 14;
    if (longSuit && effectiveSuit(card, trump) === longSuit.suit) {
      // 对家很可能准备甩这一门时，主动卸掉可能卡住其甩牌的大牌。
      const looseBonus = protectedIds.has(card.id) ? 0.8 : 2.2;
      cost -= cardStrength(card, trump) * looseBonus * Math.min(2, longSuit.expected - 2.5);
    }
    return cost;
  };
}

function controlSuitSignal(
  view: BotPlayView,
  teammateWinning: boolean,
  survivalProbability: number,
): Card | null {
  if (!teammateIsBot(view) || !teammateWinning || survivalProbability < 0.84) return null;
  if (view.leadCombo?.cards.length !== 1) return null;
  if (view.hand.some(
    (card) =>
      effectiveSuit(card, view.trump) !== view.leadCombo!.suit &&
      cardPoints(card) > 0,
  )) return null;
  for (const [suit, cards] of groupByEffectiveSuit(view.hand, view.trump)) {
    if (suit === 'trump' || suit === view.leadCombo.suit) continue;
    if (!cards.some((card) => isSideAce(card, view.trump))) continue;
    const signal = signalCardOfSuit(cards, suit, view.trump);
    if (signal && cardPoints(signal) === 0) return signal;
  }
  return null;
}

function bestTrumpingPlay(
  view: BotPlayView,
  memory: CardMemory,
  lead: Combo,
  winning: Combo,
  restCards: Card[],
): { cards: Card[]; reason: PlayReason } | null {
  const candidates = trumpingGroups(lead, winning, restCards, view.trump);
  if (candidates.length === 0) return null;
  const protectedIds = shapeProtectedIds(view.hand, view.trump);
  const evaluated = candidates.map((cards) => {
    const combo = comboForFollowCards(cards, lead, view.trump)!;
    const survival = survivalAfterPlay(view, memory, combo);
    const ownPoints = groupPoints(cards);
    const controlCost = cards.reduce(
      (sum, card) => sum + cardStrength(card, view.trump) * 0.03 + (protectedIds.has(card.id) ? 5 : 0),
      0,
    );
    const value =
      survival * (view.trickPointsSoFar + ownPoints + 5) -
      (1 - survival) * (view.trickPointsSoFar + ownPoints + 12) -
      controlCost +
      (survival >= 0.82 ? ownPoints * 1.5 : 0);
    return { cards, survival, ownPoints, value };
  }).sort((a, b) =>
    b.value - a.value || cardsStrength(a.cards, view.trump) - cardsStrength(b.cards, view.trump)
  );

  const selected = evaluated[0];
  if (selected.value <= 0 && view.trickPointsSoFar === 0) return null;
  return {
    cards: selected.cards,
    reason: selected.ownPoints > 0 && selected.survival >= 0.82
      ? 'trump-points-secure'
      : 'trump-points-minimal',
  };
}

function takeTransferLead(
  view: BotPlayView,
  memory: CardMemory,
  winning: Combo,
  suitCards: Card[],
): Card[] | null {
  if (!isTransferLead(view) || view.leadCombo?.type !== 'single') return null;
  const candidates = suitCards
    .filter((card) => cardStrength(card, view.trump) > winning.strength)
    .sort((a, b) => cardStrength(a, view.trump) - cardStrength(b, view.trump));
  for (const card of candidates) {
    const combo = detectCombo([card], view.trump)!;
    if (survivalAfterPlay(view, memory, combo) >= 0.68) return [card];
  }
  return null;
}

function decideFollow(view: BotPlayView): PlayPlan {
  const memory = buildMemory(view);
  const lead = view.leadCombo!;
  const count = lead.cards.length;
  const suitCards = view.hand.filter((card) => effectiveSuit(card, view.trump) === lead.suit);
  const winnerSeat = trickWinner(view.currentTrick, view.trump);
  const winning = view.currentTrick.find((play) => play.seat === winnerSeat)!.combo!;
  const teammateWinning = teamOfSeat(winnerSeat) === teamOfSeat(view.seat);
  const teammateSurvival = teammateWinning ? currentWinnerSurvival(view, memory, winning) : 0;
  const orderScore = contextualCardCosts(view, memory, teammateWinning, teammateSurvival);
  const sortByOrder = (cards: Card[]): Card[] =>
    [...cards].sort(
      (a, b) => orderScore(a, view.trump) - orderScore(b, view.trump) || a.id.localeCompare(b.id),
    );

  const aceSignal = secondAceSignal(view, teammateWinning, teammateSurvival);
  if (aceSignal && validateFollow(lead, [aceSignal], view.hand, view.trump).ok) {
    return plan([aceSignal], 'signal-second-ace');
  }

  const transfer = takeTransferLead(view, memory, winning, suitCards);
  if (transfer) return plan(transfer, 'take-transfer-lead');

  let playCards: Card[];
  let reason: PlayReason = teammateWinning ? 'support-teammate' : 'avoid-points';
  if (suitCards.length <= count) {
    const suitIds = new Set(suitCards.map((card) => card.id));
    const restCards = view.hand.filter((card) => !suitIds.has(card.id));
    const trumpPlan = suitCards.length === 0 && !teammateWinning
      ? bestTrumpingPlay(view, memory, lead, winning, restCards)
      : null;
    if (trumpPlan) {
      playCards = trumpPlan.cards;
      reason = trumpPlan.reason;
    } else {
      const signal = suitCards.length === 0
        ? controlSuitSignal(view, teammateWinning, teammateSurvival)
        : null;
      if (signal && count === 1) {
        playCards = [signal];
        reason = 'signal-suit-control';
      } else {
        const rest = sortByOrder(restCards);
        playCards = [...suitCards, ...rest.slice(0, count - suitCards.length)];
        const longSuit = partnerLongSuit(view, memory);
        const unblocked = playCards.some(
          (card) =>
            longSuit !== null &&
            effectiveSuit(card, view.trump) === longSuit.suit &&
            cardStrength(card, view.trump) >= 12,
        );
        reason = suitCards.length > 0
          ? 'follow-forced-suit'
          : unblocked && teammateWinning
            ? 'unblock-teammate-throw'
            : teammateWinning
              ? 'support-teammate'
              : 'avoid-points';
      }
    }
  } else if (lead.type === 'single') {
    const byStrength = [...suitCards].sort(
      (a, b) => cardStrength(a, view.trump) - cardStrength(b, view.trump),
    );
    const smallestWinner = byStrength.find(
      (card) => cardStrength(card, view.trump) > winning.strength,
    );
    const canBeat = winning.suit === lead.suit && smallestWinner !== undefined;
    if (!teammateWinning && view.trickPointsSoFar > 0 && canBeat) {
      playCards = [smallestWinner];
      reason = 'win-points-minimal';
    } else {
      playCards = [sortByOrder(suitCards)[0]];
      reason = teammateWinning ? 'support-teammate' : 'preserve-control';
    }
  } else if (lead.type === 'pair') {
    const pairs = findPairs(suitCards, view.trump);
    if (pairs.length > 0) {
      const winningPairs = sortByStrength(pairs, view.trump).filter(
        (pair) => winning.suit === lead.suit && cardStrength(pair[0], view.trump) > winning.strength,
      );
      if (!teammateWinning && view.trickPointsSoFar > 0 && winningPairs.length > 0) {
        playCards = winningPairs[0];
        reason = 'win-points-minimal';
      } else {
        playCards = sortByGroupScore(pairs, view.trump, orderScore)[0];
        reason = teammateWinning ? 'support-teammate' : 'preserve-control';
      }
    } else {
      playCards = sortByOrder(suitCards).slice(0, 2);
      reason = 'follow-forced-suit';
    }
  } else if (lead.type === 'throw') {
    playCards = selectThrowFollowCards(
      view.hand,
      lead,
      view.trump,
      (card) => orderScore(card, view.trump),
    );
    reason = 'follow-throw';
  } else {
    const pairLength = count / 2;
    const tractors = findTractors(suitCards, view.trump, pairLength);
    if (tractors.length > 0) {
      const winningTractors = sortByStrength(tractors, view.trump).filter(
        (tractor) =>
          winning.suit === lead.suit && cardsStrength(tractor, view.trump) > winning.strength,
      );
      if (!teammateWinning && view.trickPointsSoFar > 0 && winningTractors.length > 0) {
        playCards = winningTractors[0];
        reason = 'win-points-minimal';
      } else {
        playCards = sortByGroupScore(tractors, view.trump, orderScore)[0];
        reason = teammateWinning ? 'support-teammate' : 'preserve-control';
      }
    } else {
      const pairs = findPairs(suitCards, view.trump);
      const need = Math.min(pairs.length, pairLength);
      const used = new Set<string>();
      playCards = [];
      for (const pair of sortByGroupScore(pairs, view.trump, orderScore).slice(0, need)) {
        playCards.push(...pair);
        for (const card of pair) used.add(card.id);
      }
      const rest = sortByOrder(suitCards.filter((card) => !used.has(card.id)));
      playCards.push(...rest.slice(0, count - playCards.length));
      reason = 'follow-tractor';
    }
  }

  const check = validateFollow(lead, playCards, view.hand, view.trump);
  if (check.ok) return plan(playCards, reason);
  // 理论不可达的兜底：花色牌优先 + 垫牌补齐。
  const suitIds = new Set(suitCards.map((card) => card.id));
  const fallback = [
    ...sortByOrder(suitCards),
    ...sortByOrder(view.hand.filter((card) => !suitIds.has(card.id))),
  ].slice(0, count);
  return plan(fallback, 'fallback');
}

export function decidePlay(view: BotPlayView): string[] {
  return explainPlay(view).cardIds;
}

export function explainPlay(view: BotPlayView): PlayPlan {
  return view.leadCombo === null ? decideLead(view) : decideFollow(view);
}
