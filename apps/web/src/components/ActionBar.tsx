import { useMemo } from 'react';
import type { RoomStateView } from '@shengji/shared';
import { availableBids, type BidOption } from '@shengji/game';
import { SUIT_SYMBOL } from '../lib/format';

type Props = {
  view: RoomStateView;
  selectedCount: number;
  // 上一墩驻留展示中：暂不开放出牌，避免真人抢跑打乱驻留节奏
  holdActive: boolean;
  onBid: (cardIds: string[]) => void;
  onPass: () => void;
  onBury: () => void;
  onPlay: () => void;
  onNextRound: () => void;
  onClear: () => void;
};

const SUITS = ['S', 'H', 'D', 'C'] as const;

// 叫主花色选择器：能叫的点亮可点，不能叫的置暗；王对为无主
function BidOptions({ view, onBid }: { view: RoomStateView; onBid: (cardIds: string[]) => void }) {
  const options = useMemo(
    () => (view.trump ? availableBids(view.yourHand, view.trump.level, view.currentBid) : []),
    [view.yourHand, view.trump, view.currentBid],
  );
  const bySuit = new Map<string, BidOption>();
  for (const o of options) {
    const key = o.suit ?? 'NT';
    // 同槽位保留最强（availableBids 每花色已取最强；NT 取大王对优先）
    if (!bySuit.has(key) || o.kind === 'big-joker-pair') bySuit.set(key, o);
  }
  const pick = (o: BidOption) => onBid(o.cards.map((c) => c.id));
  return (
    <div className="bid-options">
      {SUITS.map((s) => {
        const opt = bySuit.get(s);
        return (
          <button
            key={s}
            className={`bid-option suit-btn-${s} ${opt ? 'lit' : 'dim'}`}
            disabled={!opt}
            title={opt ? `亮${opt.kind === 'suit-pair' ? '一对' : '单张'}${SUIT_SYMBOL[s]}级牌` : '没有可亮的级牌'}
            onClick={() => opt && pick(opt)}
          >
            {SUIT_SYMBOL[s]}
            {opt?.kind === 'suit-pair' && <span className="bid-pair-tag">对</span>}
          </button>
        );
      })}
      {(() => {
        const nt = bySuit.get('NT');
        return (
          <button
            className={`bid-option bid-nt ${nt ? 'lit' : 'dim'}`}
            disabled={!nt}
            title={nt ? `${nt.kind === 'big-joker-pair' ? '大' : '小'}王对叫无主` : '没有王对'}
            onClick={() => nt && pick(nt)}
          >
            王
            {nt && <span className="bid-pair-tag">{nt.kind === 'big-joker-pair' ? '大' : '小'}</span>}
          </button>
        );
      })()}
    </div>
  );
}

// 底部操作栏：按阶段与回合展示可用动作，非法操作交给服务端校验并提示
export default function ActionBar({
  view,
  selectedCount,
  holdActive,
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
          <BidOptions view={view} onBid={onBid} />
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
        (holdActive ? (
          <span className="muted">看牌中…</span>
        ) : isPlayTurn ? (
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
