import { useEffect } from 'react';
import { C2S } from '@shengji/shared';
import { getSocket } from '../socket';
import { useStore } from '../store';
import SeatRing from '../components/SeatRing';
import ChatPanel from '../components/ChatPanel';

export default function Room() {
  const { state, leaveRoom } = useStore();
  const view = state.view!;
  const isHost = view.yourSeat !== null && view.yourSeat === view.hostSeat;
  const allFilled = view.seats.every((s) => s.nickname !== null);

  // 「快速机器人局」：建房后自动给空位补机器人
  useEffect(() => {
    if (!isHost || sessionStorage.getItem('shengji:quickBots') !== '1') return;
    sessionStorage.removeItem('shengji:quickBots');
    const socket = getSocket();
    for (const s of view.seats) {
      if (s.nickname === null) socket.emit(C2S.BotAdd, { seat: s.seat });
    }
  }, [isHost, view.seats]);

  return (
    <div className="page room">
      <header className="room-header">
        <div>
          <span className="muted">房间码</span> <span className="room-code big">{view.roomCode}</span>
        </div>
        <div className="room-header-right">
          <span className={`conn-dot ${state.status}`} title={state.status} />
          <button onClick={leaveRoom}>离开房间</button>
        </div>
      </header>

      <SeatRing
        view={view}
        onSit={(seat) => getSocket().emit(C2S.SeatTake, { seat })}
        onAddBot={isHost ? (seat) => getSocket().emit(C2S.BotAdd, { seat }) : undefined}
        onRemoveBot={isHost ? (seat) => getSocket().emit(C2S.BotRemove, { seat }) : undefined}
      />

      <footer className="room-footer">
        {view.yourSeat !== null && (
          <button onClick={() => getSocket().emit(C2S.SeatLeave, {})}>起立旁观</button>
        )}
        {isHost && (
          <button
            className="primary"
            disabled={!allFilled}
            onClick={() => getSocket().emit(C2S.GameStart, {})}
          >
            {allFilled ? '开始游戏' : '等待坐满 4 人'}
          </button>
        )}
      </footer>

      <ChatPanel />
    </div>
  );
}
