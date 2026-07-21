import { useStore } from './store';
import Lobby from './pages/Lobby';
import Room from './pages/Room';

// 牌桌在 Task 15 实现，此处先占位
function GameTablePlaceholder() {
  const { state, leaveRoom } = useStore();
  return (
    <div className="page center">
      <h2>对局进行中…</h2>
      <p>牌桌界面将在下一任务实现（当前阶段：{state.view?.phase}）</p>
      <button onClick={leaveRoom}>离开房间</button>
    </div>
  );
}

export default function App() {
  const { state } = useStore();
  return (
    <>
      <div className="portrait-mask">请旋转设备至横屏进行游戏</div>
      {state.error && <div className="toast">{state.error}</div>}
      {!state.view ? (
        <Lobby />
      ) : state.view.phase === 'waiting' ? (
        <Room />
      ) : (
        <GameTablePlaceholder />
      )}
    </>
  );
}
