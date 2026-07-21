import type { Card } from '@shengji/shared';
import CardFace from './CardFace';

type Props = {
  hand: Card[];
  selected: Set<string>;
  disabled?: boolean;
  onToggle: (id: string) => void;
};

// 底部手牌：横向叠放，点击选中上移
export default function HandFan({ hand, selected, disabled, onToggle }: Props) {
  return (
    <div className={`hand-fan ${disabled ? 'disabled' : ''}`}>
      {hand.map((card) => (
        <CardFace
          key={card.id}
          card={card}
          selected={selected.has(card.id)}
          onClick={disabled ? undefined : () => onToggle(card.id)}
        />
      ))}
    </div>
  );
}
