import type { Card, Suit } from '@shengji/shared';

const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_TEXT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

type Props = {
  card: Card;
  selected?: boolean;
  small?: boolean;
  onClick?: () => void;
};

export default function CardFace({ card, selected, small, onClick }: Props) {
  const isRed =
    card.kind === 'joker' ? card.joker === 'big' : card.suit === 'H' || card.suit === 'D';
  const cls = `card-face ${isRed ? 'red' : 'black'} ${selected ? 'selected' : ''} ${small ? 'small' : ''}`;
  if (card.kind === 'joker') {
    return (
      <div className={cls} onClick={onClick}>
        <span className="card-corner">{card.joker === 'big' ? '★' : '☆'}</span>
        <span className="card-joker-label">王</span>
      </div>
    );
  }
  const rank = RANK_TEXT[card.rank] ?? String(card.rank);
  return (
    <div className={cls} onClick={onClick}>
      <span className="card-corner">
        {rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="card-suit-big">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}
