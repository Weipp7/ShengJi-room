import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type {
  BidRevealPayload,
  BotAddPayload,
  BotRemovePayload,
  ChatSendPayload,
  KittyBuryPayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomListItem,
  RoomStateView,
  SeatTakePayload,
  TrickPlayPayload,
} from '@shengji/shared';
import { C2S, S2C } from '@shengji/shared';
import { sortHand } from '@shengji/game';
import { loadConfig, type ServerConfig } from './config';
import { RoomManager, type Room } from './rooms';
import { advanceToNextRound, handleAction, startGame, type GameAction } from './gameFlow';
import { cancelBots, scheduleBots } from './botRunner';

// 按玩家投影房间状态：只下发本人手牌；scoring 阶段才有 kittyCards（在 result 内）
export function projectRoomState(room: Room, playerId: string): RoomStateView {
  const round = room.round;
  const yourSeat = room.seats.findIndex((s) => s.player?.playerId === playerId);
  const hostSeat = room.seats.findIndex((s) => s.player?.playerId === room.hostPlayerId);
  return {
    roomCode: room.code,
    phase: room.phase,
    seats: room.seats.map((s, i) => ({
      seat: i,
      nickname: s.player?.nickname ?? s.bot?.name ?? null,
      isBot: s.bot !== null,
      connected: s.bot !== null || (s.player?.connected ?? false),
      isHost: s.player?.playerId === room.hostPlayerId,
      handCount: round ? round.hands[i].length : 0,
    })),
    hostSeat: hostSeat >= 0 ? hostSeat : null,
    yourSeat: yourSeat >= 0 ? yourSeat : null,
    yourHand: round && yourSeat >= 0 ? sortHand(round.hands[yourSeat], round.trump) : [],
    trump: round?.trump ?? null,
    dealerSeat: round?.dealerSeat ?? null,
    currentBid: round?.currentBid ?? null,
    biddingTurn: round && round.phase === 'bidding' ? round.biddingTurn : null,
    turnSeat: round && round.phase === 'playing' ? round.turnSeat : null,
    currentTrick: round?.currentTrick.map((p) => ({ seat: p.seat, cards: p.cards })) ?? [],
    lastTrick: round?.lastTrick.map((p) => ({ seat: p.seat, cards: p.cards })) ?? [],
    defenderPoints: round?.defenderTrickPoints ?? 0,
    teamLevels: room.teamLevels,
    roundResult: round?.phase === 'scoring' ? round.result : null,
  };
}

export type AppContext = {
  app: express.Express;
  httpServer: http.Server;
  io: Server;
  manager: RoomManager;
  config: ServerConfig;
  broadcastRoom: (room: Room) => void;
};

export type AppOptions = {
  botDelayMs?: () => number;
};

export function createApp(config: ServerConfig = loadConfig(), opts: AppOptions = {}): AppContext {
  const app = express();
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // 生产模式：托管 web 静态产物并做 SPA fallback（dev 由 vite 单独提供页面）
  // 相对本文件目录解析：dev 的 src/ 与打包后的 dist/ 都能定位到 apps/web/dist
  if (process.env.NODE_ENV === 'production') {
    const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/socket.io') || req.path === '/healthz') return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: config.corsOrigin } });
  const manager = new RoomManager();

  const syncPhase = (room: Room): void => {
    room.phase = room.round ? room.round.phase : 'waiting';
  };

  // 每个玩家一个专属 room：多标签页/刷新竞争下广播不依赖单一 socketId
  const playerRoom = (playerId: string): string => `p:${playerId}`;

  const broadcastRoom = (room: Room): void => {
    syncPhase(room);
    const targets = [
      ...room.seats.flatMap((s) => (s.player ? [s.player] : [])),
      ...room.spectators,
    ];
    for (const p of targets) {
      io.to(playerRoom(p.playerId)).emit(S2C.RoomState, projectRoomState(room, p.playerId));
    }
  };

  io.on('connection', (socket: Socket) => {
    const sendError = (code: string, message: string): void => {
      socket.emit(S2C.GameError, { code, message });
    };

    const currentRoom = (): Room | null => {
      const code = socket.data.roomCode as string | undefined;
      return code ? (manager.rooms.get(code) ?? null) : null;
    };

    const runBots = (room: Room): void => {
      scheduleBots(
        room,
        () => {
          // 机器人行动同样算房间活跃，避免进行中的对局被 TTL 误删
          manager.touch(room);
          broadcastRoom(room);
        },
        opts.botDelayMs,
      );
    };

    // 入座玩家的对局动作：校验坐席 → 状态机 → 广播 + 机器人调度
    const act = (type: GameAction['type'], cardIds?: string[]): void => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      const seat = room.seats.findIndex((s) => s.player?.playerId === playerId);
      if (seat < 0) return sendError('not-seated', 'take a seat first');
      const result = handleAction(room, seat, { type, cardIds });
      if (!result.ok) return sendError(result.error.code, result.error.message);
      manager.touch(room);
      broadcastRoom(room);
      runBots(room);
    };

    // 绑定 socket 与玩家/房间，并同步 socketId
    const bind = (room: Room, playerId: string): void => {
      socket.data.playerId = playerId;
      socket.data.roomCode = room.code;
      socket.join(room.code);
      socket.join(playerRoom(playerId));
      for (const s of room.seats) {
        if (s.player?.playerId === playerId) {
          s.player.socketId = socket.id;
          s.player.connected = true;
        }
      }
      for (const p of room.spectators) {
        if (p.playerId === playerId) {
          p.socketId = socket.id;
          p.connected = true;
        }
      }
    };

    socket.on(C2S.RoomCreate, (payload: RoomCreatePayload) => {
      if (!payload?.playerId || !payload.nickname) {
        return sendError('bad-payload', 'nickname and playerId required');
      }
      const room = manager.createRoom(
        payload.playerId,
        payload.nickname,
        payload.password?.trim() ? payload.password : null,
      );
      bind(room, payload.playerId);
      broadcastRoom(room);
    });

    socket.on(C2S.RoomJoin, (payload: RoomJoinPayload) => {
      if (!payload?.playerId || !payload.roomCode) {
        return sendError('bad-payload', 'roomCode and playerId required');
      }
      const res = manager.joinRoom(
        payload.roomCode,
        payload.playerId,
        payload.nickname ?? '玩家',
        payload.password ?? null,
      );
      if (!res.ok) return sendError(res.code, 'cannot join room');
      bind(res.room, payload.playerId);
      broadcastRoom(res.room);
    });

    socket.on(C2S.RoomList, (_payload: unknown, ack?: (items: RoomListItem[]) => void) => {
      ack?.(manager.listOpenRooms());
    });

    socket.on(C2S.SeatTake, (payload: SeatTakePayload) => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      const res = manager.takeSeat(room, playerId, payload?.seat);
      if (!res.ok) return sendError(res.code ?? 'seat-error', 'cannot take seat');
      broadcastRoom(room);
    });

    socket.on(C2S.SeatLeave, () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      if (room.phase !== 'waiting') return sendError('wrong-phase', 'cannot leave seat mid-game');
      manager.leaveSeat(room, playerId);
      broadcastRoom(room);
    });

    socket.on(C2S.BotAdd, (payload: BotAddPayload) => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      if (playerId !== room.hostPlayerId) return sendError('not-host', 'only host can add bots');
      if (room.phase !== 'waiting') return sendError('wrong-phase', 'game already started');
      const res = manager.addBot(room, payload?.seat);
      if (!res.ok) return sendError(res.code ?? 'bot-error', 'cannot add bot');
      broadcastRoom(room);
    });

    socket.on(C2S.BotRemove, (payload: BotRemovePayload) => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      if (playerId !== room.hostPlayerId) return sendError('not-host', 'only host can remove bots');
      if (room.phase !== 'waiting') return sendError('wrong-phase', 'game already started');
      manager.removeBot(room, payload?.seat);
      broadcastRoom(room);
    });

    socket.on(C2S.GameStart, () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      if (playerId !== room.hostPlayerId) return sendError('not-host', 'only host can start');
      const res = startGame(room);
      if (!res.ok) return sendError(res.code ?? 'start-error', 'cannot start game');
      manager.touch(room);
      broadcastRoom(room);
      io.to(room.code).emit('game:started', {});
      runBots(room);
    });

    socket.on(C2S.BidReveal, (payload: BidRevealPayload) => act('reveal', payload?.cardIds ?? []));
    socket.on(C2S.BidPass, () => act('pass'));
    socket.on(C2S.KittyBury, (payload: KittyBuryPayload) => act('bury', payload?.cardIds ?? []));
    socket.on(C2S.TrickPlay, (payload: TrickPlayPayload) => act('play', payload?.cardIds ?? []));

    socket.on(C2S.RoundNext, () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return sendError('not-in-room', 'join a room first');
      const seat = room.seats.findIndex((s) => s.player?.playerId === playerId);
      if (seat < 0) return sendError('not-seated', 'take a seat first');
      if (room.round?.phase !== 'scoring') return sendError('wrong-phase', 'round not finished');
      advanceToNextRound(room);
      manager.touch(room);
      broadcastRoom(room);
      runBots(room);
    });

    socket.on(C2S.ChatSend, (payload: ChatSendPayload) => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return;
      const text = String(payload?.text ?? '').slice(0, 200);
      if (!text) return;
      const seat = room.seats.findIndex((s) => s.player?.playerId === playerId);
      const nickname =
        seat >= 0
          ? room.seats[seat].player!.nickname
          : (room.spectators.find((p) => p.playerId === playerId)?.nickname ?? '玩家');
      manager.touch(room);
      io.to(room.code).emit(S2C.ChatMessage, {
        seat: seat >= 0 ? seat : null,
        nickname,
        text,
        ts: Date.now(),
      });
    });

    socket.on(C2S.RoomEnd, () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return;
      if (playerId !== room.hostPlayerId) return sendError('not-host', 'only host can end room');
      cancelBots(room.code);
      io.to(room.code).emit(S2C.RoomEnded, {});
      manager.rooms.delete(room.code);
    });

    socket.on(C2S.RoomLeave, () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return;
      manager.removePlayer(room, playerId);
      socket.leave(room.code);
      socket.data.roomCode = undefined;
      if (manager.rooms.has(room.code)) broadcastRoom(room);
      else cancelBots(room.code);
    });

    socket.on('disconnect', () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return;
      // 同一玩家可能还有其他存活连接（多标签页/刷新竞争），全部断开才算离线
      const stillConnected = (io.sockets.adapter.rooms.get(playerRoom(playerId))?.size ?? 0) > 0;
      if (stillConnected) return;
      for (const s of room.seats) {
        if (s.player?.playerId === playerId) {
          s.player.connected = false;
          s.player.socketId = null;
        }
      }
      for (const p of room.spectators) {
        if (p.playerId === playerId) {
          p.connected = false;
          p.socketId = null;
        }
      }
      broadcastRoom(room);
    });
  });

  return { app, httpServer, io, manager, config, broadcastRoom };
}
