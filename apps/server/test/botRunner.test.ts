import { describe, expect, it } from 'vitest';
import { defaultBotDelay } from '../src/botRunner';

describe('defaultBotDelay', () => {
  it('normal action delay stays within 600-1200ms', () => {
    for (let i = 0; i < 20; i++) {
      const d = defaultBotDelay(false);
      expect(d).toBeGreaterThanOrEqual(600);
      expect(d).toBeLessThanOrEqual(1200);
    }
  });

  it('leading a new trick after settle waits at least 3s extra', () => {
    for (let i = 0; i < 20; i++) {
      const d = defaultBotDelay(true);
      expect(d).toBeGreaterThanOrEqual(3600);
      expect(d).toBeLessThanOrEqual(4200);
    }
  });
});
