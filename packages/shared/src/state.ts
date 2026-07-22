import type { Bid, Card, Rank, TrumpContext } from './cards';

export type Phase = 'waiting' | 'bidding' | 'burying' | 'playing' | 'scoring';
export type BiddingStage = 'pre-dealer' | 'post-dealer' | null;

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
  success: boolean;
  n: number;
  penaltyPoints: number;
  beneficiaryTeam: 0 | 1 | null;
  reason: 'beatable-pair' | null;
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
