import type { Bid, Card, RoomStateView } from '@shengji/shared';
import { rankText, SUIT_SYMBOL } from './format';

export type ContractFact = {
  label: string;
  value: string;
  tone: 'trump' | 'levels' | 'dealer' | 'score' | 'stage';
};

export type ContractSummary = {
  mode: 'pending' | 'bid' | 'fallback';
  title: string;
  detail: string;
  cards: Card[];
  facts: ContractFact[];
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

function trumpFactValue(view: RoomStateView, level: number): string {
  if (!view.trump) return `待定 ${rankText(level as Parameters<typeof rankText>[0])}`;
  const suit = view.trump.trumpSuit ? SUIT_SYMBOL[view.trump.trumpSuit] : '无主';
  return `${suit} ${rankText(level as Parameters<typeof rankText>[0])}`;
}

function teamLevelsText(view: RoomStateView): string {
  return `蓝队 ${rankText(view.teamLevels[0])} / 红队 ${rankText(view.teamLevels[1])}`;
}

function contractFacts(view: RoomStateView, stageLabel: string | null): ContractFact[] {
  const level = view.trump?.level ?? view.teamLevels[0];
  const facts: ContractFact[] = [
    { label: '主', value: trumpFactValue(view, level), tone: 'trump' },
    { label: '队伍级牌', value: teamLevelsText(view), tone: 'levels' },
  ];
  if (view.dealerSeat !== null) {
    facts.push({ label: '庄', value: seatName(view, view.dealerSeat), tone: 'dealer' });
  }
  if (view.phase === 'playing' || view.phase === 'scoring') {
    facts.push({ label: '闲家', value: `${view.defenderPoints}/80`, tone: 'score' });
  }
  if (stageLabel !== null) {
    facts.push({ label: '反牌窗口', value: stageLabel, tone: 'stage' });
  }
  return facts;
}

export function bidLabel(bid: Bid, level: number): string {
  const count = bid.cards.length;
  const countText = count === 1 ? '单张' : count === 2 ? '一对' : `${count}张`;
  if (bid.kind.startsWith('big-joker')) return `大王${countText}`;
  if (bid.kind.startsWith('small-joker')) return `小王${countText}`;
  const suit = bid.suit ? SUIT_SYMBOL[bid.suit] : '';
  return `${suit}${rankText(level as Parameters<typeof rankText>[0])} ${countText}`;
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
    const title =
      view.phase === 'bidding'
        ? `${bidder} ${action}`
        : view.phase === 'burying' && view.biddingStage === 'post-dealer'
          ? '庄后反牌窗口'
          : '本局契约';
    const previousText =
      previousBid === null
        ? ''
        : `（压过 ${seatName(view, previousBid.seat)} ${bidLabel(previousBid, level)}）`;
    const stageLabel =
      view.phase === 'bidding' && view.biddingStage === 'pre-dealer'
        ? '庄前反牌中'
        : view.phase === 'burying' && view.biddingStage === 'post-dealer'
          ? '庄后反牌中'
          : null;
    const stageText = stageLabel === null ? '' : `，${stageLabel}`;
    return {
      mode: 'bid',
      title,
      detail: `${bidder} ${action} ${bid}${previousText}，${trumpName(view)}，${levelText}，庄家 ${dealer}${stageText}`,
      cards: view.currentBid.cards,
      facts: contractFacts(view, stageLabel),
    };
  }
  if (view.phase !== 'bidding' && view.dealerSeat !== null) {
    return {
      mode: 'fallback',
      title: '无人亮主',
      detail: `无人亮主，${trumpName(view)}，${levelText}，庄家 ${seatName(view, view.dealerSeat)}`,
      cards: [],
      facts: contractFacts(view, null),
    };
  }
  return {
    mode: 'pending',
    title: '还没有人亮主',
    detail: `等待亮主或反主，${levelText}`,
    cards: [],
    facts: contractFacts(view, null),
  };
}
