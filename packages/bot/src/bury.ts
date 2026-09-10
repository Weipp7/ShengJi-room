import type { Bid, Card, Suit, TrumpContext } from '@shengji/shared';
import { KITTY_SIZE, teamOfSeat } from '@shengji/shared';
import {
  cardPoints,
  cardStrength,
  countPoints,
  effectiveSuit,
  findTractors,
  isTrump,
  pairBidStrength,
} from '@shengji/game';

export type DealerProfile = 'weak' | 'balanced' | 'strong';
export type BuryRole = 'dealer-side' | 'defender-side';

export type BotBuryView = {
  hand: Card[];
  trump: TrumpContext;
  seat: number;
  dealerSeat: number;
  currentBid: Bid | null;
  bidHistory?: Bid[];
  postBuryCountersAllowed?: boolean;
};

export type BuryCandidateView = {
  cardIds: string[];
  voidCardIds: string[] | null;
  voidSuits: Suit[];
  buriedPoints: number;
  brokenPairs: number;
  brokenTractors: number;
  cost: number;
  source: 'beam' | 'low-cost' | 'point-kitty' | 'void' | 'hybrid';
};

export type BuryPlan = {
  role: BuryRole;
  profile: DealerProfile;
  cardIds: string[];
  buriedPoints: number;
  keptTrumpCount: number;
  counterExposure: number;
  possibleTrumpSuits: Array<Suit | null>;
  candidates: BuryCandidateView[];
};

type NormalizedBuryView = BotBuryView & {
  bidHistory: Bid[];
  postBuryCountersAllowed: boolean;
};
type CandidateSource = BuryCandidateView['source'];
type Candidate = { cards: Card[]; source: CandidateSource };
type CandidateMetrics = Omit<BuryCandidateView, 'cardIds' | 'voidCardIds' | 'source'> & {
  voidCards: Card[] | null;
};

const SUITS: Suit[] = ['S', 'H', 'C', 'D'];
const BEAM_WIDTH = 320;
const EXPLAINED_CANDIDATES = 120;

const faceKey = (card: Card): string =>
  card.kind === 'joker' ? `j-${card.joker}` : `${card.suit}-${card.rank}`;

function faceCounts(hand: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of hand) counts.set(faceKey(card), (counts.get(faceKey(card)) ?? 0) + 1);
  return counts;
}

function buryRole(view: NormalizedBuryView): BuryRole {
  return teamOfSeat(view.seat) === teamOfSeat(view.dealerSeat)
    ? 'dealer-side'
    : 'defender-side';
}

function handProfile(hand: Card[], trump: TrumpContext): DealerProfile {
  const trumpCards = hand.filter((card) => isTrump(card, trump));
  const topTrumpControls = trumpCards.filter((card) => cardStrength(card, trump) >= 114).length;
  if (trumpCards.length >= 10 || topTrumpControls >= 4) return 'strong';
  if (trumpCards.length <= 7 && topTrumpControls === 0) return 'weak';
  return 'balanced';
}

// 当前亮主越弱，当前底牌被下一次反主者拿走的风险越高。
function counterExposureOf(bid: Bid | null): number {
  if (bid === null || bid.kind === 'suit-single') return 0.9;
  const strength = pairBidStrength(bid);
  return ({ 1: 0.72, 2: 0.58, 3: 0.44, 4: 0.3, 5: 0.14, 6: 0 } as Record<number, number>)[strength] ?? 0.9;
}

function possibleTrumpContexts(view: NormalizedBuryView): TrumpContext[] {
  const contexts: TrumpContext[] = [view.trump];
  const currentStrength =
    view.currentBid !== null && view.currentBid.kind !== 'suit-single'
      ? pairBidStrength(view.currentBid)
      : 0;
  const counterSuits: Array<{ strength: number; suit: Suit | null }> = [
    { strength: 1, suit: 'D' },
    { strength: 2, suit: 'C' },
    { strength: 3, suit: 'H' },
    { strength: 4, suit: 'S' },
    { strength: 5, suit: null },
    { strength: 6, suit: null },
  ];
  for (const candidate of counterSuits) {
    if (candidate.strength <= currentStrength) continue;
    if (!contexts.some((context) => context.trumpSuit === candidate.suit)) {
      contexts.push({ trumpSuit: candidate.suit, level: view.trump.level });
    }
  }
  return contexts;
}

function sideSuitGroups(hand: Card[], trump: TrumpContext): Map<Suit, Card[]> {
  const groups = new Map<Suit, Card[]>();
  for (const card of hand) {
    const suit = effectiveSuit(card, trump);
    if (suit === 'trump') continue;
    const group = groups.get(suit) ?? [];
    group.push(card);
    groups.set(suit, group);
  }
  return groups;
}

function tractorCardIds(hand: Card[], trump: TrumpContext): Set<string> {
  const ids = new Set<string>();
  const groups = new Map<string, Card[]>();
  for (const card of hand) {
    const suit = effectiveSuit(card, trump);
    const group = groups.get(suit) ?? [];
    group.push(card);
    groups.set(suit, group);
  }
  for (const group of groups.values()) {
    for (const tractor of findTractors(group, trump, 2)) {
      for (const card of tractor) ids.add(card.id);
    }
  }
  return ids;
}

function trumpDiscardCost(card: Card, trump: TrumpContext): number {
  if (card.kind === 'joker') return card.joker === 'big' ? 6200 : 5700;
  if (card.rank === trump.level) {
    return card.suit === trump.trumpSuit ? 5400 : 5000;
  }
  return 2500 + card.rank * 95;
}

function sideDiscardCost(card: Card): number {
  if (card.kind === 'joker') return 0;
  const highCardPremium = card.rank === 14 ? 500 : card.rank === 13 ? 360 : card.rank === 12 ? 220 : card.rank === 11 ? 140 : 0;
  return card.rank * 12 + highCardPremium;
}

function pointCoefficient(
  role: BuryRole,
  profile: DealerProfile,
  counterExposure: number,
): number {
  if (role === 'dealer-side') return 190;
  const finalKittyCoefficient = profile === 'strong' ? 205 : profile === 'balanced' ? 165 : 120;
  // 亮主较弱时，分底可能被下一位反主者接走，因此闲家降低埋分激进度。
  return -finalKittyCoefficient * (1 - counterExposure * 0.58);
}

function intrinsicDiscardCost(
  card: Card,
  trump: TrumpContext,
  role: BuryRole,
  profile: DealerProfile,
  counterExposure: number,
): number {
  const points = cardPoints(card);
  const base = isTrump(card, trump) ? trumpDiscardCost(card, trump) : sideDiscardCost(card);
  const pointCost = points * pointCoefficient(role, profile, counterExposure);
  const dealerPointCardPremium = role === 'dealer-side' && points > 0 ? 420 : 0;
  const defenderPointCardReward = role === 'defender-side' && points > 0 ? -160 : 0;
  return base + pointCost + dealerPointCardPremium + defenderPointCardReward;
}

function pairLossValue(card: Card, trump: TrumpContext, role: BuryRole): number {
  const strength = cardStrength(card, trump);
  const base = isTrump(card, trump) ? 1750 + Math.max(0, strength - 100) * 22 : 420 + strength * 24;
  return role === 'defender-side' ? base * 1.22 : base;
}

type ContextModel = {
  trump: TrumpContext;
  profile: DealerProfile;
  intrinsicById: Map<string, number>;
  pairGroups: Array<{ cardIds: string[]; lossCost: number }>;
  tractors: Array<{ cardIds: string[]; lossCost: number }>;
  sideGroups: Map<Suit, Card[]>;
  effectiveSuitById: Map<string, Suit | 'trump'>;
  totalTrumpCount: number;
};

function buildContextModel(
  view: NormalizedBuryView,
  trump: TrumpContext,
  role: BuryRole,
  counterExposure: number,
): ContextModel {
  const profile = handProfile(view.hand, trump);
  const intrinsicById = new Map(
    view.hand.map((card) => [
      card.id,
      intrinsicDiscardCost(card, trump, role, profile, counterExposure),
    ]),
  );
  const byFace = new Map<string, Card[]>();
  for (const card of view.hand) {
    const group = byFace.get(faceKey(card)) ?? [];
    group.push(card);
    byFace.set(faceKey(card), group);
  }
  const pairGroups = [...byFace.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({
      cardIds: group.map((card) => card.id),
      lossCost: pairLossValue(group[0], trump, role),
    }));

  const groups = new Map<string, Card[]>();
  for (const card of view.hand) {
    const suit = effectiveSuit(card, trump);
    const group = groups.get(suit) ?? [];
    group.push(card);
    groups.set(suit, group);
  }
  const seen = new Set<string>();
  const tractors: ContextModel['tractors'] = [];
  for (const group of groups.values()) {
    for (const tractor of findTractors(group, trump, 2)) {
      const key = tractor.map((card) => card.id).sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const isTrumpTractor = effectiveSuit(tractor[0], trump) === 'trump';
      tractors.push({
        cardIds: tractor.map((card) => card.id),
        lossCost: (role === 'defender-side' ? 2500 : 2100) + (isTrumpTractor ? 900 : 0),
      });
    }
  }

  const effectiveSuitById = new Map(
    view.hand.map((card) => [card.id, effectiveSuit(card, trump)]),
  );
  return {
    trump,
    profile,
    intrinsicById,
    pairGroups,
    tractors,
    sideGroups: sideSuitGroups(view.hand, trump),
    effectiveSuitById,
    totalTrumpCount: view.hand.filter((card) => isTrump(card, trump)).length,
  };
}

function structureMetrics(
  buried: Set<string>,
  model: ContextModel,
  role: BuryRole,
): { cost: number; brokenPairs: number; brokenTractors: number } {
  let cost = 0;
  let brokenPairs = 0;
  for (const group of model.pairGroups) {
    const kept = group.cardIds.filter((id) => !buried.has(id)).length;
    if (kept >= 2) continue;
    brokenPairs += 1;
    cost += group.lossCost;
    if (kept === 1) cost += role === 'defender-side' ? 520 : 420;
  }
  let brokenTractors = 0;
  for (const tractor of model.tractors) {
    if (!tractor.cardIds.some((id) => buried.has(id))) continue;
    brokenTractors += 1;
    cost += tractor.lossCost;
  }
  return { cost, brokenPairs, brokenTractors };
}

function shapeAdjustment(
  buried: Set<string>,
  model: ContextModel,
  role: BuryRole,
): { cost: number; voidSuits: Suit[]; voidCards: Card[] | null } {
  const buriedSuitCounts = new Map<Suit | 'trump', number>();
  for (const id of buried) {
    const suit = model.effectiveSuitById.get(id)!;
    buriedSuitCounts.set(suit, (buriedSuitCounts.get(suit) ?? 0) + 1);
  }
  const keptTrumpCount = model.totalTrumpCount - (buriedSuitCounts.get('trump') ?? 0);
  const voidSuits: Suit[] = [];
  let voidCards: Card[] | null = null;
  let cost = 0;
  for (const suit of SUITS) {
    const original = model.sideGroups.get(suit) ?? [];
    const remainingCount = original.length - (buriedSuitCounts.get(suit) ?? 0);
    if (original.length === 0 || remainingCount > 0) continue;
    voidSuits.push(suit);
    if (voidCards === null) voidCards = original;
    const profileBonus =
      model.profile === 'strong'
        ? role === 'defender-side'
          ? 1400
          : 1700
        : model.profile === 'balanced'
          ? role === 'defender-side'
            ? 720
            : 760
          : -500;
    const trumpFactor = keptTrumpCount >= 8 ? 1 : keptTrumpCount >= 5 ? 0.7 : 0.35;
    cost -= (profileBonus + original.length * 75) * trumpFactor;
  }

  const longestSideSuit = Math.max(
    0,
    ...[...model.sideGroups.entries()].map(
      ([suit, cards]) => cards.length - (buriedSuitCounts.get(suit) ?? 0),
    ),
  );
  cost -= Math.max(0, longestSideSuit - 5) * (role === 'defender-side' ? 105 : 85);
  return { cost, voidSuits, voidCards };
}

function evaluateInContext(
  cards: Card[],
  role: BuryRole,
  model: ContextModel,
): CandidateMetrics {
  const buried = new Set(cards.map((card) => card.id));
  const intrinsic = cards.reduce((sum, card) => sum + model.intrinsicById.get(card.id)!, 0);
  const structure = structureMetrics(buried, model, role);
  const shape = shapeAdjustment(buried, model, role);
  const buriedPoints = countPoints(cards);
  const unsafeDealerVoidPenalty =
    role === 'dealer-side' &&
    shape.voidSuits.length > 0 &&
    (buriedPoints > 0 ||
      structure.brokenPairs > 0 ||
      structure.brokenTractors > 0 ||
      cards.some((card) => model.effectiveSuitById.get(card.id) === 'trump'))
      ? 1100
      : 0;
  return {
    cost: intrinsic + structure.cost + shape.cost + unsafeDealerVoidPenalty,
    voidSuits: shape.voidSuits,
    voidCards: shape.voidCards,
    buriedPoints,
    brokenPairs: structure.brokenPairs,
    brokenTractors: structure.brokenTractors,
  };
}

function evaluateCandidate(
  cards: Card[],
  role: BuryRole,
  models: ContextModel[],
  counterExposure: number,
): CandidateMetrics {
  const current = evaluateInContext(cards, role, models[0]);
  const future = models.slice(1).map((model) => evaluateInContext(cards, role, model));
  if (future.length === 0 || counterExposure === 0) return current;
  const averageFuture = future.reduce((sum, metric) => sum + metric.cost, 0) / future.length;
  const worstFuture = Math.max(...future.map((metric) => metric.cost));
  const robustFuture = averageFuture * 0.35 + worstFuture * 0.65;
  // 后续可能改主，只影响“这副底若被接走后”的稳健性；不能因此轻率埋掉当前已经确定的主牌。
  const currentTrumpPenalty = cards.filter(
    (card) => models[0].effectiveSuitById.get(card.id) === 'trump',
  ).length * 2200;
  return {
    ...current,
    cost: current.cost * (1 - counterExposure) + robustFuture * counterExposure + currentTrumpPenalty,
  };
}

function candidateKey(cards: Card[]): string {
  return cards.map((card) => card.id).sort().join('|');
}

function addCandidate(target: Map<string, Candidate>, cards: Card[], source: CandidateSource): void {
  if (cards.length !== KITTY_SIZE) return;
  const unique = new Map(cards.map((card) => [card.id, card]));
  if (unique.size !== KITTY_SIZE) return;
  const normalized = [...unique.values()];
  const key = candidateKey(normalized);
  const existing = target.get(key);
  if (!existing || existing.source === 'beam') target.set(key, { cards: normalized, source });
}

function fillCandidate(seed: Card[], hand: Card[], rankedCards: Card[]): Card[] {
  const ids = new Set(seed.map((card) => card.id));
  const cards = seed.slice(0, KITTY_SIZE);
  for (const card of rankedCards) {
    if (cards.length >= KITTY_SIZE) break;
    if (ids.has(card.id)) continue;
    ids.add(card.id);
    cards.push(card);
  }
  return cards.filter((card) => hand.some((held) => held.id === card.id));
}

function generateCandidates(
  view: NormalizedBuryView,
  role: BuryRole,
  profile: DealerProfile,
  counterExposure: number,
): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();
  const hand = view.hand.slice().sort((a, b) => a.id.localeCompare(b.id));
  const counts = faceCounts(hand);
  const tractorIds = tractorCardIds(hand, view.trump);
  const approxCost = (card: Card): number => {
    let cost = intrinsicDiscardCost(card, view.trump, role, profile, counterExposure);
    if ((counts.get(faceKey(card)) ?? 0) >= 2) {
      cost += isTrump(card, view.trump) ? 900 : role === 'defender-side' ? 330 : 420;
    }
    if (tractorIds.has(card.id)) cost += role === 'defender-side' ? 900 : 720;
    return cost;
  };
  const rankedCards = hand.slice().sort((a, b) => {
    const difference = approxCost(a) - approxCost(b);
    return difference !== 0 ? difference : a.id.localeCompare(b.id);
  });

  addCandidate(candidates, rankedCards.slice(0, KITTY_SIZE), 'low-cost');

  if (role === 'defender-side') {
    const pointCards = hand
      .filter((card) => cardPoints(card) > 0)
      .sort((a, b) => cardPoints(b) - cardPoints(a) || approxCost(a) - approxCost(b));
    addCandidate(candidates, fillCandidate(pointCards.slice(0, KITTY_SIZE), hand, rankedCards), 'point-kitty');
  }

  const groups = [...sideSuitGroups(hand, view.trump).entries()]
    .filter(([, cards]) => cards.length <= KITTY_SIZE)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [, group] of groups) {
    addCandidate(candidates, fillCandidate(group, hand, rankedCards), 'void');
  }
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const seed = [...groups[i][1], ...groups[j][1]];
      if (seed.length <= KITTY_SIZE) {
        addCandidate(candidates, fillCandidate(seed, hand, rankedCards), 'void');
      }
    }
  }

  type BeamState = { indices: number[]; nextIndex: number; approximateCost: number };
  let beam: BeamState[] = [{ indices: [], nextIndex: 0, approximateCost: 0 }];
  for (let depth = 0; depth < KITTY_SIZE; depth++) {
    const expanded: BeamState[] = [];
    const cardsStillNeeded = KITTY_SIZE - depth;
    for (const state of beam) {
      const lastStart = hand.length - cardsStillNeeded;
      for (let index = state.nextIndex; index <= lastStart; index++) {
        expanded.push({
          indices: [...state.indices, index],
          nextIndex: index + 1,
          approximateCost: state.approximateCost + approxCost(hand[index]),
        });
      }
    }
    expanded.sort((a, b) => {
      const difference = a.approximateCost - b.approximateCost;
      if (difference !== 0) return difference;
      return a.indices.join(',').localeCompare(b.indices.join(','));
    });
    beam = expanded.slice(0, BEAM_WIDTH);
  }
  for (const state of beam) {
    addCandidate(candidates, state.indices.map((index) => hand[index]), 'beam');
  }
  return candidates;
}

function normalizeView(input: BotBuryView | Card[], trump?: TrumpContext): NormalizedBuryView {
  if (Array.isArray(input)) {
    if (trump === undefined) throw new Error('trump is required when passing a hand');
    return {
      hand: input,
      trump,
      seat: 0,
      dealerSeat: 0,
      currentBid: null,
      bidHistory: [],
      postBuryCountersAllowed: false,
    };
  }
  return {
    ...input,
    bidHistory: input.bidHistory ?? [],
    postBuryCountersAllowed: input.postBuryCountersAllowed ?? true,
  };
}

function rankCandidates(
  candidates: Map<string, Candidate>,
  evaluate: (cards: Card[]) => CandidateMetrics,
): Array<Candidate & { metrics: CandidateMetrics }> {
  return [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      metrics: evaluate(candidate.cards),
    }))
    .sort((a, b) => {
      const difference = a.metrics.cost - b.metrics.cost;
      return difference !== 0
        ? difference
        : candidateKey(a.cards).localeCompare(candidateKey(b.cards));
    });
}

export function explainBury(view: BotBuryView): BuryPlan;
export function explainBury(hand: Card[], trump: TrumpContext): BuryPlan;
export function explainBury(input: BotBuryView | Card[], trump?: TrumpContext): BuryPlan {
  const view = normalizeView(input, trump);
  if (view.hand.length < KITTY_SIZE) throw new Error(`burying requires at least ${KITTY_SIZE} cards`);
  const role = buryRole(view);
  const profile = handProfile(view.hand, view.trump);
  const counterExposure = view.postBuryCountersAllowed ? counterExposureOf(view.currentBid) : 0;
  const contexts = view.postBuryCountersAllowed ? possibleTrumpContexts(view) : [view.trump];
  const models = contexts.map((context) => buildContextModel(view, context, role, counterExposure));
  const evaluationCache = new Map<string, CandidateMetrics>();
  const evaluate = (cards: Card[]): CandidateMetrics => {
    const key = candidateKey(cards);
    const cached = evaluationCache.get(key);
    if (cached) return cached;
    const metrics = evaluateCandidate(cards, role, models, counterExposure);
    evaluationCache.set(key, metrics);
    return metrics;
  };
  const candidates = generateCandidates(view, role, profile, counterExposure);

  // 对初选候选做一轮一进一出的邻域搜索，让最终结果由完整25张牌形评分决定。
  const firstPass = rankCandidates(candidates, evaluate);
  for (const candidate of firstPass.slice(0, 8)) {
    const buried = new Set(candidate.cards.map((card) => card.id));
    const kept = view.hand.filter((card) => !buried.has(card.id));
    for (const outgoing of candidate.cards) {
      for (const incoming of kept) {
        addCandidate(
          candidates,
          candidate.cards.map((card) => (card.id === outgoing.id ? incoming : card)),
          'hybrid',
        );
      }
    }
  }

  const ranked = rankCandidates(candidates, evaluate);
  const best = ranked[0];
  const bestBuried = new Set(best.cards.map((card) => card.id));
  return {
    role,
    profile,
    cardIds: best.cards.map((card) => card.id),
    buriedPoints: countPoints(best.cards),
    keptTrumpCount: view.hand.filter(
      (card) => !bestBuried.has(card.id) && isTrump(card, view.trump),
    ).length,
    counterExposure,
    possibleTrumpSuits: contexts.map((context) => context.trumpSuit),
    candidates: ranked.slice(0, EXPLAINED_CANDIDATES).map((candidate) => ({
      cardIds: candidate.cards.map((card) => card.id),
      voidCardIds: candidate.metrics.voidCards?.map((card) => card.id) ?? null,
      voidSuits: candidate.metrics.voidSuits,
      buriedPoints: candidate.metrics.buriedPoints,
      brokenPairs: candidate.metrics.brokenPairs,
      brokenTractors: candidate.metrics.brokenTractors,
      cost: Math.round(candidate.metrics.cost),
      source: candidate.source,
    })),
  };
}

export function decideBury(view: BotBuryView): string[];
export function decideBury(hand: Card[], trump: TrumpContext): string[];
export function decideBury(input: BotBuryView | Card[], trump?: TrumpContext): string[] {
  return Array.isArray(input) ? explainBury(input, trump!).cardIds : explainBury(input).cardIds;
}
