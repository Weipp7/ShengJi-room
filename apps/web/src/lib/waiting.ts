import type { RoomStateView } from '@shengji/shared';

function seatName(view: RoomStateView, seat: number | null): string {
  if (seat === null) return '对方';
  if (seat === view.yourSeat) return '你';
  return view.seats[seat]?.nickname ?? `座位${seat + 1}`;
}

export function describeWaiting(view: RoomStateView, holdActive: boolean): string {
  if (holdActive) {
    return `${seatName(view, view.lastTrickWinnerSeat)} 收墩，下一墩即将开始…`;
  }
  if (view.phase === 'bidding') return `等待 ${seatName(view, view.biddingTurn)} 叫主…`;
  if (view.phase === 'burying') return `等待 ${seatName(view, view.dealerSeat)} 埋底…`;
  if (view.phase === 'playing') return `等待 ${seatName(view, view.turnSeat)} 出牌…`;
  return '等待下一步…';
}
