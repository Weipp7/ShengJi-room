import { useStore } from './store';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import GameTable from './pages/GameTable';
import ErrorToast from './components/ErrorToast';

export default function App() {
  const { state, dismissError } = useStore();
  const isTable = state.view !== null && state.view.phase !== 'waiting';
  return (
    <>
      {isTable && <div className="portrait-mask">请旋转设备至横屏进行牌局</div>}
      {state.error && <ErrorToast error={state.error} onDismiss={dismissError} />}
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
