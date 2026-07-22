import { describe, expect, it } from 'vitest';
import type { Announcement } from '../src/lib/announcements';
import { mergeAnnouncementQueue } from '../src/lib/announcementQueue';

function event(id: string, kind: Announcement['kind']): Announcement {
  return { id, kind, text: id, cards: [] };
}

describe('mergeAnnouncementQueue', () => {
  it('phase events supersede fresh and queued bid/counter events', () => {
    const decision = mergeAnnouncementQueue(
      [event('queued-bid', 'bid'), event('queued-counter', 'counter'), event('queued-phase', 'phase')],
      event('current-counter', 'counter'),
      [event('fresh-counter', 'counter'), event('fresh-phase', 'phase')],
    );

    expect(decision.clearCurrent).toBe(true);
    expect(decision.queue.map((a) => a.id)).toEqual(['queued-phase', 'fresh-phase']);
  });

  it('counter events supersede fresh and queued bid events but keep phase events', () => {
    const decision = mergeAnnouncementQueue(
      [event('queued-bid', 'bid'), event('queued-phase', 'phase')],
      event('current-bid', 'bid'),
      [event('fresh-bid', 'bid'), event('fresh-counter', 'counter')],
    );

    expect(decision.clearCurrent).toBe(true);
    expect(decision.queue.map((a) => a.id)).toEqual(['queued-phase', 'fresh-counter']);
  });

  it('plain bid events append without clearing the current banner', () => {
    const decision = mergeAnnouncementQueue(
      [event('queued-bid', 'bid')],
      event('current-bid', 'bid'),
      [event('fresh-bid', 'bid')],
    );

    expect(decision.clearCurrent).toBe(false);
    expect(decision.queue.map((a) => a.id)).toEqual(['queued-bid', 'fresh-bid']);
  });
});
