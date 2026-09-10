import type { Bid, BiddingStage, Card, Rank, RoundResultView, ThrowEventView, TrumpContext } from '@shengji/shared';
import { HAND_SIZE, KITTY_SIZE, SEAT_COUNT, teamOfSeat } from '@shengji/shared';
import { bidBeats, detectBid, isPairBid, trumpSuitOfBid } from './bidding';
import { buildDeck, deal, shuffle, type Rng } from './deck';
import { validateFollow, validateLead } from './follow';
import { countPoints } from './points';
import { kittyMultiplierCards, settleRound } from './scoring';
import { evaluateThrowLead } from './throw';
import { trickWinner, type TrickPlay } from './trick';

export type RoundPhase = 'bidding' | 'burying' | 'playing' | 'scoring';

export const PRE_KITTY_BID_WINDOW_MS = 5_000;

export type RoundState = {
  phase: RoundPhase;
  level: Rank;
  teamLevels: [Rank, Rank];
  dealerSeat: number; // 首局抢庄时随最后亮主者改变；后续局始终保持计划庄家
  plannedDealerSeat: number; // 无人亮主时的兜底庄家
  trump: TrumpContext;
  hands: Card[][];
  kitty: Card[];
  currentBid: Bid | null;
  bidHistory: Bid[];
  biddingStage: BiddingStage;
  biddingTurn: number | null;
  bidWindowEndsAt: number | null;
  bidWindowDurationMs: number;
  passStreak: number;
  isFirstRound: boolean;
  redealCount: number;
  chaodiEnabled: boolean;
  dealtCount: number;
  postBuryBidQueue: number[];
  buryingSeat: number | null;
  lastBuryingSeat: number | null;
  turnSeat: number;
  currentTrick: TrickPlay[];
  lastTrick: TrickPlay[];
  trickHistory: TrickPlay[][];
  lastTrickWinnerSeat: number | null;
  throwEvents: ThrowEventView[];
  throwPenaltyPoints: [number, number];
  defenderTrickPoints: number;
  tricksPlayed: number;
  result: RoundResultView | null;
};

export type RoundError = { code: string; message: string };
export type StepResult = { ok: true; state: RoundState } | { ok: false; error: RoundError };
export type CloseBidWindowResult =
  | { ok: true; action: 'redeal' }
  | { ok: true; action: 'take-kitty'; state: RoundState }
  | { ok: false; error: RoundError };

const fail = (code: string, message: string): StepResult => ({ ok: false, error: { code, message } });

export function createRound(opts: {
  plannedDealerSeat: number;
  teamLevels: [Rank, Rank];
  rng: Rng;
  isFirstRound?: boolean;
  progressiveDeal?: boolean;
  chaodiEnabled?: boolean;
  redealCount?: number;
  now?: number;
  bidWindowDurationMs?: number;
}): RoundState {
  const level = opts.teamLevels[teamOfSeat(opts.plannedDealerSeat)];
  const { hands, kitty } = deal(shuffle(buildDeck(), opts.rng));
  const progressiveDeal = opts.progressiveDeal ?? false;
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
    biddingStage: progressiveDeal ? 'dealing' : 'pre-dealer',
    biddingTurn: null,
    bidWindowEndsAt:
      progressiveDeal
        ? null
        : (opts.now ?? Date.now()) + (opts.bidWindowDurationMs ?? PRE_KITTY_BID_WINDOW_MS),
    bidWindowDurationMs: opts.bidWindowDurationMs ?? PRE_KITTY_BID_WINDOW_MS,
    passStreak: 0,
    isFirstRound: opts.isFirstRound ?? true,
    redealCount: opts.redealCount ?? 0,
    chaodiEnabled: opts.chaodiEnabled ?? false,
    dealtCount: progressiveDeal ? 0 : HAND_SIZE,
    postBuryBidQueue: [],
    buryingSeat: null,
    lastBuryingSeat: null,
    turnSeat: opts.plannedDealerSeat,
    currentTrick: [],
    lastTrick: [],
    trickHistory: [],
    lastTrickWinnerSeat: null,
    throwEvents: [],
    throwPenaltyPoints: [0, 0],
    defenderTrickPoints: 0,
    tricksPlayed: 0,
    result: null,
  };
}

// 服务端每次推进一轮发牌（四家各摸一张）。摸满后开启全员共享的 5 秒亮主窗口。
export function advanceDeal(s: RoundState, now: number = Date.now()): RoundState {
  if (s.phase !== 'bidding' || s.biddingStage !== 'dealing') return s;
  if (s.dealtCount < HAND_SIZE) return { ...s, dealtCount: s.dealtCount + 1 };
  return {
    ...s,
    biddingStage: 'pre-dealer',
    biddingTurn: null,
    bidWindowEndsAt: now + s.bidWindowDurationMs,
    passStreak: 0,
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

function visibleBidHand(s: RoundState, seat: number): Card[] {
  return s.biddingStage === 'dealing' ? s.hands[seat].slice(0, s.dealtCount) : s.hands[seat];
}

// 摸底前叫主结束：首局由最后亮主者成为庄家；后续局庄家保持预定结果。
function takeKitty(s: RoundState): RoundState {
  const dealerSeat = s.isFirstRound && s.currentBid !== null ? s.currentBid.seat : s.plannedDealerSeat;
  const trumpSuit = s.currentBid !== null ? trumpSuitOfBid(s.currentBid) : null;
  const hands = s.hands.map((h, seat) => (seat === dealerSeat ? [...h, ...s.kitty] : h));
  return {
    ...s,
    phase: 'burying',
    dealerSeat,
    trump: { ...s.trump, trumpSuit },
    hands,
    kitty: [],
    biddingStage: null,
    biddingTurn: null,
    bidWindowEndsAt: null,
    postBuryBidQueue: [],
    buryingSeat: dealerSeat,
    turnSeat: dealerSeat,
  };
}

function revealBeforeKitty(
  s: RoundState,
  seat: number,
  cardIds: string[],
  now: number,
): StepResult {
  if (s.biddingStage !== 'dealing' && s.biddingStage !== 'pre-dealer') {
    return fail('wrong-phase', `cannot reveal during ${String(s.biddingStage)}`);
  }
  if (s.biddingStage === 'pre-dealer' && s.currentBid?.seat === seat) {
    return fail('current-bidder-locked', 'current bidder must wait for another player to counter');
  }
  if (
    s.biddingStage === 'pre-dealer' &&
    s.bidWindowEndsAt !== null &&
    now >= s.bidWindowEndsAt
  ) {
    return fail('bid-window-closed', 'pre-kitty bid window has closed');
  }
  const cards = resolveCards(visibleBidHand(s, seat), cardIds);
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
      dealerSeat: s.isFirstRound ? seat : s.dealerSeat,
      trump: { ...s.trump, trumpSuit: trumpSuitOfBid(bid) },
      passStreak: 0,
      biddingTurn: null,
      bidWindowEndsAt:
        s.biddingStage === 'pre-dealer' ? now + s.bidWindowDurationMs : s.bidWindowEndsAt,
    },
  };
}

function seatsAfter(seat: number, excluded: Set<number>): number[] {
  const seats: number[] = [];
  for (let offset = 1; offset <= SEAT_COUNT; offset++) {
    const candidate = (seat + offset) % SEAT_COUNT;
    if (!excluded.has(candidate)) seats.push(candidate);
  }
  return seats;
}

function startPlaying(s: RoundState): RoundState {
  return {
    ...s,
    phase: 'playing',
    biddingStage: null,
    biddingTurn: null,
    bidWindowEndsAt: null,
    postBuryBidQueue: [],
    buryingSeat: null,
    turnSeat: s.dealerSeat,
  };
}

function revealPostBury(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (s.biddingStage !== 'post-bury') return fail('wrong-phase', 'post-bury counter window is closed');
  if (seat !== s.biddingTurn) return fail('wrong-turn', `not seat ${seat}'s bidding turn`);
  const cards = resolveCards(s.hands[seat], cardIds);
  if (cards === null) return fail('cards-not-in-hand', 'reveal cards must come from hand');
  const bid = detectBid(cards, s.level, seat);
  if (bid === null) return fail('invalid-bid', 'cards do not form a valid bid');
  if (!isPairBid(bid)) return fail('invalid-bid', 'counter bid must be a pair');
  if (!bidBeats(bid, s.currentBid)) return fail('invalid-bid', 'bid does not beat current bid');
  // 新亮主者暂时失去继续反主的资格；其余三家（包括庄家和前亮主者）恢复资格。
  const postBuryBidQueue = seatsAfter(seat, new Set([seat]));
  const hands = s.hands.map((hand, handSeat) =>
    handSeat === seat ? [...hand, ...s.kitty] : hand,
  );
  return {
    ok: true,
    state: {
      ...s,
      phase: 'burying',
      hands,
      kitty: [],
      currentBid: bid,
      bidHistory: [...s.bidHistory, bid],
      trump: { ...s.trump, trumpSuit: trumpSuitOfBid(bid) },
      passStreak: 0,
      postBuryBidQueue,
      biddingStage: null,
      biddingTurn: null,
      bidWindowEndsAt: null,
      buryingSeat: seat,
    },
  };
}

export function applyReveal(
  s: RoundState,
  seat: number,
  cardIds: string[],
  now: number = Date.now(),
): StepResult {
  if (s.phase === 'bidding' && s.biddingStage === 'post-bury') return revealPostBury(s, seat, cardIds);
  if (s.phase === 'bidding') return revealBeforeKitty(s, seat, cardIds, now);
  return fail('wrong-phase', `cannot reveal in ${s.phase}`);
}

// 摸底前窗口由服务端统一计时关闭；首局无人亮主时由房间层废局重发。
export function closePreKittyBidWindow(s: RoundState): CloseBidWindowResult {
  if (s.phase !== 'bidding' || s.biddingStage !== 'pre-dealer') {
    return { ok: false, error: { code: 'wrong-phase', message: 'pre-kitty bid window is not open' } };
  }
  if (s.isFirstRound && s.currentBid === null) return { ok: true, action: 'redeal' };
  return { ok: true, action: 'take-kitty', state: takeKitty(s) };
}

export function applyPass(s: RoundState, seat: number): StepResult {
  if (s.phase !== 'bidding') return fail('wrong-phase', `cannot pass in ${s.phase}`);
  if (s.biddingStage === 'dealing') return fail('deal-in-progress', 'cannot pass while cards are being dealt');
  if (s.biddingStage !== 'post-bury') {
    return fail('pass-not-required', 'pre-kitty bidding uses a shared timed window');
  }
  if (seat !== s.biddingTurn) return fail('wrong-turn', `not seat ${seat}'s bidding turn`);

  const postBuryBidQueue = s.postBuryBidQueue.slice(1);
  if (postBuryBidQueue.length === 0) return { ok: true, state: startPlaying(s) };
  return {
    ok: true,
    state: { ...s, postBuryBidQueue, biddingTurn: postBuryBidQueue[0] },
  };
}

export function applyBury(s: RoundState, seat: number, cardIds: string[]): StepResult {
  if (s.phase !== 'burying') return fail('wrong-phase', `cannot bury in ${s.phase}`);
  if (seat !== s.buryingSeat) return fail('not-burying-player', 'only the current kitty holder can bury');
  if (cardIds.length !== KITTY_SIZE) return fail('bad-bury-count', `must bury ${KITTY_SIZE} cards`);
  const cards = resolveCards(s.hands[seat], cardIds);
  if (cards === null) return fail('cards-not-in-hand', 'bury cards must come from hand');
  const buried = new Set(cardIds);
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((card) => !buried.has(card.id)) : h));
  const isInitialBury = s.postBuryBidQueue.length === 0;
  const initiallyLocked = new Set<number>([s.dealerSeat]);
  if (s.currentBid !== null) initiallyLocked.add(s.currentBid.seat);
  const anchor = s.currentBid?.seat ?? s.dealerSeat;
  const postBuryBidQueue =
    !s.chaodiEnabled || s.currentBid === null
      ? []
      : isInitialBury
        ? seatsAfter(anchor, initiallyLocked)
        : s.postBuryBidQueue;
  return {
    ok: true,
    state: postBuryBidQueue.length === 0
      ? startPlaying({ ...s, hands, kitty: cards, lastBuryingSeat: seat })
      : {
          ...s,
          phase: 'bidding',
          hands,
          kitty: cards,
          lastBuryingSeat: seat,
          biddingStage: 'post-bury',
          biddingTurn: postBuryBidQueue[0],
          postBuryBidQueue,
          buryingSeat: null,
          passStreak: 0,
        },
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
    trickHistory: [...s.trickHistory, currentTrick],
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
    lastTrickCardsPerPlayer: kittyMultiplierCards(currentTrick[0].combo!),
    teamLevels: s.teamLevels,
    throwPenaltyPoints,
  });
  return { ok: true, state: { ...base, phase: 'scoring', result } };
}
