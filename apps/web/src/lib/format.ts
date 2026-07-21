import type { Rank, Suit } from '@shengji/shared';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankText(rank: Rank): string {
  return RANK_TEXT[rank] ?? String(rank);
}

export const PHASE_TEXT: Record<string, string> = {
  waiting: '等待中',
  bidding: '叫主',
  burying: '埋底',
  playing: '出牌',
  scoring: '结算',
};
