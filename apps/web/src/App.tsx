import { useStore } from './store';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import GameTable from './pages/GameTable';

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
        <GameTable />
      )}
    </>
  );
}
