import { describe, it, expect } from 'vitest';
import { nextLevel, teamOfSeat, SEAT_COUNT, HAND_SIZE, KITTY_SIZE, TOTAL_POINTS } from '../src/constants';

describe('nextLevel', () => {
  it('normal up', () => expect(nextLevel(2, 1)).toBe(3));
  it('skip over A', () => expect(nextLevel(13, 3)).toBe(3)); // K+3 → A(14)→2→3
  it('A wraps to 2', () => expect(nextLevel(14, 1)).toBe(2));
  it('zero delta', () => expect(nextLevel(5, 0)).toBe(5));
});

describe('teamOfSeat', () => {
  it('0/2 team0, 1/3 team1', () => {
    expect(teamOfSeat(0)).toBe(0);
    expect(teamOfSeat(2)).toBe(0);
    expect(teamOfSeat(1)).toBe(1);
    expect(teamOfSeat(3)).toBe(1);
  });
});

describe('constants', () => {
  it('deal invariants: 4 * 25 + 8 = 108', () => {
    expect(SEAT_COUNT * HAND_SIZE + KITTY_SIZE).toBe(108);
    expect(TOTAL_POINTS).toBe(200);
  });
});
