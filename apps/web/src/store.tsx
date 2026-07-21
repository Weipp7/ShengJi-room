import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react';
import type { ChatMessagePayload, GameErrorPayload, RoomStateView } from '@shengji/shared';
import { C2S, S2C } from '@shengji/shared';
import { getNickname, getPlayerId, getSocket, ROOM_CODE_KEY } from './socket';

export type ConnStatus = 'connecting' | 'connected' | 'disconnected';

export type StoreState = {
  view: RoomStateView | null;
  error: string | null;
  chat: ChatMessagePayload[];
  status: ConnStatus;
};

type Action =
  | { type: 'view'; view: RoomStateView }
  | { type: 'error'; error: string }
  | { type: 'clear-error' }
  | { type: 'chat'; msg: ChatMessagePayload }
  | { type: 'status'; status: ConnStatus }
  | { type: 'reset' };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'view':
      return { ...state, view: action.view };
    case 'error':
      return { ...state, error: action.error };
    case 'clear-error':
      return { ...state, error: null };
    case 'chat':
      return { ...state, chat: [...state.chat, action.msg].slice(-100) };
    case 'status':
      return { ...state, status: action.status };
    case 'reset':
      return { ...state, view: null, chat: [] };
  }
}

const ERROR_TEXT: Record<string, string> = {
  'room-not-found': '房间不存在',
  'wrong-password': '房间密码错误',
  'seat-taken': '该座位已被占用',
  'seats-not-full': '4 个座位坐满后才能开始',
  'not-host': '只有房主可以进行此操作',
  'wrong-phase': '当前阶段不能进行此操作',
  'wrong-turn': '还没轮到你',
  'invalid-bid': '亮主不合法',
  'cards-not-in-hand': '所选牌不在手牌中',
  'invalid-combo': '所选牌不构成合法牌型（单张/对子/拖拉机）',
  'wrong-count': '出牌张数必须与领出相同',
  'must-follow-suit': '必须跟随领出花色',
  'must-play-pair': '有对子时必须出对子',
  'must-play-tractor': '有拖拉机时必须出拖拉机',
  'not-dealer': '只有庄家可以埋底',
  'bad-bury-count': '必须埋 8 张底牌',
  'not-seated': '请先入座',
  'not-in-room': '请先加入房间',
};

function errorText(e: GameErrorPayload): string {
  return ERROR_TEXT[e.code] ?? `操作失败（${e.code}）`;
}

type StoreContextValue = {
  state: StoreState;
  leaveRoom: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    view: null,
    error: null,
    chat: [],
    status: 'connecting',
  });

  useEffect(() => {
    const socket = getSocket();
    let errorTimer: number | undefined;

    const onState = (view: RoomStateView) => {
      localStorage.setItem(ROOM_CODE_KEY, view.roomCode);
      dispatch({ type: 'view', view });
    };
    const onError = (e: GameErrorPayload) => {
      if (e.code === 'room-not-found') localStorage.removeItem(ROOM_CODE_KEY);
      dispatch({ type: 'error', error: errorText(e) });
      window.clearTimeout(errorTimer);
      errorTimer = window.setTimeout(() => dispatch({ type: 'clear-error' }), 3000);
    };
    const onChat = (msg: ChatMessagePayload) => dispatch({ type: 'chat', msg });
    const onEnded = () => {
      localStorage.removeItem(ROOM_CODE_KEY);
      dispatch({ type: 'reset' });
    };
    const onConnect = () => {
      dispatch({ type: 'status', status: 'connected' });
      // 刷新/断线后自动回到原房间（服务端按 playerId 恢复座位）
      const code = localStorage.getItem(ROOM_CODE_KEY);
      if (code) {
        socket.emit(C2S.RoomJoin, {
          roomCode: code,
          nickname: getNickname() || '玩家',
          playerId: getPlayerId(),
        });
      }
    };
    const onDisconnect = () => dispatch({ type: 'status', status: 'disconnected' });

    socket.on(S2C.RoomState, onState);
    socket.on(S2C.GameError, onError);
    socket.on(S2C.ChatMessage, onChat);
    socket.on(S2C.RoomEnded, onEnded);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();

    return () => {
      window.clearTimeout(errorTimer);
      socket.off(S2C.RoomState, onState);
      socket.off(S2C.GameError, onError);
      socket.off(S2C.ChatMessage, onChat);
      socket.off(S2C.RoomEnded, onEnded);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const leaveRoom = useCallback(() => {
    getSocket().emit(C2S.RoomLeave, {});
    localStorage.removeItem(ROOM_CODE_KEY);
    dispatch({ type: 'reset' });
  }, []);

  return <StoreContext.Provider value={{ state, leaveRoom }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
