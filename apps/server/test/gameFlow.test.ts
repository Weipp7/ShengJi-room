import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import type { ChatMessagePayload, RoomStateView } from '@shengji/shared';
import { C2S, S2C } from '@shengji/shared';
import { countPoints, createRound, detectCombo } from '@shengji/game';
import { decideBury, decidePlay } from '@shengji/bot';
import { createApp } from '../src/app';

let ctx: ReturnType<typeof createApp>;
let port = 0;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  // 机器人零延迟，测试内快速跑完整局
  ctx = createApp(undefined, { botDelayMs: () => 0 });
  await new Promise<void>((resolve) => ctx.httpServer.listen(0, resolve));
  port = (ctx.httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const c of clients) c.close();
  ctx.io.close();
  await new Promise<void>((resolve) => {
    ctx.httpServer.close(() => resolve());
  });
});

function connect(): Promise<ClientSocket> {
  const socket = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  clients.push(socket);
  return new Promise((resolve) => socket.once('connect', () => resolve(socket)));
}

function once<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function waitState(
  socket: ClientSocket,
  pred: (s: RoomStateView) => boolean,
  timeoutMs = 4000,
): Promise<RoomStateView> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(S2C.RoomState, handler);
      reject(new Error('waitState timeout'));
    }, timeoutMs);
    const handler = (s: RoomStateView) => {
      if (pred(s)) {
        clearTimeout(timer);
        socket.off(S2C.RoomState, handler);
        resolve(s);
      }
    };
    socket.on(S2C.RoomState, handler);
  });
}

async function createFourHumanRoom(prefix: string): Promise<{
  code: string;
  host: ClientSocket;
  guests: ClientSocket[];
  all: ClientSocket[];
}> {
  const host = await connect();
  host.emit(C2S.RoomCreate, { nickname: `${prefix}-0`, playerId: `${prefix}-0` });
  const created = await once<RoomStateView>(host, S2C.RoomState);
  const guests: ClientSocket[] = [];

  for (const seat of [1, 2, 3]) {
    const guest = await connect();
    guest.emit(C2S.RoomJoin, {
      roomCode: created.roomCode,
      nickname: `${prefix}-${seat}`,
      playerId: `${prefix}-${seat}`,
    });
    await waitState(guest, (s) => s.roomCode === created.roomCode);
    const hostSeesSeat = waitState(host, (s) => s.seats[seat].nickname === `${prefix}-${seat}`);
    guest.emit(C2S.SeatTake, { seat });
    await Promise.all([waitState(guest, (s) => s.yourSeat === seat), hostSeesSeat]);
    guests.push(guest);
  }

  return { code: created.roomCode, host, guests, all: [host, ...guests] };
}

// 人类玩家自动机：轮到自己就用 bot 决策回发，模拟真实客户端
function autoPlay(socket: ClientSocket): void {
  let lastKey = '';
  socket.on(S2C.RoomState, (s: RoomStateView) => {
    if (s.yourSeat === null || s.trump === null) return;
    // currentBid 参与 key：有人亮主后叫主轮回到自己时需再次表态
    const key = `${s.phase}:${s.biddingTurn}:${s.turnSeat}:${s.yourHand.length}:${s.currentTrick.length}:${JSON.stringify(s.currentBid)}`;
    if (key === lastKey) return;
    if (s.phase === 'bidding' && s.biddingTurn === s.yourSeat) {
      lastKey = key;
      socket.emit(C2S.BidPass, {});
    } else if (s.phase === 'burying' && s.dealerSeat === s.yourSeat) {
      lastKey = key;
      socket.emit(C2S.KittyBury, { cardIds: decideBury(s.yourHand, s.trump) });
    } else if (s.phase === 'playing' && s.turnSeat === s.yourSeat) {
      lastKey = key;
      const trump = s.trump;
      const trick = s.currentTrick.map((p) => ({
        seat: p.seat,
        cards: p.cards,
        combo: detectCombo(p.cards, trump),
      }));
      const cardIds = decidePlay({
        hand: s.yourHand,
        trump,
        leadCombo: trick.length > 0 ? trick[0].combo : null,
        currentTrick: trick,
        seat: s.yourSeat,
        trickPointsSoFar: countPoints(s.currentTrick.flatMap((p) => p.cards)),
      });
      socket.emit(C2S.TrickPlay, { cardIds });
    }
  });
}

describe('game flow orchestration', () => {
  it(
    '1 human + 3 bots plays a full round to scoring automatically',
    async () => {
      const host = await connect();
      autoPlay(host);
      host.emit(C2S.RoomCreate, { nickname: 'H', playerId: 'gf-h1' });
      const created = await once<RoomStateView>(host, S2C.RoomState);
      for (const seat of [1, 2, 3]) host.emit(C2S.BotAdd, { seat });
      await waitState(host, (s) => s.seats.filter((x) => x.isBot).length === 3);

      const scoringPromise = waitState(
        host,
        (s) => s.phase === 'scoring' && s.roundResult !== null,
        25_000,
      );
      host.emit(C2S.GameStart, {});
      const scoring = await scoringPromise;
      const result = scoring.roundResult!;
      expect(result.defenderPoints).toBeGreaterThanOrEqual(0);
      expect(result.nextLevels).toHaveLength(2);
      expect(scoring.roomCode).toBe(created.roomCode);

      // round:next → 回到 bidding，级牌与庄家按结算推进
      const nextPromise = waitState(
        host,
        (s) => s.phase === 'bidding' && s.yourHand.length === 25,
        10_000,
      );
      host.emit(C2S.RoundNext, {});
      const next = await nextPromise;
      expect(next.teamLevels).toEqual(result.nextLevels);
      expect(next.dealerSeat).toBe(result.nextDealerSeat);
      host.close();
    },
    30_000,
  );

  it('wrong-turn and wrong-phase actions rejected', async () => {
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'H', playerId: 'gf-h2' });
    const created = await once<RoomStateView>(host, S2C.RoomState);

    // 未开局出牌 → wrong-phase
    host.emit(C2S.TrickPlay, { cardIds: [] });
    const e1 = await once<{ code: string }>(host, S2C.GameError);
    expect(e1.code).toBe('wrong-phase');

    // 第二个真人坐 seat 1，机器人补 2/3 后开局
    const guest = await connect();
    guest.emit(C2S.RoomJoin, { roomCode: created.roomCode, nickname: 'G', playerId: 'gf-g2' });
    await waitState(guest, (s) => s.roomCode === created.roomCode);
    guest.emit(C2S.SeatTake, { seat: 1 });
    await waitState(guest, (s) => s.yourSeat === 1);
    for (const seat of [2, 3]) host.emit(C2S.BotAdd, { seat });
    await waitState(host, (s) => s.seats.filter((x) => x.isBot).length === 2);
    const started = waitState(guest, (s) => s.phase === 'bidding');
    host.emit(C2S.GameStart, {});
    await started;

    // 叫主轮在 seat 0（host），guest 抢过 → wrong-turn
    guest.emit(C2S.BidPass, {});
    const e2 = await once<{ code: string }>(guest, S2C.GameError);
    expect(e2.code).toBe('wrong-turn');

    // bidding 阶段埋底 → wrong-phase
    guest.emit(C2S.KittyBury, { cardIds: [] });
    const e3 = await once<{ code: string }>(guest, S2C.GameError);
    expect(e3.code).toBe('wrong-phase');
    host.close();
    guest.close();
  });

  it('duplicate pass requests only advance the bidding turn once', async () => {
    const { code, host, all } = await createFourHumanRoom('dup-pass');
    const started = waitState(host, (s) => s.phase === 'bidding' && s.biddingTurn === 0);
    host.emit(C2S.GameStart, {});
    await started;

    const nextState = waitState(host, (s) => s.phase === 'bidding' && s.biddingTurn === 1);
    const staleError = once<{ code: string }>(host, S2C.GameError);
    host.emit(C2S.BidPass, {});
    host.emit(C2S.BidPass, {});

    const [state, error] = await Promise.all([nextState, staleError]);
    expect(error.code).toBe('wrong-turn');
    expect(state.biddingTurn).toBe(1);
    expect(ctx.manager.rooms.get(code)?.round?.biddingTurn).toBe(1);
    for (const socket of all) socket.close();
  });

  it('duplicate play requests only remove the played card once', async () => {
    const { code, host, all } = await createFourHumanRoom('dup-play');
    const started = waitState(host, (s) => s.phase === 'bidding');
    host.emit(C2S.GameStart, {});
    const initial = await started;
    const room = ctx.manager.rooms.get(code)!;
    room.round = {
      ...createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: () => 0.1 }),
      phase: 'playing',
      biddingStage: null,
      dealerSeat: 0,
      trump: { trumpSuit: null, level: 2 },
      turnSeat: 0,
    };
    room.phase = 'playing';
    const cardId = room.round.hands[0][0].id;
    const beforeCount = room.round.hands[0].length;

    const nextState = waitState(host, (s) => s.phase === 'playing' && s.turnSeat === 1);
    const staleError = once<{ code: string }>(host, S2C.GameError);
    host.emit(C2S.TrickPlay, { cardIds: [cardId] });
    host.emit(C2S.TrickPlay, { cardIds: [cardId] });

    const [state, error] = await Promise.all([nextState, staleError]);
    expect(error.code).toBe('wrong-turn');
    expect(initial.roomCode).toBe(code);
    expect(state.currentTrick).toHaveLength(1);
    expect(state.currentTrick[0].cards.map((card) => card.id)).toEqual([cardId]);
    expect(ctx.manager.rooms.get(code)?.round?.hands[0]).toHaveLength(beforeCount - 1);
    for (const socket of all) socket.close();
  });

  it('duplicate next-round requests only advance one new round', async () => {
    const { code, host, all } = await createFourHumanRoom('dup-next');
    const room = ctx.manager.rooms.get(code)!;
    const base = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: () => 0.1 });
    room.round = {
      ...base,
      phase: 'scoring',
      result: {
        defenderPoints: 0,
        kittyCards: [],
        kittyBonus: 0,
        winnerTeam: 0,
        levelDelta: 1,
        nextDealerSeat: 0,
        nextLevels: [3, 2],
      },
    };
    room.phase = 'scoring';

    const nextState = waitState(host, (s) => s.phase === 'bidding' && s.teamLevels[0] === 3);
    const staleError = once<{ code: string }>(host, S2C.GameError);
    host.emit(C2S.RoundNext, {});
    host.emit(C2S.RoundNext, {});

    const [state, error] = await Promise.all([nextState, staleError]);
    expect(error.code).toBe('wrong-phase');
    expect(state.teamLevels).toEqual([3, 2]);
    expect(ctx.manager.rooms.get(code)?.teamLevels).toEqual([3, 2]);
    for (const socket of all) socket.close();
  });

  it('start rejected when seats not full or requester not host', async () => {
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'H', playerId: 'gf-h3' });
    const created = await once<RoomStateView>(host, S2C.RoomState);
    for (const seat of [1, 2]) host.emit(C2S.BotAdd, { seat });
    await waitState(host, (s) => s.seats.filter((x) => x.isBot).length === 2);

    host.emit(C2S.GameStart, {});
    const e1 = await once<{ code: string }>(host, S2C.GameError);
    expect(e1.code).toBe('seats-not-full');

    const guest = await connect();
    guest.emit(C2S.RoomJoin, { roomCode: created.roomCode, nickname: 'G', playerId: 'gf-g3' });
    await waitState(guest, (s) => s.roomCode === created.roomCode);
    guest.emit(C2S.GameStart, {});
    const e2 = await once<{ code: string }>(guest, S2C.GameError);
    expect(e2.code).toBe('not-host');
    host.close();
    guest.close();
  });

  it('chat:send broadcasts truncated message to room members', async () => {
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'H', playerId: 'gf-h4' });
    const created = await once<RoomStateView>(host, S2C.RoomState);
    const guest = await connect();
    guest.emit(C2S.RoomJoin, { roomCode: created.roomCode, nickname: 'G', playerId: 'gf-g4' });
    await waitState(guest, (s) => s.roomCode === created.roomCode);

    const msgPromise = once<ChatMessagePayload>(guest, S2C.ChatMessage);
    host.emit(C2S.ChatSend, { text: 'x'.repeat(500) });
    const msg = await msgPromise;
    expect(msg.nickname).toBe('H');
    expect(msg.seat).toBe(0);
    expect(msg.text).toHaveLength(200);
    host.close();
    guest.close();
  });
});
