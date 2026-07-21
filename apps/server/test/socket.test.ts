import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import type { RoomStateView } from '@shengji/shared';
import { C2S, S2C } from '@shengji/shared';
import { createApp } from '../src/app';

let ctx: ReturnType<typeof createApp>;
let port = 0;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  ctx = createApp();
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

// 等待满足条件的 room:state（多次广播时跳过中间态）
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

describe('socket lifecycle', () => {
  it('room:create → room:state received with yourSeat 0', async () => {
    const c = await connect();
    c.emit(C2S.RoomCreate, { nickname: 'Alice', playerId: 'sock-pA' });
    const state = await once<RoomStateView>(c, S2C.RoomState);
    expect(state.roomCode).toMatch(/^[A-Z0-9]{5}$/);
    expect(state.yourSeat).toBe(0);
    expect(state.phase).toBe('waiting');
    c.close();
  });

  it('join with wrong password → game:error', async () => {
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'Host', playerId: 'sock-pH', password: 'pw' });
    const state = await once<RoomStateView>(host, S2C.RoomState);
    const guest = await connect();
    guest.emit(C2S.RoomJoin, {
      roomCode: state.roomCode,
      nickname: 'Guest',
      playerId: 'sock-pG',
      password: 'bad',
    });
    const err = await once<{ code: string }>(guest, S2C.GameError);
    expect(err.code).toBe('wrong-password');
    host.close();
    guest.close();
  });

  it('private hands: each player only sees own cards after game start', async () => {
    const ids = ['pv-0', 'pv-1', 'pv-2', 'pv-3'];
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'P0', playerId: ids[0] });
    const created = await once<RoomStateView>(host, S2C.RoomState);
    const code = created.roomCode;

    const guests: ClientSocket[] = [];
    for (let i = 1; i < 4; i++) {
      const g = await connect();
      g.emit(C2S.RoomJoin, { roomCode: code, nickname: `P${i}`, playerId: ids[i] });
      await waitState(g, (s) => s.roomCode === code);
      g.emit(C2S.SeatTake, { seat: i, playerId: ids[i] });
      await waitState(g, (s) => s.yourSeat === i);
      guests.push(g);
    }

    const all = [host, ...guests];
    const statesPromise = Promise.all(all.map((c) => waitState(c, (s) => s.phase === 'bidding')));
    host.emit(C2S.GameStart, { playerId: ids[0] });
    const states = await statesPromise;

    const handIds = states.map((s) => s.yourHand.map((card) => card.id));
    for (const [i, s] of states.entries()) {
      expect(s.yourHand).toHaveLength(25);
      expect(s.seats.every((seat) => seat.handCount === 25)).toBe(true);
      expect(s.yourSeat).toBe(i);
    }
    // 任意两家手牌无交集
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        const setB = new Set(handIds[b]);
        expect(handIds[a].some((id) => setB.has(id))).toBe(false);
      }
    }
    for (const c of all) c.close();
  });

  it('reconnect with same playerId restores seat and hand', async () => {
    const ids = ['rc-0', 'rc-1', 'rc-2', 'rc-3'];
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'R0', playerId: ids[0] });
    const created = await once<RoomStateView>(host, S2C.RoomState);
    const code = created.roomCode;
    // 其余三席用机器人补位后开局
    for (const seat of [1, 2, 3]) {
      host.emit(C2S.BotAdd, { seat, playerId: ids[0] });
    }
    const ready = waitState(host, (s) => s.phase === 'bidding');
    host.emit(C2S.GameStart, { playerId: ids[0] });
    const before = await ready;
    const handBefore = before.yourHand.map((card) => card.id).sort();

    host.close();
    const back = await connect();
    back.emit(C2S.RoomJoin, { roomCode: code, nickname: 'R0', playerId: ids[0] });
    const restored = await waitState(back, (s) => s.yourSeat === 0);
    expect(restored.yourHand.map((card) => card.id).sort()).toEqual(handBefore);
    expect(restored.phase).toBe('bidding');
    back.close();
  });

  it('stale duplicate connection closing must not cut off live broadcasts', async () => {
    // 同一 playerId 两条连接（新旧标签页/刷新竞争）：旧连接断开后，新连接仍须收到广播
    const host = await connect();
    host.emit(C2S.RoomCreate, { nickname: 'Dup', playerId: 'dup-0' });
    const created = await once<RoomStateView>(host, S2C.RoomState);
    const code = created.roomCode;

    // 第二条连接后绑同一 playerId，随后断开（模拟幽灵标签页关闭）
    const ghost = await connect();
    ghost.emit(C2S.RoomJoin, { roomCode: code, nickname: 'Dup', playerId: 'dup-0' });
    await waitState(ghost, (s) => s.roomCode === code);
    ghost.close();
    await new Promise((r) => setTimeout(r, 100));

    // 触发广播：加机器人 → 第一条连接必须收到新状态
    const updated = waitState(host, (s) => s.seats[1].isBot, 2000);
    host.emit(C2S.BotAdd, { seat: 1 });
    await expect(updated).resolves.toBeTruthy();
    // 且本人不应被标记为离线
    const state = await new Promise<RoomStateView>((resolve) => {
      host.emit(C2S.BotAdd, { seat: 2 });
      waitState(host, (s) => s.seats[2].isBot, 2000).then(resolve);
    });
    expect(state.seats[0].connected).toBe(true);
    host.close();
  });
});
