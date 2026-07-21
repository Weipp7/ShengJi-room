import type { RoomStateView } from '@shengji/shared';

type Props = {
  view: RoomStateView;
  selectedCount: number;
  onBid: () => void;
  onPass: () => void;
  onBury: () => void;
  onPlay: () => void;
  onNextRound: () => void;
  onClear: () => void;
};

// 底部操作栏：按阶段与回合展示可用动作，非法操作交给服务端校验并提示
export default function ActionBar({
  view,
  selectedCount,
  onBid,
  onPass,
  onBury,
  onPlay,
  onNextRound,
  onClear,
}: Props) {
  const seated = view.yourSeat !== null;
  const isBidTurn = seated && view.biddingTurn === view.yourSeat;
  const isDealer = seated && view.dealerSeat === view.yourSeat;
  const isPlayTurn = seated && view.turnSeat === view.yourSeat;

  return (
    <div className="action-bar">
      {view.phase === 'bidding' && isBidTurn && (
        <>
          <button className="primary" disabled={selectedCount === 0} onClick={onBid}>
            亮主
          </button>
          <button onClick={onPass}>过</button>
        </>
      )}
      {view.phase === 'bidding' && seated && !isBidTurn && (
        <span className="muted">等待其他玩家叫主…</span>
      )}
      {view.phase === 'burying' &&
        (isDealer ? (
          <>
            <span className="bury-count">已选 {selectedCount}/8</span>
            <button className="primary" disabled={selectedCount !== 8} onClick={onBury}>
              确认埋牌
            </button>
          </>
        ) : (
          <span className="muted">等待庄家埋底…</span>
        ))}
      {view.phase === 'playing' &&
        (isPlayTurn ? (
          <button className="primary" disabled={selectedCount === 0} onClick={onPlay}>
            出牌
          </button>
        ) : (
          <span className="muted">等待其他玩家出牌…</span>
        ))}
      {view.phase === 'scoring' && seated && (
        <button className="primary" onClick={onNextRound}>
          下一局
        </button>
      )}
      {selectedCount > 0 && <button onClick={onClear}>清空选择</button>}
    </div>
  );
}
