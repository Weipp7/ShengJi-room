import type { Bid, Card, Combo, Rank, TrumpContext } from './cards';

export type Phase = 'waiting' | 'bidding' | 'burying' | 'playing' | 'scoring';
export type BiddingStage = 'dealing' | 'pre-dealer' | 'post-bury' | null;

export type SeatView = {
  seat: number;
  nickname: string | null;
  isBot: boolean;
  connected: boolean;
  isHost: boolean;
  handCount: number;
};

export type ThrowEventView = {
  id: string;
  seat: number;
  attemptedCards: Card[];
  actualCards: Card[];
  challengedCards: Card[];
  components: Combo[];
  success: boolean;
  n: number;
  penaltyPoints: number;
  beneficiaryTeam: 0 | 1 | null;
  reason: 'beatable-component' | null;
};

export type TrickPlayView = { seat: number; cards: Card[]; throwEvent?: ThrowEventView };

export type RoundResultView = {
  defenderPoints: number;
  baseDefenderPoints: number;
  throwPenaltyDelta: number;
  throwPenaltyPoints: [number, number];
  kittyCards: Card[];
  kittyBonus: number;
  winnerTeam: 0 | 1;
  levelDelta: number;
  nextDealerSeat: number;
  nextLevels: [Rank, Rank];
};

export type RoomStateView = {
  roomCode: string;
  chaodiEnabled: boolean;
  phase: Phase;
  seats: SeatView[];
  hostSeat: number | null;
  yourSeat: number | null;
  yourHand: Card[]; // 只含本人手牌
  trump: TrumpContext | null;
  dealerSeat: number | null;
  currentBid: Bid | null;
  bidHistory: Bid[];
  biddingStage: BiddingStage;
  biddingTurn: number | null;
  bidWindowEndsAt: number | null;
  isFirstRound: boolean;
  redealCount: number;
  buryingSeat: number | null;
  turnSeat: number | null;
  currentTrick: TrickPlayView[];
  lastTrick: TrickPlayView[];
  lastTrickWinnerSeat: number | null;
  throwEvents: ThrowEventView[];
  throwPenaltyPoints: [number, number];
  defenderPoints: number;
  teamLevels: [Rank, Rank];
  roundResult: RoundResultView | null;
};
