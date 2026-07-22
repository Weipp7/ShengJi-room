import { useMemo } from 'react';
import type { RoomStateView } from '@shengji/shared';
import { availableBids, type BidOption } from '@shengji/game';
import { SUIT_SYMBOL } from '../lib/format';
import { describeWaiting } from '../lib/waiting';
import type { PlayHint } from '../lib/playHint';

export type PendingAction = 'bid' | 'pass' | 'bury' | 'play' | 'next-round';

type Props = {
  view: RoomStateView;
  selectedCount: number;
  playHint?: PlayHint | null;
  hintAvailable?: boolean;
  pendingAction?: PendingAction | null;
  // 上一墩驻留展示中：暂不开放出牌，避免真人抢跑打乱驻留节奏
  holdActive: boolean;
  onBid: (cardIds: string[]) => void;
  onPass: () => void;
  onBury: () => void;
  onHint?: () => void;
  onPlay: () => void;
  onNextRound: () => void;
  onClear: () => void;
};

const SUITS = ['S', 'H', 'D', 'C'] as const;

function optionScore(option: BidOption): number {
  const category = option.kind.startsWith('big-joker') ? 3 : option.kind.startsWith('small-joker') ? 2 : 1;
  return option.cards.length * 10 + category;
}

function optionCountLabel(option: BidOption): string {
  const count = option.cards.length;
  return count === 1 ? '单' : count === 2 ? '对' : `${count}张`;
}

// 叫主花色选择器：能叫的点亮可点，不能叫的置暗；王对为无主
function BidOptions({
  view,
  disabled = false,
  onBid,
}: {
  view: RoomStateView;
  disabled?: boolean;
  onBid: (cardIds: string[]) => void;
}) {
  const options = useMemo(
    () => (view.trump ? availableBids(view.yourHand, view.trump.level, view.currentBid) : []),
    [view.yourHand, view.trump, view.currentBid],
  );
  const bySuit = new Map<string, BidOption>();
  for (const o of options) {
    const key = o.suit ?? 'NT';
    // 同槽位保留最强（花色取最多张；NT 取同张数下大王优先）
    const current = bySuit.get(key);
    if (!current || optionScore(o) > optionScore(current)) bySuit.set(key, o);
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
            disabled={disabled || !opt}
            title={opt ? `亮${optionCountLabel(opt)}${SUIT_SYMBOL[s]}级牌` : '没有可亮的级牌'}
            onClick={() => opt && pick(opt)}
          >
            {SUIT_SYMBOL[s]}
            {opt && optionCountLabel(opt) !== '单' && <span className="bid-pair-tag">{optionCountLabel(opt)}</span>}
          </button>
        );
      })}
      {(() => {
        const nt = bySuit.get('NT');
        return (
          <button
            className={`bid-option bid-nt ${nt ? 'lit' : 'dim'}`}
            disabled={disabled || !nt}
            title={
              nt
                ? `${nt.kind.startsWith('big-joker') ? '大' : '小'}王${optionCountLabel(nt)}叫无主`
                : '没有可亮的王'
            }
            onClick={() => nt && pick(nt)}
          >
            王
            {nt && (
              <span className="bid-pair-tag">
                {nt.kind.startsWith('big-joker') ? '大' : '小'}
                {optionCountLabel(nt)}
              </span>
            )}
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
  playHint = null,
  hintAvailable = false,
  pendingAction = null,
  holdActive,
  onBid,
  onPass,
  onBury,
  onHint,
  onPlay,
  onNextRound,
  onClear,
}: Props) {
  const seated = view.yourSeat !== null;
  const isBidTurn = seated && view.biddingTurn === view.yourSeat;
  const isDealer = seated && view.dealerSeat === view.yourSeat;
  const isPlayTurn = seated && view.turnSeat === view.yourSeat;
  const actionPending = pendingAction !== null;
  const playButtonText = selectedCount >= 4 ? '出牌 / 甩牌' : '出牌';

  return (
    <div className="action-bar">
      {view.phase === 'bidding' && isBidTurn && (
        <>
          <BidOptions view={view} disabled={actionPending} onBid={onBid} />
          <button disabled={actionPending} onClick={onPass}>
            {pendingAction === 'pass' || pendingAction === 'bid' ? '处理中…' : '过'}
          </button>
        </>
      )}
      {view.phase === 'bidding' && seated && !isBidTurn && (
        <span className="muted">{describeWaiting(view, false)}</span>
      )}
      {view.phase === 'burying' &&
        (isDealer ? (
          <>
            {view.biddingStage === 'post-dealer' && (
              <>
                <span className="muted">庄后可反</span>
                <BidOptions view={view} onBid={onBid} />
              </>
            )}
            <span className="bury-count">已选 {selectedCount}/8</span>
            <button className="primary" disabled={selectedCount !== 8 || actionPending} onClick={onBury}>
              {pendingAction === 'bury' ? '处理中…' : '确认埋牌'}
            </button>
          </>
        ) : (
          <span className="muted">{describeWaiting(view, false)}</span>
        ))}
      {view.phase === 'playing' &&
        (holdActive ? (
          <span className="muted">{describeWaiting(view, true)}</span>
        ) : isPlayTurn ? (
          <>
            {(hintAvailable || playHint) && (
              <button
                className="hint-button"
                disabled={!hintAvailable || !onHint || actionPending}
                onClick={onHint}
                title={hintAvailable ? '按当前局面推荐一手牌' : '当前没有可用提示'}
              >
                提示
              </button>
            )}
            <button className="primary" disabled={selectedCount === 0 || actionPending} onClick={onPlay}>
              {pendingAction === 'play' ? '处理中…' : playButtonText}
            </button>
            {playHint && <span className="play-hint-copy">推荐：{playHint.message}</span>}
          </>
        ) : (
          <span className="muted">{describeWaiting(view, false)}</span>
        ))}
      {view.phase === 'scoring' && seated && (
        <button className="primary" disabled={actionPending} onClick={onNextRound}>
          {pendingAction === 'next-round' ? '处理中…' : '下一局'}
        </button>
      )}
      {selectedCount > 0 && (
        <button disabled={actionPending} onClick={onClear}>
          清空选择
        </button>
      )}
    </div>
  );
}
