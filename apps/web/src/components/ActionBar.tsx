import { useEffect, useMemo, useState } from 'react';
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
  if (option.kind === 'big-joker-pair') return 60;
  if (option.kind === 'small-joker-pair') return 50;
  const suitStrength = { D: 1, C: 2, H: 3, S: 4 } as const;
  return option.cards.length * 10 + (option.suit ? suitStrength[option.suit] : 0);
}

function optionCountLabel(option: BidOption): string {
  const count = option.cards.length;
  return count === 1 ? '单' : count === 2 ? '对' : `${count}张`;
}

// 叫主花色选择器：能叫的点亮可点，不能叫的置暗；王对为无主
function BidOptions({
  view,
  disabled = false,
  blocked = false,
  onBid,
}: {
  view: RoomStateView;
  disabled?: boolean;
  blocked?: boolean;
  onBid: (cardIds: string[]) => void;
}) {
  const options = useMemo(
    () =>
      view.trump && !blocked
        ? availableBids(view.yourHand, view.trump.level, view.currentBid, {
            counterOnly: view.biddingStage === 'post-bury',
          })
        : [],
    [view.yourHand, view.trump, view.currentBid, view.biddingStage, blocked],
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
            disabled={disabled || blocked || !opt}
            title={
              blocked
                ? '当前亮主者需等待其他玩家反主'
                : opt
                  ? `亮${optionCountLabel(opt)}${SUIT_SYMBOL[s]}级牌`
                  : '没有符合当前强度的级牌对子'
            }
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
            disabled={disabled || blocked || !nt}
            title={
              blocked
                ? '当前亮主者需等待其他玩家反主'
                : nt
                ? `${nt.kind.startsWith('big-joker') ? '大' : '小'}王${optionCountLabel(nt)}叫无主`
                : '没有符合当前强度的王对'
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

function useBidWindowSeconds(endsAt: number | null): number | null {
  const calculate = () =>
    endsAt == null ? null : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const [seconds, setSeconds] = useState<number | null>(calculate);
  useEffect(() => {
    setSeconds(calculate());
    if (endsAt == null) return;
    const timer = window.setInterval(() => setSeconds(calculate()), 200);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  return seconds;
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
  const isDealing = view.phase === 'bidding' && view.biddingStage === 'dealing';
  const isTimedPreKitty = view.phase === 'bidding' && view.biddingStage === 'pre-dealer';
  const currentBidderLocked =
    isTimedPreKitty && view.currentBid !== null && view.currentBid.seat === view.yourSeat;
  const canBid = seated && (isDealing || isTimedPreKitty || isBidTurn);
  const bidWindowSeconds = useBidWindowSeconds(view.bidWindowEndsAt);
  const bidWindowExpired = isTimedPreKitty && bidWindowSeconds === 0;
  const isBuryingPlayer = seated && view.buryingSeat === view.yourSeat;
  const isPlayTurn = seated && view.turnSeat === view.yourSeat;
  const actionPending = pendingAction !== null;
  const playButtonText =
    view.currentTrick.length === 0 && selectedCount >= 2 ? '出牌 / 甩牌' : '出牌';

  return (
    <div className="action-bar">
      {view.phase === 'bidding' && canBid && (
        <>
          <BidOptions
            view={view}
            disabled={actionPending || bidWindowExpired}
            blocked={currentBidderLocked}
            onBid={onBid}
          />
          {isDealing ? (
            <span className="muted">发牌中 {view.yourHand.length}/25 · 摸到级牌即可亮主</span>
          ) : isTimedPreKitty ? (
            <span className="muted">
              摸底前自由{view.currentBid ? '反主' : '亮主'} · 剩余 {bidWindowSeconds ?? 5} 秒
            </span>
          ) : (
            <button disabled={actionPending} onClick={onPass}>
              {pendingAction === 'pass' || pendingAction === 'bid' ? '处理中…' : '过'}
            </button>
          )}
        </>
      )}
      {view.phase === 'bidding' && seated && !canBid && (
        <span className="muted">{describeWaiting(view, false)}</span>
      )}
      {view.phase === 'burying' &&
        (isBuryingPlayer ? (
          <>
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
