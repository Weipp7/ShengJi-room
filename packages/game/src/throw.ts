import type { Card, Combo, ThrowEventView, TrumpContext } from '@shengji/shared';
import { teamOfSeat } from '@shengji/shared';
import { detectCombo, findPairs, findTractors } from './combo';
import { cardStrength, effectiveSuit } from './trump';

export type ThrowLeadEvaluation =
  | { type: 'not-throw'; code: 'cards-not-in-hand' | 'ordinary-combo' | 'invalid-throw' }
  | { type: 'success'; combo: Combo; event: ThrowEventView }
  | { type: 'failure'; combo: Combo; actualCards: Card[]; event: ThrowEventView };

export type ThrowStructureScore = {
  tractorCards: number;
  pairCards: number;
};

export type ThrowStructureMatch = {
  score: ThrowStructureScore;
  usedCards: Card[];
  tractors: Combo[];
  pairs: Combo[];
};

function cardsInHand(cards: Card[], hand: Card[]): boolean {
  const handIds = new Set(hand.map((card) => card.id));
  const seen = new Set<string>();
  for (const card of cards) {
    if (!handIds.has(card.id) || seen.has(card.id)) return false;
    seen.add(card.id);
  }
  return true;
}

function faceKey(card: Card): string {
  return card.kind === 'joker' ? `joker-${card.joker}` : `${card.suit}-${card.rank}`;
}

function componentTypeOrder(combo: Combo): number {
  if (combo.type === 'tractor') return 0;
  if (combo.type === 'pair') return 1;
  return 2;
}

function sortComponents(components: Combo[]): Combo[] {
  return [...components].sort((a, b) => {
    const byType = componentTypeOrder(a) - componentTypeOrder(b);
    if (byType !== 0) return byType;
    const byLength = b.cards.length - a.cards.length;
    if (byLength !== 0) return byLength;
    const byStrength = b.strength - a.strength;
    if (byStrength !== 0) return byStrength;
    return a.cards[0].id.localeCompare(b.cards[0].id);
  });
}

// 同一有效花色先取每段最长连续拖拉机，再把余牌拆成对子和单张。
export function decomposeThrowCards(cards: Card[], trump: TrumpContext): Combo[] | null {
  if (cards.length === 0) return null;
  const suit = effectiveSuit(cards[0], trump);
  if (!cards.every((card) => effectiveSuit(card, trump) === suit)) return null;

  const pairs = findPairs(cards, trump).sort((a, b) => {
    const byStrength = cardStrength(a[0], trump) - cardStrength(b[0], trump);
    return byStrength !== 0 ? byStrength : a[0].id.localeCompare(b[0].id);
  });
  const pairedIds = new Set(pairs.flat().map((card) => card.id));
  const pairComponents: Combo[] = [];
  let run: Card[][] = [];

  const flushRun = (): void => {
    if (run.length === 0) return;
    pairComponents.push(detectCombo(run.flat(), trump)!);
    run = [];
  };

  for (const pair of pairs) {
    if (run.length === 0) {
      run = [pair];
      continue;
    }
    const extended = detectCombo([...run.flat(), ...pair], trump);
    if (extended?.type === 'tractor') run.push(pair);
    else {
      flushRun();
      run = [pair];
    }
  }
  flushRun();

  const singles = cards
    .filter((card) => !pairedIds.has(card.id))
    .map((card) => detectCombo([card], trump)!);
  return sortComponents([...pairComponents, ...singles]);
}

function strongestComponentStrength(components: Combo[]): number {
  const tractors = components.filter((component) => component.type === 'tractor');
  if (tractors.length > 0) return Math.max(...tractors.map((component) => component.strength));
  const pairs = components.filter((component) => component.type === 'pair');
  if (pairs.length > 0) return Math.max(...pairs.map((component) => component.strength));
  return Math.max(...components.map((component) => component.strength));
}

function makeThrowCombo(cards: Card[], components: Combo[], trump: TrumpContext): Combo {
  return {
    type: 'throw',
    cards,
    suit: effectiveSuit(cards[0], trump),
    strength: strongestComponentStrength(components),
    components: sortComponents(components),
  };
}

function componentCanBeBeaten(component: Combo, hand: Card[], trump: TrumpContext): boolean {
  const sameSuit = hand.filter((card) => effectiveSuit(card, trump) === component.suit);
  if (component.type === 'single') {
    return sameSuit.some((card) => cardStrength(card, trump) > component.strength);
  }
  if (component.type === 'pair') {
    return findPairs(sameSuit, trump).some(
      (pair) => cardStrength(pair[0], trump) > component.strength,
    );
  }
  if (component.type === 'tractor') {
    return findTractors(sameSuit, trump, component.cards.length / 2).some(
      (tractor) => detectCombo(tractor, trump)!.strength > component.strength,
    );
  }
  return false;
}

function failedComponentOrder(a: Combo, b: Combo): number {
  const byPenalty = b.cards.length - a.cards.length;
  if (byPenalty !== 0) return byPenalty;
  const byStrength = a.strength - b.strength;
  if (byStrength !== 0) return byStrength;
  return a.cards[0].id.localeCompare(b.cards[0].id);
}

function challengedComponent(args: {
  seat: number;
  components: Combo[];
  hands: Card[][];
  trump: TrumpContext;
}): Combo | null {
  const failed = args.components.filter((component) => {
    for (let offset = 1; offset <= 3; offset++) {
      const otherSeat = (args.seat + offset) % 4;
      if (componentCanBeBeaten(component, args.hands[otherSeat] ?? [], args.trump)) return true;
    }
    return false;
  });
  return failed.sort(failedComponentOrder)[0] ?? null;
}

function eventId(seat: number, cards: Card[], success: boolean): string {
  return `throw-${seat}-${success ? 'success' : 'failure'}-${cards.map((card) => card.id).join('.')}`;
}

function scoreCompare(a: ThrowStructureScore, b: ThrowStructureScore): number {
  if (a.tractorCards !== b.tractorCards) return a.tractorCards - b.tractorCards;
  return a.pairCards - b.pairCards;
}

function groupCost(cards: Card[], cardCost: ((card: Card) => number) | undefined): number {
  return cardCost ? cards.reduce((sum, card) => sum + cardCost(card), 0) : 0;
}

// 计算一组牌对领出甩牌结构能做到的最佳匹配：先完整拖拉机，再尽量跟对子。
export function bestThrowStructureMatch(
  cards: Card[],
  leadComponents: Combo[],
  trump: TrumpContext,
  cardCost?: (card: Card) => number,
): ThrowStructureMatch {
  const tractorLengths = leadComponents
    .filter((component) => component.type === 'tractor')
    .map((component) => component.cards.length / 2)
    .sort((a, b) => b - a);
  const requiredPairUnits = leadComponents.reduce(
    (sum, component) =>
      sum + (component.type === 'tractor' ? component.cards.length / 2 : component.type === 'pair' ? 1 : 0),
    0,
  );
  const pairGroups = findPairs(cards, trump);
  const pairIndex = new Map(pairGroups.map((pair, index) => [faceKey(pair[0]), index]));
  const tractorOptions = tractorLengths.map((length) =>
    findTractors(cards, trump, length).map((tractorCards) => ({
      combo: detectCombo(tractorCards, trump)!,
      mask: tractorCards.reduce(
        (mask, card) => mask | (1 << (pairIndex.get(faceKey(card)) ?? 0)),
        0,
      ),
    })),
  );

  let best: ThrowStructureMatch = {
    score: { tractorCards: 0, pairCards: 0 },
    usedCards: [],
    tractors: [],
    pairs: [],
  };
  let bestCost = Number.POSITIVE_INFINITY;
  let bestStrength = Number.NEGATIVE_INFINITY;

  const visit = (requirementIndex: number, usedMask: number, tractors: Combo[]): void => {
    if (requirementIndex < tractorLengths.length) {
      // 当前拖拉机结构无法完整满足时允许跳过，再以对子数量补足。
      visit(requirementIndex + 1, usedMask, tractors);
      for (const option of tractorOptions[requirementIndex]) {
        if ((option.mask & usedMask) !== 0) continue;
        visit(requirementIndex + 1, usedMask | option.mask, [...tractors, option.combo]);
      }
      return;
    }

    const tractorPairUnits = tractors.reduce((sum, combo) => sum + combo.cards.length / 2, 0);
    const availablePairs = pairGroups
      .map((pair, index) => ({ pair, index }))
      .filter(({ index }) => (usedMask & (1 << index)) === 0)
      .sort((a, b) => {
        if (cardCost) return groupCost(a.pair, cardCost) - groupCost(b.pair, cardCost);
        return cardStrength(b.pair[0], trump) - cardStrength(a.pair[0], trump);
      });
    const extraPairCount = Math.min(
      Math.max(0, requiredPairUnits - tractorPairUnits),
      availablePairs.length,
    );
    const chosenPairs = availablePairs
      .slice(0, extraPairCount)
      .map(({ pair }) => detectCombo(pair, trump)!);
    const usedCards = [...tractors.flatMap((combo) => combo.cards), ...chosenPairs.flatMap((combo) => combo.cards)];
    const score = {
      tractorCards: tractors.reduce((sum, combo) => sum + combo.cards.length, 0),
      pairCards: (tractorPairUnits + chosenPairs.length) * 2,
    };
    const cost = groupCost(usedCards, cardCost);
    const strength =
      tractors.length > 0
        ? Math.max(...tractors.map((combo) => combo.strength))
        : chosenPairs.length > 0
          ? Math.max(...chosenPairs.map((combo) => combo.strength))
          : Number.NEGATIVE_INFINITY;
    const byScore = scoreCompare(score, best.score);
    if (
      byScore > 0 ||
      (byScore === 0 && cardCost !== undefined && cost < bestCost) ||
      (byScore === 0 && cardCost === undefined && strength > bestStrength)
    ) {
      best = { score, usedCards, tractors, pairs: chosenPairs };
      bestCost = cost;
      bestStrength = strength;
    }
  };

  visit(0, 0, []);
  return best;
}

export function throwStructureScore(
  cards: Card[],
  leadComponents: Combo[],
  trump: TrumpContext,
): ThrowStructureScore {
  return bestThrowStructureMatch(cards, leadComponents, trump).score;
}

// 所选牌完整匹配领出甩牌的全部组件时，构造可参与本墩比较的甩牌组合。
export function matchThrowCombo(cards: Card[], lead: Combo, trump: TrumpContext): Combo | null {
  const leadComponents = lead.components ?? [];
  if (lead.type !== 'throw' || leadComponents.length === 0 || cards.length !== lead.cards.length) return null;
  if (cards.length === 0) return null;
  const suit = effectiveSuit(cards[0], trump);
  if (!cards.every((card) => effectiveSuit(card, trump) === suit)) return null;

  const requiredTractorCards = leadComponents
    .filter((component) => component.type === 'tractor')
    .reduce((sum, component) => sum + component.cards.length, 0);
  const requiredPairCards = leadComponents.reduce(
    (sum, component) =>
      sum + (component.type === 'tractor' || component.type === 'pair' ? component.cards.length : 0),
    0,
  );
  const requiredSingles = leadComponents.filter((component) => component.type === 'single').length;
  const matched = bestThrowStructureMatch(cards, leadComponents, trump);
  if (
    matched.score.tractorCards !== requiredTractorCards ||
    matched.score.pairCards !== requiredPairCards
  ) {
    return null;
  }

  const usedIds = new Set(matched.usedCards.map((card) => card.id));
  const singles = cards
    .filter((card) => !usedIds.has(card.id))
    .map((card) => detectCombo([card], trump)!);
  if (singles.length !== requiredSingles) return null;
  return makeThrowCombo(cards, [...matched.tractors, ...matched.pairs, ...singles], trump);
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
  if (args.cards.length < 2) return { type: 'not-throw', code: 'invalid-throw' };

  const components = decomposeThrowCards(args.cards, args.trump);
  if (components === null || components.length < 2) return { type: 'not-throw', code: 'invalid-throw' };
  const challenged = challengedComponent({
    seat: args.seat,
    components,
    hands: args.hands,
    trump: args.trump,
  });

  if (challenged !== null) {
    const beneficiaryTeam = (1 - teamOfSeat(args.seat)) as 0 | 1;
    return {
      type: 'failure',
      combo: challenged,
      actualCards: challenged.cards,
      event: {
        id: eventId(args.seat, args.cards, false),
        seat: args.seat,
        attemptedCards: args.cards,
        actualCards: challenged.cards,
        challengedCards: challenged.cards,
        components,
        success: false,
        n: components.length,
        penaltyPoints: 20 * challenged.cards.length,
        beneficiaryTeam,
        reason: 'beatable-component',
      },
    };
  }

  const combo = makeThrowCombo(args.cards, components, args.trump);
  return {
    type: 'success',
    combo,
    event: {
      id: eventId(args.seat, args.cards, true),
      seat: args.seat,
      attemptedCards: args.cards,
      actualCards: args.cards,
      challengedCards: [],
      components,
      success: true,
      n: components.length,
      penaltyPoints: 0,
      beneficiaryTeam: null,
      reason: null,
    },
  };
}
