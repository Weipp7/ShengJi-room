import type { Announcement } from './announcements';

export type AnnouncementQueueDecision = {
  queue: Announcement[];
  clearCurrent: boolean;
};

// 同一帧里 phase 事件代表游戏已进入下一阶段；未显示的亮主/反主不再排队。
export function mergeAnnouncementQueue(
  queue: Announcement[],
  current: Announcement | null,
  fresh: Announcement[],
): AnnouncementQueueDecision {
  if (fresh.length === 0) return { queue, clearCurrent: false };

  const hasPhase = fresh.some((a) => a.kind === 'phase');
  if (hasPhase) {
    return {
      queue: [...queue.filter((a) => a.kind === 'phase'), ...fresh.filter((a) => a.kind === 'phase')],
      clearCurrent: current !== null && current.kind !== 'phase',
    };
  }

  const hasCounter = fresh.some((a) => a.kind === 'counter');
  if (hasCounter) {
    return {
      queue: [...queue.filter((a) => a.kind === 'phase'), ...fresh.filter((a) => a.kind !== 'bid')],
      clearCurrent: current !== null && current.kind !== 'phase',
    };
  }

  return { queue: [...queue, ...fresh], clearCurrent: false };
}
