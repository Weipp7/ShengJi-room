import type { Bid, Card, RoomStateView, ThrowEventView } from '@shengji/shared';
import { rankText, SUIT_SYMBOL } from './format';
import { bidLabel } from './contract';

export type Announcement = {
  id: string;
  kind: 'bid' | 'counter' | 'phase' | 'throw';
  text: string;
  cards: Card[];
};

function seatName(view: RoomStateView, seat: number | null): string {
  if (seat === null) return '';
  if (seat === view.yourSeat) return '你';
  return view.seats[seat]?.nickname ?? `座位${seat + 1}`;
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

function cardFaceText(card: Card): string {
  if (card.kind === 'joker') return card.joker === 'big' ? '大王' : '小王';
  return `${SUIT_SYMBOL[card.suit]}${rankText(card.rank)}`;
}

function cardsSummary(cards: Card[]): string {
  if (cards.length === 2 && cardFaceText(cards[0]) === cardFaceText(cards[1])) {
    return `${cardFaceText(cards[0])} 一对`;
  }
  return `${cards.length} 张`;
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
        text: `${who} 亮主 ${bidLabel(bid, level)}，${trumpChangeText(null, bid, level)}`,
        cards: bid.cards,
      }
    : {
        id: `counter-${index}-${bid.seat}-${bid.kind}-${bid.suit ?? 'NT'}`,
        kind: 'counter',
        text: `${who} 反主！${bidLabel(bid, level)} 压过 ${bidLabel(previousBid, level)}，${trumpChangeText(previousBid, bid, level)}`,
        cards: bid.cards,
      };
}

function throwAnnouncement(view: RoomStateView, event: ThrowEventView, index: number): Announcement {
  const who = seatName(view, event.seat);
  const prefix = who === '你' ? who : `${who} `;
  if (event.success) {
    return {
      id: `throw-${index}-${event.id}`,
      kind: 'throw',
      text: `${prefix}甩牌成功：本墩以 ${event.n} 个对子领出`,
      cards: event.attemptedCards,
    };
  }
  return {
    id: `throw-${index}-${event.id}`,
    kind: 'throw',
    text: `${prefix}甩牌失败：有人可压住其中的 ${cardsSummary(
      event.challengedCards,
    )}，本墩实际领出 ${cardsSummary(event.actualCards)}；甩牌惩罚 20 × ${event.n} = ${
      event.penaltyPoints
    } 分`,
    cards: event.attemptedCards,
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
  const prevThrowIds = new Set((prev.throwEvents ?? []).map((event) => event.id));

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

  for (let i = 0; i < (next.throwEvents ?? []).length; i++) {
    const event = next.throwEvents[i];
    if (!prevThrowIds.has(event.id)) events.push(throwAnnouncement(next, event, i));
  }

  return events;
}
