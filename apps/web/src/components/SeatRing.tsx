import type { RoomStateView } from '@shengji/shared';

type Props = {
  view: RoomStateView;
  onSit: (seat: number) => void;
  onAddBot?: (seat: number) => void;
  onRemoveBot?: (seat: number) => void;
};

// 展示位顺序：下（自己）→ 右 → 上 → 左
const POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

export default function SeatRing({ view, onSit, onAddBot, onRemoveBot }: Props) {
  const anchor = view.yourSeat ?? 0;
  return (
    <div className="seat-ring">
      <div className="table-felt">
        <div className="table-center muted">
          {view.seats.filter((s) => s.nickname !== null).length}/4 人
        </div>
      </div>
      {POSITIONS.map((pos, i) => {
        const seatIdx = (anchor + i) % 4;
        const seat = view.seats[seatIdx];
        const team = seatIdx % 2; // 0/2 蓝队，1/3 红队
        return (
          <div key={pos} className={`seat seat-${pos} team-${team}`}>
            {seat.nickname !== null ? (
              <div className={`seat-badge ${seat.connected ? '' : 'offline'}`}>
                <span className="seat-name">
                  {seat.isHost && <span className="host-star">★</span>}
                  {seat.nickname}
                </span>
                {seat.isBot && <span className="bot-tag">机器人</span>}
                {!seat.connected && !seat.isBot && <span className="bot-tag">离线</span>}
                {seat.isBot && onRemoveBot && (
                  <button className="mini" onClick={() => onRemoveBot(seatIdx)}>
                    移除
                  </button>
                )}
              </div>
            ) : (
              <div className="seat-badge empty">
                <span className="muted">空位</span>
                {view.yourSeat === null && (
                  <button className="mini" onClick={() => onSit(seatIdx)}>
                    入座
                  </button>
                )}
                {onAddBot && (
                  <button className="mini" onClick={() => onAddBot(seatIdx)}>
                    +机器人
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
