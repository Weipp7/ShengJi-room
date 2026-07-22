import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindQuickStartRoom,
  clearQuickStartPending,
  clearQuickStartSession,
  isQuickStartRoom,
  markQuickStartRequested,
  quickStartRoomCode,
  QUICK_START_PENDING_KEY,
  QUICK_START_ROOM_KEY,
} from '../src/lib/quickStart';

describe('quick start session flags', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    const storage = {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (key: string) => data.get(key) ?? null,
      key: (index: number) => [...data.keys()][index] ?? null,
      removeItem: (key: string) => data.delete(key),
      setItem: (key: string, value: string) => data.set(key, String(value)),
    } satisfies Storage;
    vi.stubGlobal('window', { sessionStorage: storage });
  });

  afterEach(() => {
    clearQuickStartSession();
    vi.unstubAllGlobals();
  });

  it('binds the next room after a quick start request', () => {
    markQuickStartRequested();

    expect(window.sessionStorage.getItem(QUICK_START_PENDING_KEY)).toBe('1');
    expect(quickStartRoomCode('ABCDE')).toBe('ABCDE');

    bindQuickStartRoom('ABCDE');

    expect(window.sessionStorage.getItem(QUICK_START_PENDING_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(QUICK_START_ROOM_KEY)).toBe('ABCDE');
    expect(quickStartRoomCode('ABCDE')).toBe('ABCDE');
    expect(quickStartRoomCode('FGHIJ')).toBeNull();
  });

  it('clears quick start state after auto start or leaving the room', () => {
    markQuickStartRequested();
    bindQuickStartRoom('ABCDE');

    clearQuickStartSession();

    expect(quickStartRoomCode('ABCDE')).toBeNull();
    expect(window.sessionStorage.getItem(QUICK_START_PENDING_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(QUICK_START_ROOM_KEY)).toBeNull();
  });

  it('keeps the bound quick room after launch so scoring can auto continue', () => {
    markQuickStartRequested();
    bindQuickStartRoom('ABCDE');

    clearQuickStartPending();

    expect(window.sessionStorage.getItem(QUICK_START_PENDING_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(QUICK_START_ROOM_KEY)).toBe('ABCDE');
    expect(isQuickStartRoom('ABCDE')).toBe(true);
    expect(isQuickStartRoom('FGHIJ')).toBe(false);
  });
});
