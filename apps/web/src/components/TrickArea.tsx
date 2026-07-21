import type { RoomStateView, TrickPlayView } from '@shengji/shared';
import CardFace from './CardFace';

type Props = {
  view: RoomStateView;
  // 刚打完的一墩：非空时在中央驻留展示，代替实时 currentTrick
  settled: { plays: TrickPlayView[]; winnerSeat: number | null } | null;
};

// 与 SeatRing 一致：下（自己）→ 右 → 上 → 左
const POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

function playOf(trick: TrickPlayView[], seat: number): TrickPlayView | undefined {
  return trick.find((p) => p.seat === seat);
}

// 中央出牌区：十字布局展示本墩四家出牌，左上角小字回看上一墩
export default function TrickArea({ view, settled }: Props) {
  const anchor = view.yourSeat ?? 0;
  const trick = settled ? settled.plays : view.currentTrick;
  const winnerName =
    settled && settled.winnerSeat !== null ? view.seats[settled.winnerSeat]?.nickname : null;
  return (
    <div className={`trick-area ${settled ? 'settled' : ''}`}>
      {POSITIONS.map((pos, i) => {
        const seatIdx = (anchor + i) % 4;
        const play = playOf(trick, seatIdx);
        const isWinner = settled !== null && settled.winnerSeat === seatIdx;
        return (
          <div key={pos} className={`trick-slot trick-${pos} ${isWinner ? 'winner' : ''}`}>
            {play?.cards.map((card) => <CardFace key={card.id} card={card} small />)}
          </div>
        );
      })}
      {settled && (
        <div className="trick-caption">{winnerName ? `${winnerName} 收下这一墩` : '本墩结束'}</div>
      )}
      {view.lastTrick.length > 0 && (
        <div className="last-trick">
          <span className="muted">上一墩</span>
          {view.lastTrick.map((play) => (
            <div key={play.seat} className="last-trick-row">
              <span className="last-trick-seat">{view.seats[play.seat]?.nickname ?? ''}</span>
              {play.cards.map((card) => (
                <CardFace key={card.id} card={card} small />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
