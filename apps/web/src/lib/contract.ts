import type { Bid, Card, RoomStateView } from '@shengji/shared';
import { rankText, SUIT_SYMBOL } from './format';

export type ContractSummary = {
  mode: 'pending' | 'bid' | 'fallback';
  title: string;
  detail: string;
  cards: Card[];
};

function seatName(view: RoomStateView, seat: number | null): string {
  if (seat === null) return '';
  if (seat === view.yourSeat) return '你';
  return view.seats[seat]?.nickname ?? `座位${seat + 1}`;
}

function trumpName(view: RoomStateView): string {
  const suit = view.trump?.trumpSuit ?? null;
  return suit ? `主 ${SUIT_SYMBOL[suit]}` : '本局无主';
}

export function bidLabel(bid: Bid, level: number): string {
  if (bid.kind === 'big-joker-pair') return '大王对';
  if (bid.kind === 'small-joker-pair') return '小王对';
  const suit = bid.suit ? SUIT_SYMBOL[bid.suit] : '';
  return `${suit}${rankText(level as Parameters<typeof rankText>[0])} ${bid.kind === 'suit-pair' ? '一对' : '单张'}`;
}

export function describeContract(view: RoomStateView): ContractSummary {
  const level = view.trump?.level ?? view.teamLevels[0];
  const levelText = `级牌 ${rankText(level as Parameters<typeof rankText>[0])}`;
  if (view.currentBid !== null) {
    const history = view.bidHistory?.length > 0 ? view.bidHistory : [view.currentBid];
    const currentIndex = history.findIndex(
      (bid) =>
        bid.seat === view.currentBid?.seat &&
        bid.kind === view.currentBid.kind &&
        bid.suit === view.currentBid.suit,
    );
    const previousBid = currentIndex > 0 ? history[currentIndex - 1] : null;
    const bidder = seatName(view, view.currentBid.seat);
    const dealer = seatName(view, view.dealerSeat);
    const bid = bidLabel(view.currentBid, level);
    const action = previousBid === null ? '亮主' : '反主';
    const title = view.phase === 'bidding' ? `${bidder} ${action}` : '本局契约';
    const previousText =
      previousBid === null
        ? ''
        : `（压过 ${seatName(view, previousBid.seat)} ${bidLabel(previousBid, level)}）`;
    return {
      mode: 'bid',
      title,
      detail: `${bidder} ${action} ${bid}${previousText}，${trumpName(view)}，${levelText}，庄家 ${dealer}`,
      cards: view.currentBid.cards,
    };
  }
  if (view.phase !== 'bidding' && view.dealerSeat !== null) {
    return {
      mode: 'fallback',
      title: '无人亮主',
      detail: `无人亮主，${trumpName(view)}，${levelText}，庄家 ${seatName(view, view.dealerSeat)}`,
      cards: [],
    };
  }
  return {
    mode: 'pending',
    title: '还没有人亮主',
    detail: `等待亮主或反主，${levelText}`,
    cards: [],
  };
}
