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
  if (view.phase === 'bidding') {
    if (view.biddingStage === 'dealing') {
      return '正在发牌，所有玩家摸到级牌后均可亮主…';
    }
    if (view.biddingStage === 'post-bury') {
      return `埋底后反主中，等待 ${seatName(view, view.biddingTurn)} 表态…`;
    }
    if (view.biddingStage === 'pre-dealer') {
      return view.currentBid !== null
        ? '摸底前限时反主中，其他玩家均可反主…'
        : '摸底前限时亮主中，所有玩家均可亮主…';
    }
    return '等待亮主…';
  }
  if (view.phase === 'burying') {
    return `等待 ${seatName(view, view.buryingSeat)} 埋底…`;
  }
  if (view.phase === 'playing') return `等待 ${seatName(view, view.turnSeat)} 出牌…`;
  return '等待下一步…';
}
