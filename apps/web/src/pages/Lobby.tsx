import { useEffect, useState } from 'react';
import type { RoomListItem } from '@shengji/shared';
import { C2S } from '@shengji/shared';
import { getNickname, getPlayerId, getSocket, setNickname } from '../socket';
import { useStore } from '../store';

export default function Lobby() {
  const { state } = useStore();
  const [nick, setNick] = useState(getNickname());
  const [password, setPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPw, setJoinPw] = useState('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  // 大厅房间列表每 5 秒刷新
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      socket.emit(C2S.RoomList, {}, (items: RoomListItem[]) => setRooms(items));
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const requireNick = (): string | null => {
    const trimmed = nick.trim();
    if (!trimmed) {
      setHint('请先输入昵称');
      window.setTimeout(() => setHint(null), 2500);
      return null;
    }
    setNickname(trimmed);
    return trimmed;
  };

  const createRoom = (quickBots: boolean) => {
    const nickname = requireNick();
    if (!nickname) return;
    if (quickBots) sessionStorage.setItem('shengji:quickBots', '1');
    getSocket().emit(C2S.RoomCreate, {
      nickname,
      playerId: getPlayerId(),
      password: quickBots ? undefined : password.trim() || undefined,
    });
  };

  const joinRoom = (code: string, pw: string) => {
    const nickname = requireNick();
    if (!nickname) return;
    if (!code.trim()) {
      setHint('请输入房间码');
      window.setTimeout(() => setHint(null), 2500);
      return;
    }
    getSocket().emit(C2S.RoomJoin, {
      roomCode: code.trim().toUpperCase(),
      nickname,
      playerId: getPlayerId(),
      password: pw || undefined,
    });
  };

  return (
    <div className="page lobby">
      <header className="lobby-header">
        <h1>升级 Online</h1>
        <div className="lobby-header-right">
          <input
            className="nick-input"
            placeholder="你的昵称"
            maxLength={12}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
          />
          <span className={`conn-dot ${state.status}`} title={state.status} />
        </div>
      </header>

      {hint && <div className="toast">{hint}</div>}

      <div className="lobby-cards">
        <section className="card">
          <h2>快速机器人局</h2>
          <p>创建房间并自动补 3 个机器人，立即开打。</p>
          <button className="primary" onClick={() => createRoom(true)}>
            开一桌
          </button>
        </section>

        <section className="card">
          <h2>创建房间</h2>
          <input
            placeholder="房间密码（可选）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="primary" onClick={() => createRoom(false)}>
            创建房间
          </button>
          <hr />
          <h2>加入房间</h2>
          <input
            placeholder="房间码"
            maxLength={5}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <input
            placeholder="密码（如有）"
            value={joinPw}
            onChange={(e) => setJoinPw(e.target.value)}
          />
          <button onClick={() => joinRoom(joinCode, joinPw)}>加入</button>
        </section>
      </div>

      <section className="card room-list">
        <h2>开放中的房间</h2>
        {rooms.length === 0 ? (
          <p className="muted">暂时没有等待中的房间</p>
        ) : (
          <ul>
            {rooms.map((r) => (
              <li key={r.code}>
                <span className="room-code">{r.code}</span>
                <span>{r.playerCount}/4 人</span>
                <span>{r.hasPassword ? '🔒' : ''}</span>
                <button onClick={() => joinRoom(r.code, r.hasPassword ? joinPw : '')}>加入</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
