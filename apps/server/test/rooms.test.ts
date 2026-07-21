import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/rooms';

describe('RoomManager', () => {
  it('create/join/password/seat/bot/reconnect lifecycle', () => {
    const m = new RoomManager();
    const room = m.createRoom('p1', 'Alice', 'secret');
    expect(room.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(room.seats[0].player?.playerId).toBe('p1');
    expect(room.hostPlayerId).toBe('p1');

    expect(m.joinRoom('ZZZZZ', 'p2', 'Bob', null)).toMatchObject({
      ok: false,
      code: 'room-not-found',
    });
    expect(m.joinRoom(room.code, 'p2', 'Bob', 'wrong')).toMatchObject({
      ok: false,
      code: 'wrong-password',
    });
    expect(m.joinRoom(room.code, 'p2', 'Bob', 'secret').ok).toBe(true);

    expect(m.takeSeat(room, 'p2', 0)).toMatchObject({ ok: false, code: 'seat-taken' });
    expect(m.takeSeat(room, 'p2', 1).ok).toBe(true);
    expect(room.seats[1].player?.playerId).toBe('p2');

    expect(m.addBot(room, 1).ok).toBe(false);
    expect(m.addBot(room, 2).ok).toBe(true);
    expect(room.seats[2].bot).not.toBeNull();
    expect(m.takeSeat(room, 'p2', 2)).toMatchObject({ ok: false, code: 'seat-taken' });
    m.removeBot(room, 2);
    expect(room.seats[2].bot).toBeNull();

    expect(m.findByPlayerId('p2')).toMatchObject({ seat: 1 });
    m.leaveSeat(room, 'p2');
    expect(room.seats[1].player).toBeNull();
    expect(m.findByPlayerId('p2')).toMatchObject({ seat: -1 }); // 旁观席
    expect(m.findByPlayerId('nobody')).toBeNull();

    const listing = m.listOpenRooms();
    expect(listing).toHaveLength(1);
    expect(listing[0]).toMatchObject({ code: room.code, hasPassword: true, playerCount: 1 });
  });

  it('joining twice with same playerId does not duplicate', () => {
    const m = new RoomManager();
    const room = m.createRoom('p1', 'Alice', null);
    m.joinRoom(room.code, 'p2', 'Bob', null);
    m.joinRoom(room.code, 'p2', 'Bob', null);
    expect(room.spectators.filter((p) => p.playerId === 'p2')).toHaveLength(1);
  });

  it('sweepIdle removes stale rooms', () => {
    const m = new RoomManager();
    const room = m.createRoom('p1', 'Alice', null);
    room.lastActiveAt = Date.now() - 61 * 60 * 1000;
    m.sweepIdle(60);
    expect(m.listOpenRooms()).toHaveLength(0);
    expect(m.findByPlayerId('p1')).toBeNull();
  });
});
