import { describe, expect, it } from 'vitest';
import { formatGameError } from '../src/lib/errors';

describe('formatGameError', () => {
  it('adds player-facing context for stale turn errors', () => {
    const error = formatGameError({ code: 'wrong-turn', message: 'not your turn' });

    expect(error.code).toBe('wrong-turn');
    expect(error.title).toBe('还没轮到你');
    expect(error.hint).toContain('动作可能已经提交');
    expect(error.text).toContain('还没轮到你');
    expect(error.text).toContain('桌面当前提示');
  });

  it('keeps unknown error codes inspectable', () => {
    const error = formatGameError({ code: 'new-rule-error', message: 'server detail' });

    expect(error.title).toBe('操作失败（new-rule-error）');
    expect(error.text).toContain('server detail');
  });
});
