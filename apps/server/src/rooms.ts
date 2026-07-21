import type { Phase, Rank, RoomListItem } from '@shengji/shared';
import { SEAT_COUNT } from '@shengji/shared';
import type { RoundState } from '@shengji/game';

export type PlayerSlot = {
  playerId: string;
  nickname: string;
  socketId: string | null;
  connected: boolean;
};

export type Seat = { player: PlayerSlot | null; bot: { name: string } | null };

export type Room = {
  code: string;
  password: string | null;
  hostPlayerId: string;
  seats: [Seat, Seat, Seat, Seat];
  phase: Phase;
  round: RoundState | null;
  plannedDealerSeat: number;
  teamLevels: [Rank, Rank];
  spectators: PlayerSlot[];
  createdAt: number;
  lastActiveAt: number;
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const emptySeat = (): Seat => ({ player: null, bot: null });

export type JoinResult =
  | { ok: true; room: Room }
  | { ok: false; code: 'room-not-found' | 'wrong-password' };

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  private generateCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += CODE_CHARS[Math.floor(this.rng() * CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
  }

  touch(room: Room): void {
    room.lastActiveAt = Date.now();
  }

  createRoom(hostPlayerId: string, nickname: string, password: string | null): Room {
    const host: PlayerSlot = { playerId: hostPlayerId, nickname, socketId: null, connected: true };
    const room: Room = {
      code: this.generateCode(),
      password,
      hostPlayerId,
      seats: [{ player: host, bot: null }, emptySeat(), emptySeat(), emptySeat()],
      phase: 'waiting',
      round: null,
      plannedDealerSeat: 0,
      teamLevels: [2, 2],
      spectators: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    this.rooms.set(room.code, room);
    return room;
  }

  joinRoom(code: string, playerId: string, nickname: string, password: string | null): JoinResult {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { ok: false, code: 'room-not-found' };
    const existing = this.findInRoom(room, playerId);
    if (existing) {
      // 重连：密码不再校验，身份由 playerId 保证
      this.touch(room);
      return { ok: true, room };
    }
    if (room.password !== null && room.password !== password) {
      return { ok: false, code: 'wrong-password' };
    }
    room.spectators.push({ playerId, nickname, socketId: null, connected: true });
    this.touch(room);
    return { ok: true, room };
  }

  private findInRoom(room: Room, playerId: string): PlayerSlot | null {
    for (const seat of room.seats) {
      if (seat.player?.playerId === playerId) return seat.player;
    }
    return room.spectators.find((p) => p.playerId === playerId) ?? null;
  }

  takeSeat(room: Room, playerId: string, seat: number): { ok: boolean; code?: string } {
    if (seat < 0 || seat >= SEAT_COUNT) return { ok: false, code: 'bad-seat' };
    const target = room.seats[seat];
    if (target.player !== null || target.bot !== null) return { ok: false, code: 'seat-taken' };
    const slot = this.findInRoom(room, playerId);
    if (!slot) return { ok: false, code: 'not-in-room' };
    // 从原座位/旁观席移除
    for (const s of room.seats) {
      if (s.player?.playerId === playerId) s.player = null;
    }
    room.spectators = room.spectators.filter((p) => p.playerId !== playerId);
    target.player = slot;
    this.touch(room);
    return { ok: true };
  }

  leaveSeat(room: Room, playerId: string): void {
    for (const s of room.seats) {
      if (s.player?.playerId === playerId) {
        room.spectators.push(s.player);
        s.player = null;
      }
    }
    this.touch(room);
  }

  removePlayer(room: Room, playerId: string): void {
    for (const s of room.seats) {
      if (s.player?.playerId === playerId) s.player = null;
    }
    room.spectators = room.spectators.filter((p) => p.playerId !== playerId);
    this.touch(room);
    const hasHumans =
      room.seats.some((s) => s.player !== null) || room.spectators.length > 0;
    if (!hasHumans) this.rooms.delete(room.code);
  }

  addBot(room: Room, seat: number): { ok: boolean; code?: string } {
    if (seat < 0 || seat >= SEAT_COUNT) return { ok: false, code: 'bad-seat' };
    const target = room.seats[seat];
    if (target.player !== null || target.bot !== null) return { ok: false, code: 'seat-taken' };
    target.bot = { name: `机器人${seat + 1}` };
    this.touch(room);
    return { ok: true };
  }

  removeBot(room: Room, seat: number): void {
    if (seat < 0 || seat >= SEAT_COUNT) return;
    room.seats[seat].bot = null;
    this.touch(room);
  }

  // 重连定位：座位命中返回 seat，旁观命中返回 -1
  findByPlayerId(playerId: string): { room: Room; seat: number } | null {
    for (const room of this.rooms.values()) {
      for (let i = 0; i < room.seats.length; i++) {
        if (room.seats[i].player?.playerId === playerId) return { room, seat: i };
      }
      if (room.spectators.some((p) => p.playerId === playerId)) return { room, seat: -1 };
    }
    return null;
  }

  listOpenRooms(): RoomListItem[] {
    const items: RoomListItem[] = [];
    for (const room of this.rooms.values()) {
      if (room.phase !== 'waiting') continue;
      items.push({
        code: room.code,
        playerCount: room.seats.filter((s) => s.player !== null).length,
        hasPassword: room.password !== null,
        phase: room.phase,
      });
    }
    return items;
  }

  sweepIdle(ttlMinutes: number): void {
    const cutoff = Date.now() - ttlMinutes * 60 * 1000;
    for (const [code, room] of this.rooms) {
      if (room.lastActiveAt < cutoff) this.rooms.delete(code);
    }
  }
}
