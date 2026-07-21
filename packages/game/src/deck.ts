import type { Card, Rank, Suit } from '@shengji/shared';
import { HAND_SIZE, KITTY_SIZE, SEAT_COUNT, DECK_COUNT } from '@shengji/shared';

export type Rng = () => number;

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// 两副牌共 108 张；id 形如 'S-5-0' / 'joker-big-1'（末位为副本序号）
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let copy = 0; copy < DECK_COUNT; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `${suit}-${rank}-${copy}`, kind: 'suit', suit, rank });
      }
    }
    deck.push({ id: `joker-small-${copy}`, kind: 'joker', joker: 'small' });
    deck.push({ id: `joker-big-${copy}`, kind: 'joker', joker: 'big' });
  }
  return deck;
}

// Fisher–Yates，纯函数：不修改入参
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function deal(deck: Card[]): { hands: Card[][]; kitty: Card[] } {
  const hands: Card[][] = [];
  for (let seat = 0; seat < SEAT_COUNT; seat++) {
    hands.push(deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE));
  }
  const kitty = deck.slice(SEAT_COUNT * HAND_SIZE, SEAT_COUNT * HAND_SIZE + KITTY_SIZE);
  return { hands, kitty };
}
