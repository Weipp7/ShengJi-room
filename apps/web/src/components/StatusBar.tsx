import type { RoomStateView } from '@shengji/shared';
import { PHASE_TEXT, rankText, SUIT_SYMBOL } from '../lib/format';

type Props = {
  view: RoomStateView;
  onLeave: () => void;
};

// 顶部状态栏：房间码 / 阶段 / 级牌 / 主花色 / 庄家 / 闲家分数
export default function StatusBar({ view, onLeave }: Props) {
  const dealer = view.dealerSeat !== null ? view.seats[view.dealerSeat] : null;
  const activeSeat = view.phase === 'bidding' ? view.biddingTurn : view.turnSeat;
  const active = activeSeat !== null ? view.seats[activeSeat] : null;
  return (
    <div className="status-bar">
      <span className="status-item">
        房间 <b>{view.roomCode}</b>
      </span>
      <span className="status-item">{PHASE_TEXT[view.phase] ?? view.phase}</span>
      <span className="status-item">
        级牌 <b className="team-0-text">{rankText(view.teamLevels[0])}</b>/
        <b className="team-1-text">{rankText(view.teamLevels[1])}</b>
      </span>
      {view.trump && (
        <span className="status-item">
          主 <b>{view.trump.trumpSuit ? SUIT_SYMBOL[view.trump.trumpSuit] : '无主'}</b>{' '}
          {rankText(view.trump.level)}
        </span>
      )}
      {dealer && (
        <span className="status-item">
          庄 <b>👑{dealer.nickname}</b>
        </span>
      )}
      {(view.phase === 'playing' || view.phase === 'scoring') && (
        <span className="status-item">
          闲家 <b className="points">{view.defenderPoints}</b>/80 分
        </span>
      )}
      {active && (
        <span className="status-item turn-hint">
          轮到 <b>{activeSeat === view.yourSeat ? '你' : active.nickname}</b>
        </span>
      )}
      <span className="status-spacer" />
      <button className="mini" onClick={onLeave}>
        离开
      </button>
    </div>
  );
}
