import type { RoomStateView } from '@shengji/shared';
import { PHASE_TEXT } from '../lib/format';

type Props = {
  view: RoomStateView;
  onLeave: () => void;
};

// 顶部状态栏：只保留房间级状态；本局契约事实由 ContractSummary 统一展示。
export default function StatusBar({ view, onLeave }: Props) {
  const activeSeat =
    view.phase === 'bidding'
      ? view.biddingTurn
      : view.phase === 'burying'
        ? view.buryingSeat
        : view.turnSeat;
  const active = activeSeat !== null ? view.seats[activeSeat] : null;
  return (
    <div className="status-bar">
      <span className="status-item">
        房间 <b>{view.roomCode}</b>
      </span>
      <span className={`status-item room-rule-badge ${view.chaodiEnabled ? 'on' : ''}`}>
        {view.chaodiEnabled ? '炒底 ON' : '炒底 OFF'}
      </span>
      <span className="status-item">
        {view.biddingStage === 'dealing'
          ? '发牌中'
          : view.biddingStage === 'post-bury'
            ? '埋底后反主'
            : PHASE_TEXT[view.phase] ?? view.phase}
      </span>
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
