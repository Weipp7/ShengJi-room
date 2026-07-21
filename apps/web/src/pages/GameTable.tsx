import { useEffect, useMemo, useRef, useState } from 'react';
import type { TrickPlayView } from '@shengji/shared';
import { C2S } from '@shengji/shared';
import { useStore } from '../store';
import { getSocket } from '../socket';
import { displaySort } from '../lib/handSort';
import StatusBar from '../components/StatusBar';
import TrickArea from '../components/TrickArea';
import HandFan from '../components/HandFan';
import ActionBar from '../components/ActionBar';
import ResultModal from '../components/ResultModal';
import ChatPanel from '../components/ChatPanel';

// 与 SeatRing 一致的旋转映射
const POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

// 对局牌桌：状态栏 + 座位环 + 出牌区 + 手牌 + 操作栏
export default function GameTable() {
  const { state, leaveRoom } = useStore();
  const view = state.view!;
  const socket = getSocket();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultDismissed, setResultDismissed] = useState(false);
  // 每墩打完：完整一墩在中央驻留 3s 再切回实时牌面
  const [settled, setSettled] = useState<{ plays: TrickPlayView[]; winnerSeat: number | null } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);

  // 手牌变化（出牌/埋牌成功）时剔除已不在手中的选择；阶段切换时清空
  const prevPhase = useRef(view.phase);
  useEffect(() => {
    if (prevPhase.current !== view.phase) {
      prevPhase.current = view.phase;
      setSelected(new Set());
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
  const cardIds = () => [...selected];

  // lastTrick 变化 = 刚结了一墩；此时广播里 turnSeat 即赢家（scoring 时为 null）
  const lastTrickKey = view.lastTrick.map((p) => p.cards.map((c) => c.id).join(',')).join('|');
  useEffect(() => {
    if (view.lastTrick.length < 4) {
      setSettled(null);
      return;
    }
    setSettled({ plays: view.lastTrick, winnerSeat: view.turnSeat });
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setSettled(null), 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTrickKey]);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const anchor = view.yourSeat ?? 0;
  const activeSeat = view.phase === 'bidding' ? view.biddingTurn : view.turnSeat;
  const canSelect =
    view.yourSeat !== null && (view.phase === 'burying' || view.phase === 'playing');

  return (
    <div className="game-table">
      <StatusBar view={view} onLeave={leaveRoom} />
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
              {!seat.connected && !seat.isBot && seat.nickname && <span className="bot-tag">离线</span>}
            </div>
          );
        })}
        <TrickArea view={view} settled={settled} />
      </div>
      <ActionBar
        view={view}
        selectedCount={selected.size}
        onBid={(ids) => socket.emit(C2S.BidReveal, { cardIds: ids })}
        onPass={() => socket.emit(C2S.BidPass, {})}
        onBury={() => socket.emit(C2S.KittyBury, { cardIds: cardIds() })}
        onPlay={() => socket.emit(C2S.TrickPlay, { cardIds: cardIds() })}
        onNextRound={() => socket.emit(C2S.RoundNext, {})}
        onClear={() => setSelected(new Set())}
      />
      <HandFan hand={hand} selected={selected} disabled={!canSelect} onToggle={toggle} />
      {view.phase === 'scoring' && !resultDismissed && settled === null && (
        <ResultModal
          view={view}
          onNextRound={() => socket.emit(C2S.RoundNext, {})}
          onDismiss={() => setResultDismissed(true)}
        />
      )}
      <ChatPanel />
    </div>
  );
}
