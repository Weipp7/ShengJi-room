export const QUICK_START_PENDING_KEY = 'shengji:quickStartPending';
export const QUICK_START_ROOM_KEY = 'shengji:quickStartRoom';

const session = (): Storage | null => (typeof window === 'undefined' ? null : window.sessionStorage);

export function markQuickStartRequested(): void {
  const store = session();
  if (!store) return;
  store.setItem(QUICK_START_PENDING_KEY, '1');
  store.removeItem(QUICK_START_ROOM_KEY);
}

export function quickStartRoomCode(currentRoomCode: string): string | null {
  const store = session();
  if (!store) return null;
  if (store.getItem(QUICK_START_ROOM_KEY) === currentRoomCode) return currentRoomCode;
  if (store.getItem(QUICK_START_PENDING_KEY) === '1') return currentRoomCode;
  return null;
}

export function bindQuickStartRoom(roomCode: string): void {
  const store = session();
  if (!store) return;
  store.removeItem(QUICK_START_PENDING_KEY);
  store.setItem(QUICK_START_ROOM_KEY, roomCode);
}

export function clearQuickStartPending(): void {
  session()?.removeItem(QUICK_START_PENDING_KEY);
}

export function isQuickStartRoom(roomCode: string): boolean {
  return session()?.getItem(QUICK_START_ROOM_KEY) === roomCode;
}

export function clearQuickStartSession(): void {
  const store = session();
  if (!store) return;
  store.removeItem(QUICK_START_PENDING_KEY);
  store.removeItem(QUICK_START_ROOM_KEY);
}
