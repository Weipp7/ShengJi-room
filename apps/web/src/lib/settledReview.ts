import type { RoomStateView, TrickPlayView } from '@shengji/shared';

export type SettledReview = {
  plays: TrickPlayView[];
  winnerSeat: number | null;
};

export function settledReviewKey(view: RoomStateView): string {
  return `${view.lastTrick.map((p) => p.cards.map((c) => c.id).join(',')).join('|')}:${
    view.lastTrickWinnerSeat ?? ''
  }`;
}

export function settledReviewStateKey(view: RoomStateView): string {
  const currentTrick = view.currentTrick
    .map((p) => `${p.seat}:${p.cards.map((c) => c.id).join(',')}`)
    .join('|');
  return `${view.phase}:${currentTrick}:${settledReviewKey(view)}`;
}

export function nextSettledReview(view: RoomStateView): SettledReview | null {
  if (view.phase !== 'playing') return null;
  if (view.currentTrick.length > 0) return null;
  if (view.lastTrick.length < 4) return null;
  return { plays: view.lastTrick, winnerSeat: view.lastTrickWinnerSeat };
}
