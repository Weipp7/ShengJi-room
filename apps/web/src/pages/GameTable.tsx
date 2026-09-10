import { useEffect, useMemo, useRef, useState } from 'react';
import type { RoomStateView, TrickPlayView } from '@shengji/shared';
import { C2S } from '@shengji/shared';
import { useStore } from '../store';
import { getSocket } from '../socket';
import { displaySort } from '../lib/handSort';
import { deriveAnnouncements, type Announcement } from '../lib/announcements';
import StatusBar from '../components/StatusBar';
import TrickArea from '../components/TrickArea';
import HandFan from '../components/HandFan';
import ActionBar, { type PendingAction } from '../components/ActionBar';
import ResultModal from '../components/ResultModal';
import ChatPanel from '../components/ChatPanel';
import AnnouncementBanner from '../components/AnnouncementBanner';
import ContractSummary from '../components/ContractSummary';
import { createPlayHint, playHintContextKey, type PlayHint } from '../lib/playHint';
import { nextSettledReview, settledReviewStateKey } from '../lib/settledReview';
import { clearQuickStartSession, isQuickStartRoom } from '../lib/quickStart';

// 与 SeatRing 一致的旋转映射
const POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

type ActivePlayHint = {
  hint: PlayHint;
  contextKey: string;
};

// 对局牌桌：状态栏 + 座位环 + 出牌区 + 手牌 + 操作栏
export default function GameTable() {
  const { state, leaveRoom } = useStore();
  const view = state.view!;
  const socket = getSocket();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playHint, setPlayHint] = useState<ActivePlayHint | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [autoContinueSeconds, setAutoContinueSeconds] = useState<number | null>(null);
  // 每墩打完：完整一墩在中央驻留 3s 再切回实时牌面
  const [settled, setSettled] = useState<{ plays: TrickPlayView[]; winnerSeat: number | null } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const autoContinueTimer = useRef<number | undefined>(undefined);
  const autoContinueTick = useRef<number | undefined>(undefined);
  const pendingActionRef = useRef<PendingAction | null>(null);

  // 公告流：对比前后 view 推导亮主/反主/定庄等事件，附带递增序号避免跨局同 id 被去重
  const [events, setEvents] = useState<Announcement[]>([]);
  const prevView = useRef<RoomStateView | null>(null);
  const eventSeq = useRef(0);
  const releasePendingAction = () => {
    pendingActionRef.current = null;
    setPendingAction(null);
  };
  const submitAction = (action: PendingAction, emit: () => void) => {
    if (pendingActionRef.current !== null) return;
    pendingActionRef.current = action;
    setPendingAction(action);
    emit();
  };

  useEffect(() => {
    releasePendingAction();
    const derived = deriveAnnouncements(prevView.current, view);
    prevView.current = view;
    if (derived.length > 0) {
      setEvents((prev) => [
        ...prev.slice(-8),
        ...derived.map((d) => ({ ...d, id: `${d.id}#${eventSeq.current++}` })),
      ]);
    }
  }, [view]);

  useEffect(() => {
    if (state.error !== null) releasePendingAction();
  }, [state.error?.id]);

  // 手牌变化（出牌/埋牌成功）时剔除已不在手中的选择；阶段切换时清空
  const prevPhase = useRef(view.phase);
  useEffect(() => {
    if (prevPhase.current !== view.phase) {
      prevPhase.current = view.phase;
      setSelected(new Set());
      setPlayHint(null);
      setResultDismissed(false);
      return;
    }
    setSelected((prev) => {
      const ids = new Set(view.yourHand.map((c) => c.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [view.phase, view.yourHand]);

  const hand = useMemo(() => displaySort(view.yourHand, view.trump), [view.yourHand, view.trump]);
  const quickStartRound = isQuickStartRoom(view.roomCode);
  const availablePlayHint = useMemo(() => createPlayHint(view), [view]);
  const currentPlayHintKey = useMemo(() => playHintContextKey(view), [view]);
  const activePlayHint = playHint?.contextKey === currentPlayHintKey ? playHint.hint : null;
  const hintedCards = useMemo(() => new Set(activePlayHint?.cardIds ?? []), [activePlayHint]);
  const cardIds = () => [...selected];
  const roundResultKey = view.roundResult
    ? `${view.roundResult.defenderPoints}:${view.roundResult.winnerTeam}:${view.roundResult.levelDelta}:${view.roundResult.nextDealerSeat}:${view.roundResult.nextLevels.join(',')}`
    : null;

  useEffect(() => {
    setPlayHint((prev) => (prev !== null && prev.contextKey !== currentPlayHintKey ? null : prev));
  }, [currentPlayHintKey]);

  // lastTrick 变化 = 刚结了一墩；lastTrickWinnerSeat 兜住 scoring 阶段 turnSeat=null 的最终一墩
  const settledReviewKey = settledReviewStateKey(view);
  useEffect(() => {
    const review = nextSettledReview(view);
    if (review === null) {
      setSettled(null);
      return;
    }
    setSettled(review);
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setSettled(null), 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledReviewKey]);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);
  useEffect(() => {
    if (settled !== null) setPlayHint(null);
  }, [settled]);

  const canSubmitAction = pendingAction === null && pendingActionRef.current === null;

  const toggle = (id: string) => {
    if (!canSubmitAction) return;
    setPlayHint(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPlayHint = () => {
    if (!canSubmitAction) return;
    if (availablePlayHint === null) return;
    setSelected(new Set(availablePlayHint.cardIds));
    setPlayHint({ hint: availablePlayHint, contextKey: currentPlayHintKey });
  };

  const playSelected = () => {
    if (!canSubmitAction) return;
    setPlayHint(null);
    submitAction('play', () => socket.emit(C2S.TrickPlay, { cardIds: cardIds() }));
  };

  const clearSelection = () => {
    if (!canSubmitAction) return;
    setPlayHint(null);
    setSelected(new Set());
  };

  const revealBid = (ids: string[]) => {
    if (!canSubmitAction) return;
    submitAction('bid', () => socket.emit(C2S.BidReveal, { cardIds: ids }));
  };

  const passBid = () => {
    if (!canSubmitAction) return;
    submitAction('pass', () => socket.emit(C2S.BidPass, {}));
  };

  const buryKitty = () => {
    if (!canSubmitAction) return;
    submitAction('bury', () => socket.emit(C2S.KittyBury, { cardIds: cardIds() }));
  };

  const nextRound = () => {
    if (!canSubmitAction) return;
    window.clearTimeout(autoContinueTimer.current);
    window.clearInterval(autoContinueTick.current);
    setAutoContinueSeconds(null);
    submitAction('next-round', () => socket.emit(C2S.RoundNext, {}));
  };

  useEffect(() => {
    window.clearTimeout(autoContinueTimer.current);
    window.clearInterval(autoContinueTick.current);
    setAutoContinueSeconds(null);

    if (!quickStartRound || view.phase !== 'scoring' || view.yourSeat === null || resultDismissed) return;

    setAutoContinueSeconds(10);
    autoContinueTick.current = window.setInterval(() => {
      setAutoContinueSeconds((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    autoContinueTimer.current = window.setTimeout(() => {
      if (pendingActionRef.current !== null) return;
      pendingActionRef.current = 'next-round';
      setPendingAction('next-round');
      getSocket().emit(C2S.RoundNext, {});
    }, 10000);

    return () => {
      window.clearTimeout(autoContinueTimer.current);
      window.clearInterval(autoContinueTick.current);
    };
  }, [quickStartRound, view.phase, view.yourSeat, resultDismissed, roundResultKey]);

  const leaveCurrentGame = () => {
    clearQuickStartSession();
    leaveRoom();
  };

  const dismissResult = () => {
    window.clearTimeout(autoContinueTimer.current);
    window.clearInterval(autoContinueTick.current);
    setAutoContinueSeconds(null);
    setResultDismissed(true);
  };

  const anchor = view.yourSeat ?? 0;
  const activeSeat =
    view.phase === 'bidding'
      ? view.biddingTurn
      : view.phase === 'burying'
        ? view.buryingSeat
        : view.turnSeat;
  const canSelect =
    canSubmitAction &&
    view.yourSeat !== null &&
    ((view.phase === 'burying' && view.buryingSeat === view.yourSeat) || view.phase === 'playing');

  return (
    <div className="game-table">
      <StatusBar view={view} onLeave={leaveCurrentGame} />
      <ContractSummary view={view} />
      <AnnouncementBanner incoming={events} />
      <div className="table-main">
        {POSITIONS.map((pos, i) => {
          const seatIdx = (anchor + i) % 4;
          const seat = view.seats[seatIdx];
          const isActive = activeSeat === seatIdx;
          return (
            <div
              key={pos}
              className={`player-badge player-${pos} team-${seatIdx % 2} ${isActive ? 'active' : ''} ${
                seat.connected || seat.isBot ? '' : 'offline'
              }`}
            >
              <span className="seat-name">
                {view.dealerSeat === seatIdx && <span className="dealer-crown">👑</span>}
                {seat.nickname ?? '空位'}
              </span>
              <span className="hand-count">{seat.handCount} 张</span>
              {isActive && <span className="thinking-tag">思考中…</span>}
              {!seat.connected && !seat.isBot && seat.nickname && <span className="bot-tag">离线</span>}
            </div>
          );
        })}
        <TrickArea view={view} settled={settled} />
      </div>
      <ActionBar
        view={view}
        selectedCount={selected.size}
        playHint={activePlayHint}
        hintAvailable={availablePlayHint !== null && settled === null}
        pendingAction={pendingAction}
        holdActive={settled !== null}
        onBid={revealBid}
        onPass={passBid}
        onBury={buryKitty}
        onHint={applyPlayHint}
        onPlay={playSelected}
        onNextRound={nextRound}
        onClear={clearSelection}
      />
      <HandFan hand={hand} selected={selected} hinted={hintedCards} disabled={!canSelect} onToggle={toggle} />
      {view.phase === 'scoring' && !resultDismissed && settled === null && (
        <ResultModal
          view={view}
          autoContinueSeconds={autoContinueSeconds}
          onNextRound={nextRound}
          onDismiss={dismissResult}
        />
      )}
      <ChatPanel />
    </div>
  );
}
