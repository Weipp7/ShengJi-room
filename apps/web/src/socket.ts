import { io, type Socket } from 'socket.io-client';

const PLAYER_ID_KEY = 'shengji:playerId';
const NICKNAME_KEY = 'shengji:nickname';
export const ROOM_CODE_KEY = 'shengji:roomCode';

// 玩家身份：localStorage 持久化，刷新/重连后仍然是同一人
export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? '';
}

export function setNickname(name: string): void {
  localStorage.setItem(NICKNAME_KEY, name);
}

let socket: Socket | null = null;

// 单例连接：dev 走 vite 代理同源，生产可用 VITE_SERVER_URL 指定
export function getSocket(): Socket {
  if (socket) return socket;
  const url = import.meta.env.VITE_SERVER_URL as string | undefined;
  socket = url
    ? io(url, { transports: ['websocket'] })
    : io({ transports: ['websocket'] });
  return socket;
}
