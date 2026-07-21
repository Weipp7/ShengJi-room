import { describe, it, expect } from 'vitest';
import type { Card } from '@shengji/shared';
import { buildDeck, shuffle, deal } from '../src/deck';
import { mulberry32 } from './helpers';

describe('buildDeck', () => {
  it('deck has 108 cards, 4 jokers, unique ids', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    expect(deck.filter((c) => c.kind === 'joker')).toHaveLength(4);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });

  it('every suit-rank appears exactly twice', () => {
    const deck = buildDeck();
    const key = (c: Card) => (c.kind === 'suit' ? `${c.suit}${c.rank}` : c.joker);
    const counts = new Map<string, number>();
    for (const c of deck) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });
});

describe('deal', () => {
  it('4 hands of 25 and kitty of 8, no overlap', () => {
    const { hands, kitty } = deal(buildDeck());
    expect(hands.map((h) => h.length)).toEqual([25, 25, 25, 25]);
    expect(kitty).toHaveLength(8);
    const all = [...hands.flat(), ...kitty];
    expect(new Set(all.map((c) => c.id)).size).toBe(108);
  });
});

describe('shuffle', () => {
  it('deterministic with seeded rng and keeps all cards', () => {
    const a = shuffle(buildDeck(), mulberry32(42));
    const b = shuffle(buildDeck(), mulberry32(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(new Set(a.map((c) => c.id)).size).toBe(108);
  });

  it('different seeds give different orders', () => {
    const a = shuffle(buildDeck(), mulberry32(1));
    const b = shuffle(buildDeck(), mulberry32(2));
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id));
  });

  it('does not mutate input', () => {
    const deck = buildDeck();
    const before = deck.map((c) => c.id);
    shuffle(deck, mulberry32(3));
    expect(deck.map((c) => c.id)).toEqual(before);
  });
});
