import http from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type {
  BotAddPayload,
  BotRemovePayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomListItem,
  RoomStateView,
  SeatTakePayload,
} from '@shengji/shared';
import { C2S, S2C } from '@shengji/shared';
import { createRound, sortHand } from '@shengji/game';
import { loadConfig, type ServerConfig } from './config';
import { RoomManager, type Room } from './rooms';

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

export function createApp(config: ServerConfig = loadConfig()): AppContext {
  const app = express();
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: config.corsOrigin } });
  const manager = new RoomManager();

  const syncPhase = (room: Room): void => {
    room.phase = room.round ? room.round.phase : 'waiting';
  };

  const broadcastRoom = (room: Room): void => {
    syncPhase(room);
    const targets = [
      ...room.seats.flatMap((s) => (s.player ? [s.player] : [])),
      ...room.spectators,
    ];
    for (const p of targets) {
      if (p.socketId && p.connected) {
        io.to(p.socketId).emit(S2C.RoomState, projectRoomState(room, p.playerId));
      }
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

    // 绑定 socket 与玩家/房间，并同步 socketId
    const bind = (room: Room, playerId: string): void => {
      socket.data.playerId = playerId;
      socket.data.roomCode = room.code;
      socket.join(room.code);
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
      if (room.phase !== 'waiting') return sendError('wrong-phase', 'game already started');
      const filled = room.seats.every((s) => s.player !== null || s.bot !== null);
      if (!filled) return sendError('seats-not-full', 'all 4 seats must be filled');
      room.round = createRound({
        plannedDealerSeat: room.plannedDealerSeat,
        teamLevels: room.teamLevels,
        rng: Math.random,
      });
      manager.touch(room);
      broadcastRoom(room);
      io.to(room.code).emit('game:started', {});
    });

    socket.on(C2S.RoomLeave, () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return;
      manager.removePlayer(room, playerId);
      socket.leave(room.code);
      socket.data.roomCode = undefined;
      if (manager.rooms.has(room.code)) broadcastRoom(room);
    });

    socket.on('disconnect', () => {
      const room = currentRoom();
      const playerId = socket.data.playerId as string | undefined;
      if (!room || !playerId) return;
      for (const s of room.seats) {
        if (s.player?.playerId === playerId && s.player.socketId === socket.id) {
          s.player.connected = false;
          s.player.socketId = null;
        }
      }
      for (const p of room.spectators) {
        if (p.playerId === playerId && p.socketId === socket.id) {
          p.connected = false;
          p.socketId = null;
        }
      }
      broadcastRoom(room);
    });
  });

  return { app, httpServer, io, manager, config, broadcastRoom };
}
