import type { Rank } from './cards';

export const SEAT_COUNT = 4;
export const HAND_SIZE = 25;
export const KITTY_SIZE = 8;
export const DECK_COUNT = 2;
export const TOTAL_POINTS = 200;

export const teamOfSeat = (seat: number): 0 | 1 => (seat % 2) as 0 | 1;

const LEVEL_SEQ: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// 级牌序列 2..A 循环：A 之后回到 2
export const nextLevel = (level: Rank, delta: number): Rank => {
  const i = LEVEL_SEQ.indexOf(level);
  return LEVEL_SEQ[(i + delta) % LEVEL_SEQ.length];
};
