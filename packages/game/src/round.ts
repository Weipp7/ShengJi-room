import type { Bid, BiddingStage, Card, Rank, RoundResultView, ThrowEventView, TrumpContext } from '@shengji/shared';
import { KITTY_SIZE, SEAT_COUNT, teamOfSeat } from '@shengji/shared';
import { bidBeats, detectBid, trumpSuitOfBid } from './bidding';
import { buildDeck, deal, shuffle, type Rng } from './deck';
import { validateFollow, validateLead } from './follow';
import { countPoints } from './points';
import { settleRound } from './scoring';
import { evaluateThrowLead } from './throw';
import { trickWinner, type TrickPlay } from './trick';

export type RoundPhase = 'bidding' | 'burying' | 'playing' | 'scoring';

export type RoundState = {
  phase: RoundPhase;
  level: Rank;
  teamLevels: [Rank, Rank];
  dealerSeat: number; // bidding 期间为“计划庄家”，亮主可改变
  plannedDealerSeat: number; // 无人亮主时的兜底庄家
  trump: TrumpContext;
  hands: Card[][];
  kitty: Card[];
  currentBid: Bid | null;
  bidHistory: Bid[];
  biddingStage: BiddingStage;
  biddingTurn: number;
  passStreak: number;
  turnSeat: number;
  currentTrick: TrickPlay[];
  lastTrick: TrickPlay[];
  lastTrickWinnerSeat: number | null;
  throwEvents: ThrowEventView[];
  throwPenaltyPoints: [number, number];
  defenderTrickPoints: number;
  tricksPlayed: number;
  result: RoundResultView | null;
};

export type RoundError = { code: string; message: string };
export type StepResult = { ok: true; state: RoundState } | { ok: false; error: RoundError };

const fail = (code: string, message: string): StepResult => ({ ok: false, error: { code, message } });

export function createRound(opts: {
  plannedDealerSeat: number;
  teamLevels: [Rank, Rank];
  rng: Rng;
}): RoundState {
  const level = opts.teamLevels[teamOfSeat(opts.plannedDealerSeat)];
  const { hands, kitty } = deal(shuffle(buildDeck(), opts.rng));
  return {
    phase: 'bidding',
    level,
    teamLevels: opts.teamLevels,
    dealerSeat: opts.plannedDealerSeat,
    plannedDealerSeat: opts.plannedDealerSeat,
    trump: { trumpSuit: null, level },
    hands,
    kitty,
    currentBid: null,
    bidHistory: [],
    biddingStage: 'pre-dealer',
    biddingTurn: opts.plannedDealerSeat,
    passStreak: 0,
    turnSeat: opts.plannedDealerSeat,
    currentTrick: [],
    lastTrick: [],
    lastTrickWinnerSeat: null,
    throwEvents: [],
    throwPenaltyPoints: [0, 0],
    defenderTrickPoints: 0,
    tricksPlayed: 0,
    result: null,
  };
}

// 从座位手牌中按 id 取牌；缺失或重复返回 null
function resolveCards(hand: Card[], cardIds: string[]): Card[] | null {
  const byId = new Map(hand.map((card) => [card.id, card]));
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const id of cardIds) {
    const card = byId.get(id);
    if (!card || seen.has(id)) return null;
    seen.add(id);
    cards.push(card);
  }
  return cards;
}

// 结束叫主：底牌并入庄家手 → burying
function finishBidding(s: RoundState): RoundState {
  const dealerSeat = s.currentBid !== null ? s.currentBid.seat : s.plannedDealerSeat;
  const trumpSuit = s.currentBid !== null ? trumpSuitOfBid(s.currentBid) : null;
  const hands = s.hands.map((h, seat) => (seat === dealerSeat ? [...h, ...s.kitty] : h));
  return {
    ...s,
    phase: 'burying',
    dealerSeat,
    trump: { ...s.trump, trumpSuit },
    hands,
    kitty: [],
    biddingStage: 'post-dealer',
    turnSeat: dealerSeat,
  };
}

function revealBid(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (seat !== s.biddingTurn) return fail('wrong-turn', `not seat ${seat}'s bidding turn`);
  const cards = resolveCards(s.hands[seat], cardIds);
  if (cards === null) return fail('cards-not-in-hand', 'reveal cards must come from hand');
  const bid = detectBid(cards, s.level, seat);
  if (bid === null) return fail('invalid-bid', 'cards do not form a valid bid');
  if (!bidBeats(bid, s.currentBid)) return fail('invalid-bid', 'bid does not beat current bid');
  return {
    ok: true,
    state: {
      ...s,
      currentBid: bid,
      bidHistory: [...s.bidHistory, bid],
      dealerSeat: seat,
      trump: { ...s.trump, trumpSuit: trumpSuitOfBid(bid) },
      biddingStage: 'pre-dealer',
      passStreak: 0,
      biddingTurn: (seat + 1) % SEAT_COUNT,
    },
  };
}

function revealPostDealerBid(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (seat !== s.dealerSeat) return fail('not-dealer', 'only dealer can counter after taking kitty');
  const cards = resolveCards(s.hands[seat], cardIds);
  if (cards === null) return fail('cards-not-in-hand', 'reveal cards must come from hand');
  const bid = detectBid(cards, s.level, seat);
  if (bid === null) return fail('invalid-bid', 'cards do not form a valid bid');
  if (!bidBeats(bid, s.currentBid)) return fail('invalid-bid', 'bid does not beat current bid');
  return {
    ok: true,
    state: {
      ...s,
      currentBid: bid,
      bidHistory: [...s.bidHistory, bid],
      trump: { ...s.trump, trumpSuit: trumpSuitOfBid(bid) },
      biddingStage: 'post-dealer',
      turnSeat: seat,
    },
  };
}

export function applyReveal(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (s.phase === 'bidding') return revealBid(s, seat, cardIds);
  if (s.phase === 'burying' && s.biddingStage === 'post-dealer') {
    return revealPostDealerBid(s, seat, cardIds);
  }
  return fail('wrong-phase', `cannot reveal in ${s.phase}`);
}

export function applyPass(s: RoundState, seat: number): StepResult {
  if (s.phase !== 'bidding') return fail('wrong-phase', `cannot pass in ${s.phase}`);
  if (seat !== s.biddingTurn) return fail('wrong-turn', `not seat ${seat}'s bidding turn`);
  const passStreak = s.passStreak + 1;
  const next: RoundState = { ...s, passStreak, biddingStage: 'pre-dealer', biddingTurn: (seat + 1) % SEAT_COUNT };
  const done =
    (s.currentBid !== null && passStreak >= SEAT_COUNT - 1) ||
    (s.currentBid === null && passStreak >= SEAT_COUNT);
  return { ok: true, state: done ? finishBidding(next) : next };
}

export function applyBury(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (s.phase !== 'burying') return fail('wrong-phase', `cannot bury in ${s.phase}`);
  if (seat !== s.dealerSeat) return fail('not-dealer', 'only dealer can bury');
  if (cardIds.length !== KITTY_SIZE) return fail('bad-bury-count', `must bury ${KITTY_SIZE} cards`);
  const cards = resolveCards(s.hands[seat], cardIds);
  if (cards === null) return fail('cards-not-in-hand', 'bury cards must come from hand');
  const buried = new Set(cardIds);
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((card) => !buried.has(card.id)) : h));
  return {
    ok: true,
    state: { ...s, phase: 'playing', hands, kitty: cards, biddingStage: null, turnSeat: s.dealerSeat },
  };
}

export function applyPlay(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (s.phase !== 'playing') return fail('wrong-phase', `cannot play in ${s.phase}`);
  if (seat !== s.turnSeat) return fail('wrong-turn', `not seat ${seat}'s turn`);
  const hand = s.hands[seat];
  const selectedCards = resolveCards(hand, cardIds);
  if (selectedCards === null) return fail('cards-not-in-hand', 'played cards must come from hand');

  const leadCombo = s.currentTrick.length > 0 ? s.currentTrick[0].combo : null;
  let cards = selectedCards;
  let combo = null as TrickPlay['combo'];
  let throwEvent: ThrowEventView | undefined;
  let throwEvents = s.throwEvents;
  let throwPenaltyPoints = s.throwPenaltyPoints;

  if (leadCombo === null) {
    const check = validateLead(selectedCards, hand, s.trump);
    if (check.ok) {
      combo = check.combo;
    } else if (check.code === 'invalid-combo') {
      const evaluated = evaluateThrowLead({
        seat,
        cards: selectedCards,
        hand,
        hands: s.hands,
        trump: s.trump,
      });
      if (evaluated.type === 'not-throw') return fail(evaluated.code, 'illegal play');
      combo = evaluated.combo;
      throwEvent = evaluated.event;
      throwEvents = [...s.throwEvents, evaluated.event];
      if (evaluated.type === 'failure') {
        cards = evaluated.actualCards;
        throwPenaltyPoints = [...s.throwPenaltyPoints] as [number, number];
        throwPenaltyPoints[evaluated.event.beneficiaryTeam!] += evaluated.event.penaltyPoints;
      }
    } else {
      return fail(check.code, 'illegal play');
    }
  } else {
    const check = validateFollow(leadCombo, selectedCards, hand, s.trump);
    if (!check.ok) return fail(check.code, 'illegal play');
    combo = check.combo;
  }

  const playedIds = new Set(cards.map((card) => card.id));
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((card) => !playedIds.has(card.id)) : h));
  const currentTrick = [...s.currentTrick, { seat, cards, combo, ...(throwEvent ? { throwEvent } : {}) }];

  if (currentTrick.length < SEAT_COUNT) {
    return {
      ok: true,
      state: { ...s, hands, currentTrick, throwEvents, throwPenaltyPoints, turnSeat: (seat + 1) % SEAT_COUNT },
    };
  }

  // 第 4 家落牌，结算本墩
  const winner = trickWinner(currentTrick, s.trump);
  const dealerTeam = teamOfSeat(s.dealerSeat);
  const trickPoints = countPoints(currentTrick.flatMap((p) => p.cards));
  const defenderTrickPoints =
    teamOfSeat(winner) !== dealerTeam ? s.defenderTrickPoints + trickPoints : s.defenderTrickPoints;
  const tricksPlayed = s.tricksPlayed + 1;

  const base: RoundState = {
    ...s,
    hands,
    currentTrick: [],
    lastTrick: currentTrick,
    lastTrickWinnerSeat: winner,
    throwEvents,
    throwPenaltyPoints,
    defenderTrickPoints,
    tricksPlayed,
    turnSeat: winner,
  };
  // 手牌未打空则继续下一墩（对子/拖拉机会早于 25 墩打空）
  if (base.hands.some((h) => h.length > 0)) return { ok: true, state: base };

  // 最后一墩：结算全局
  const result = settleRound({
    dealerSeat: s.dealerSeat,
    defenderTrickPoints,
    kitty: s.kitty,
    lastTrickWinnerSeat: winner,
    lastTrickCardsPerPlayer: currentTrick[0].cards.length,
    teamLevels: s.teamLevels,
    throwPenaltyPoints,
  });
  return { ok: true, state: { ...base, phase: 'scoring', result } };
}
