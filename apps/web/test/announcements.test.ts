import { describe, expect, it } from 'vitest';
import type { Bid, Card, RoomStateView } from '@shengji/shared';
import { deriveAnnouncements } from '../src/lib/announcements';

function c(suit: 'S' | 'H' | 'D' | 'C', rank: number, copy: number): Card {
  return { id: `${suit}${rank}-${copy}`, kind: 'suit', suit, rank: rank as Card & never } as Card;
}

function joker(j: 'small' | 'big', copy: number): Card {
  return { id: `${j}-${copy}`, kind: 'joker', joker: j };
}

const NICKNAMES = ['阿明', '机器人2', '机器人3', '机器人4'];

function mkView(partial: Partial<RoomStateView>): RoomStateView {
  return {
    roomCode: 'TEST1',
    phase: 'bidding',
    seats: NICKNAMES.map((nickname, seat) => ({
      seat,
      nickname,
      isBot: seat > 0,
      connected: true,
      isHost: seat === 0,
      handCount: 25,
    })),
    hostSeat: 0,
    yourSeat: 0,
    yourHand: [],
    trump: { trumpSuit: null, level: 2 },
    dealerSeat: null,
    currentBid: null,
    bidHistory: [],
    biddingTurn: 0,
    turnSeat: null,
    currentTrick: [],
    lastTrick: [],
    defenderPoints: 0,
    teamLevels: [2, 2],
    roundResult: null,
    ...partial,
  };
}

const singleBid: Bid = { seat: 1, kind: 'suit-single', suit: 'S', cards: [c('S', 2, 0)] };
const pairBid: Bid = { seat: 2, kind: 'suit-pair', suit: 'H', cards: [c('H', 2, 0), c('H', 2, 1)] };
const ntBid: Bid = { seat: 0, kind: 'big-joker-pair', suit: null, cards: [joker('big', 0), joker('big', 1)] };
const tripleBid: Bid = {
  seat: 1,
  kind: 'suit-multiple',
  suit: 'S',
  cards: [c('S', 2, 0), c('S', 2, 1), c('S', 2, 2)],
};
const smallJokerSingle: Bid = { seat: 1, kind: 'small-joker-single', suit: null, cards: [joker('small', 0)] };
const bigJokerSingle: Bid = { seat: 0, kind: 'big-joker-single', suit: null, cards: [joker('big', 0)] };

describe('deriveAnnouncements', () => {
  it('no events when prev is null (initial join / reconnect)', () => {
    expect(deriveAnnouncements(null, mkView({ currentBid: singleBid }))).toEqual([]);
  });

  it('no events when nothing changed', () => {
    const v = mkView({ currentBid: singleBid });
    expect(deriveAnnouncements(v, v)).toEqual([]);
  });

  it('first reveal announces bidder, bid type and cards', () => {
    const events = deriveAnnouncements(mkView({}), mkView({ currentBid: singleBid }));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('bid');
    expect(events[0].text).toContain('机器人2');
    expect(events[0].text).toContain('亮主');
    expect(events[0].text).toContain('♠');
    expect(events[0].text).toContain('主从无主改为 ♠');
    expect(events[0].text).toContain('级牌 2 不变');
    expect(events[0].cards).toEqual(singleBid.cards);
  });

  it('your own reveal says 你', () => {
    const events = deriveAnnouncements(
      mkView({}),
      mkView({ currentBid: { ...singleBid, seat: 0 } }),
    );
    expect(events[0].text).toContain('你');
  });

  it('overcall announces counter with new trump suit', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: singleBid }),
      mkView({ currentBid: pairBid }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('机器人3');
    expect(events[0].text).toContain('反主');
    expect(events[0].text).toContain('♥');
    expect(events[0].text).toContain('主从 ♠ 改为 ♥');
    expect(events[0].text).toContain('级牌 2 不变');
  });

  it('same-suit stronger overcall says trump suit is unchanged', () => {
    const strongerSameSuit: Bid = {
      seat: 2,
      kind: 'suit-pair',
      suit: 'S',
      cards: [c('S', 2, 0), c('S', 2, 1)],
    };
    const events = deriveAnnouncements(
      mkView({ currentBid: singleBid }),
      mkView({ currentBid: strongerSameSuit }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('反主');
    expect(events[0].text).toContain('主仍是 ♠');
    expect(events[0].text).toContain('级牌 2 不变');
  });

  it('joker pair counter announces no-trump', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: pairBid }),
      mkView({ currentBid: ntBid }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('无主');
    expect(events[0].text).toContain('主从 ♥ 改为无主');
  });

  it('multi-card suit reveal announces the exposed card count', () => {
    const events = deriveAnnouncements(mkView({}), mkView({ currentBid: tripleBid }));
    expect(events[0].text).toContain('亮主');
    expect(events[0].text).toContain('♠2 3张');
    expect(events[0].cards).toEqual(tripleBid.cards);
  });

  it('single big joker counter announces big joker over small joker', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: smallJokerSingle }),
      mkView({ currentBid: bigJokerSingle }),
    );
    expect(events[0].kind).toBe('counter');
    expect(events[0].text).toContain('大王单张');
    expect(events[0].text).toContain('压过 小王单张');
    expect(events[0].text).toContain('主仍是 无主');
  });

  it('derives every reveal/counter from bid history when snapshots skip intermediate states', () => {
    const events = deriveAnnouncements(
      mkView({}),
      mkView({
        currentBid: ntBid,
        bidHistory: [singleBid, pairBid, ntBid],
      }),
    );
    expect(events.map((e) => e.kind)).toEqual(['bid', 'counter', 'counter']);
    expect(events[0].text).toContain('机器人2 亮主');
    expect(events[1].text).toContain('机器人3 反主');
    expect(events[1].text).toContain('压过 ♠2 单张');
    expect(events[2].text).toContain('你 反主');
    expect(events[2].text).toContain('压过 ♥2 一对');
  });

  it('bidding -> burying with a bid announces the dealer', () => {
    const events = deriveAnnouncements(
      mkView({ currentBid: pairBid }),
      mkView({ phase: 'burying', currentBid: pairBid, dealerSeat: 2 }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('phase');
    expect(events[0].text).toContain('机器人3');
    expect(events[0].text).toContain('坐庄');
  });

  it('bidding -> burying with no bid announces no-trump fallback', () => {
    const events = deriveAnnouncements(
      mkView({}),
      mkView({ phase: 'burying', currentBid: null, dealerSeat: 0 }),
    );
    expect(events[0].text).toContain('无人亮主');
    expect(events[0].text).toContain('无主');
  });

  it('burying -> playing announces dealer leads', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'burying', currentBid: pairBid, dealerSeat: 2 }),
      mkView({ phase: 'playing', currentBid: pairBid, dealerSeat: 2, turnSeat: 2 }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('phase');
    expect(events[0].text).toContain('埋底完成');
  });

  it('unrelated phase changes emit nothing', () => {
    const events = deriveAnnouncements(
      mkView({ phase: 'playing' }),
      mkView({ phase: 'scoring' }),
    );
    expect(events).toEqual([]);
  });
});
