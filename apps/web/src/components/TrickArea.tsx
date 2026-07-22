import { useState } from 'react';
import type { RoomStateView, TrickPlayView } from '@shengji/shared';
import CardFace from './CardFace';
import { SUIT_SYMBOL } from '../lib/format';

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

// 中央出牌区：十字布局展示本墩四家出牌，左上角按钮按需展开回看上一墩
export default function TrickArea({ view, settled }: Props) {
  const anchor = view.yourSeat ?? 0;
  const [lastOpen, setLastOpen] = useState(false);
  const trick = settled ? settled.plays : view.currentTrick;
  const winnerName =
    settled && settled.winnerSeat !== null ? view.seats[settled.winnerSeat]?.nickname : null;
  return (
    <div className={`trick-area ${settled ? 'settled' : ''}`}>
      {POSITIONS.map((pos, i) => {
        const seatIdx = (anchor + i) % 4;
        const play = playOf(trick, seatIdx);
        const isWinner = settled !== null && settled.winnerSeat === seatIdx;
        const isLead = trick[0]?.seat === seatIdx;
        const seatName = view.seats[seatIdx]?.nickname ?? `座位${seatIdx + 1}`;
        return (
          <div key={pos} className={`trick-slot trick-${pos} ${isWinner ? 'winner' : ''}`}>
            {play && (
              <span className="trick-slot-name">
                {seatIdx === view.yourSeat ? '你' : seatName}
                {isLead ? ' 领出' : ''}
              </span>
            )}
            <div className="trick-slot-cards">
              {play?.cards.map((card) => <CardFace key={card.id} card={card} small />)}
            </div>
          </div>
        );
      })}
      {settled && (
        <div className="trick-caption">{winnerName ? `${winnerName} 收下这一墩` : '本墩结束'}</div>
      )}
      {view.phase === 'bidding' && (
        <div className="bid-status">
          {view.currentBid ? (
            <>
              <span className="bid-status-text">
                当前叫主：
                <b>
                  {view.currentBid.seat === view.yourSeat
                    ? '你'
                    : (view.seats[view.currentBid.seat]?.nickname ?? `座位${view.currentBid.seat + 1}`)}
                </b>
                {view.currentBid.suit ? `（主 ${SUIT_SYMBOL[view.currentBid.suit]}）` : '（无主）'}
              </span>
              <span className="bid-status-cards">
                {view.currentBid.cards.map((card) => (
                  <CardFace key={card.id} card={card} small />
                ))}
              </span>
            </>
          ) : (
            <span className="bid-status-text bid-status-empty">还没有人亮主</span>
          )}
        </div>
      )}
      {view.lastTrick.length > 0 && (
        <div className="last-trick-corner">
          <button className="last-trick-toggle" onClick={() => setLastOpen((v) => !v)}>
            {lastOpen ? '收起' : '上一墩'}
          </button>
          {lastOpen && (
            <div className="last-trick">
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
      )}
    </div>
  );
}
