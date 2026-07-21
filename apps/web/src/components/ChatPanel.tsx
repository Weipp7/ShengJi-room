import { useEffect, useRef, useState } from 'react';
import { C2S } from '@shengji/shared';
import { getSocket } from '../socket';
import { useStore } from '../store';

export default function ChatPanel() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.chat, open]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    getSocket().emit(C2S.ChatSend, { text: trimmed });
    setText('');
  };

  return (
    <div className={`chat-panel ${open ? 'open' : ''}`}>
      <button className="chat-toggle" onClick={() => setOpen(!open)}>
        {open ? '收起 ›' : '‹ 聊天'}
      </button>
      {open && (
        <div className="chat-body">
          <div className="chat-list" ref={listRef}>
            {state.chat.map((m, i) => (
              <div key={i} className="chat-msg">
                <span className="chat-nick">{m.nickname}：</span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              value={text}
              maxLength={200}
              placeholder="说点什么…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button onClick={send}>发送</button>
          </div>
        </div>
      )}
    </div>
  );
}
