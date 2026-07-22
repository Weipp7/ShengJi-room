import { useEffect, useRef, useState } from 'react';
import type { Announcement } from '../lib/announcements';
import { mergeAnnouncementQueue } from '../lib/announcementQueue';
import CardFace from './CardFace';

type Props = {
  // 新事件由父组件推导后推入；本组件负责排队逐条展示
  incoming: Announcement[];
};

// 每条公告的展示时长：反主更醒目也停留更久
const SHOW_MS: Record<Announcement['kind'], number> = {
  bid: 2800,
  counter: 3500,
  phase: 2400,
  throw: 3600,
};

// 牌桌顶部公告条：一次一条先进先出，展示操作者/类型/牌面
export default function AnnouncementBanner({ incoming }: Props) {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const seen = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const fresh = incoming.filter((a) => !seen.current.has(a.id));
    if (fresh.length === 0) return;
    for (const a of fresh) seen.current.add(a.id);
    const decision = mergeAnnouncementQueue(queue, current, fresh);
    if (decision.clearCurrent) {
      window.clearTimeout(timer.current);
      setCurrent(null);
    }
    setQueue(decision.queue);
  }, [current, incoming, queue]);

  useEffect(() => {
    if (current !== null || queue.length === 0) return;
    const [head, ...rest] = queue;
    setCurrent(head);
    setQueue(rest);
    timer.current = window.setTimeout(() => setCurrent(null), SHOW_MS[head.kind]);
  }, [current, queue]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (current === null) return <div className="announcement-lane" aria-hidden="true" />;
  return (
    <div className="announcement-lane">
      <div className={`announcement announcement-${current.kind}`} role="status" aria-live="polite">
        <span className="announcement-text">{current.text}</span>
        {current.cards.length > 0 && (
          <span className="announcement-cards">
            {current.cards.map((card) => (
              <CardFace key={card.id} card={card} small />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
