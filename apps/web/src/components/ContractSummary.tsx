import type { RoomStateView } from '@shengji/shared';
import { describeContract } from '../lib/contract';
import CardFace from './CardFace';

type Props = {
  view: RoomStateView;
};

export default function ContractSummary({ view }: Props) {
  const summary = describeContract(view);
  return (
    <section className={`contract-summary contract-${summary.mode}`} aria-label="本局主牌与叫主状态">
      <div className="contract-copy">
        <span className="contract-title">{summary.title}</span>
        <span className="contract-detail">{summary.detail}</span>
      </div>
      {summary.cards.length > 0 && (
        <div className="contract-cards" aria-label="亮出的牌">
          {summary.cards.map((card) => (
            <CardFace key={card.id} card={card} small />
          ))}
        </div>
      )}
    </section>
  );
}
