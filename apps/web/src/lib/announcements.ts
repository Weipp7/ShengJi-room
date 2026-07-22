import type { Bid, Card, RoomStateView } from '@shengji/shared';
import { rankText, SUIT_SYMBOL } from './format';

export type Announcement = {
  id: string;
  kind: 'bid' | 'counter' | 'phase';
  text: string;
  cards: Card[];
};

function seatName(view: RoomStateView, seat: number | null): string {
  if (seat === null) return '';
  if (seat === view.yourSeat) return '你';
  return view.seats[seat]?.nickname ?? `座位${seat + 1}`;
}

// 「♠2 单张 / ♥2 一对 / 大王对」这类叫主内容描述
function bidText(bid: Bid, level: number): string {
  if (bid.kind === 'big-joker-pair') return '大王对';
  if (bid.kind === 'small-joker-pair') return '小王对';
  const suit = bid.suit ? SUIT_SYMBOL[bid.suit] : '';
  const rank = rankText(level as Parameters<typeof rankText>[0]);
  return `${suit}${rank} ${bid.kind === 'suit-pair' ? '一对' : '单张'}`;
}

function suitText(suit: Bid['suit']): string {
  return suit ? SUIT_SYMBOL[suit] : '无主';
}

function trumpChangeText(prevBid: Bid | null, bid: Bid, level: number): string {
  const before = prevBid?.suit ?? null;
  const after = bid.suit ?? null;
  const levelStable = `级牌 ${rankText(level as Parameters<typeof rankText>[0])} 不变`;
  if (before === after) return `主仍是 ${suitText(after)}，${levelStable}`;
  return `主从${before === null ? '无主' : ` ${suitText(before)} `}改为${after === null ? '无主' : ` ${suitText(after)}`}，${levelStable}`;
}

function sameBid(a: Bid | null, b: Bid | null): boolean {
  if (a === null || b === null) return a === b;
  return a.seat === b.seat && a.kind === b.kind && a.suit === b.suit;
}

function bidHistory(view: RoomStateView): Bid[] {
  return view.bidHistory?.length > 0 ? view.bidHistory : view.currentBid ? [view.currentBid] : [];
}

function bidAnnouncement(
  view: RoomStateView,
  bid: Bid,
  previousBid: Bid | null,
  level: number,
  index: number,
): Announcement {
  const who = seatName(view, bid.seat);
  return previousBid === null
    ? {
        id: `bid-${index}-${bid.seat}-${bid.kind}-${bid.suit ?? 'NT'}`,
        kind: 'bid',
        text: `${who} 亮主 ${bidText(bid, level)}，${trumpChangeText(null, bid, level)}`,
        cards: bid.cards,
      }
    : {
        id: `counter-${index}-${bid.seat}-${bid.kind}-${bid.suit ?? 'NT'}`,
        kind: 'counter',
        text: `${who} 反主！${bidText(bid, level)} 压过 ${bidText(previousBid, level)}，${trumpChangeText(previousBid, bid, level)}`,
        cards: bid.cards,
      };
}

// 对比前后两次 RoomState，推导需要向玩家播报的事件（亮主/反主/定庄/开打）。
// prev 为 null（刚进房/重连）不播报，靠常驻状态卡兜底。
export function deriveAnnouncements(
  prev: RoomStateView | null,
  next: RoomStateView,
): Announcement[] {
  if (prev === null) return [];
  const events: Announcement[] = [];
  const level = next.trump?.level ?? 2;
  const prevHistory = bidHistory(prev);
  const nextHistory = bidHistory(next);

  if (nextHistory.length > prevHistory.length) {
    for (let i = prevHistory.length; i < nextHistory.length; i++) {
      events.push(bidAnnouncement(next, nextHistory[i], i > 0 ? nextHistory[i - 1] : null, level, i));
    }
  } else if (!sameBid(prev.currentBid, next.currentBid) && next.currentBid !== null) {
    const bid = next.currentBid;
    events.push(bidAnnouncement(next, bid, prev.currentBid, level, nextHistory.length));
  }

  if (prev.phase === 'bidding' && next.phase === 'burying') {
    const dealer = seatName(next, next.dealerSeat);
    events.push(
      next.currentBid !== null
        ? {
            id: `dealer-${next.dealerSeat}`,
            kind: 'phase',
            text: `${dealer} 坐庄，底牌归庄，埋底中…`,
            cards: [],
          }
        : {
            id: `dealer-fallback-${next.dealerSeat}`,
            kind: 'phase',
            text: `无人亮主，本局打无主，${dealer} 坐庄`,
            cards: [],
          },
    );
  }

  if (prev.phase === 'burying' && next.phase === 'playing') {
    events.push({
      id: `play-start-${next.dealerSeat}`,
      kind: 'phase',
      text: `埋底完成，${seatName(next, next.dealerSeat)} 先出牌`,
      cards: [],
    });
  }

  return events;
}
