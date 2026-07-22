import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Card } from '@shengji/shared';
import HandFan from '../src/components/HandFan';

function c(id: string): Card {
  const [, rank] = id.split('-');
  return { id, kind: 'suit', suit: 'S', rank: Number(rank) as Card & never } as Card;
}

describe('HandFan', () => {
  it('marks suggested cards without selecting them', () => {
    const html = renderToStaticMarkup(
      React.createElement(HandFan as React.ComponentType<Record<string, unknown>>, {
        hand: [c('S-11-0'), c('S-14-0')],
        selected: new Set<string>(),
        hinted: new Set<string>(['S-11-0']),
        disabled: false,
        onToggle: () => {},
      }),
    );

    expect(html).toContain('hinted');
    expect(html).not.toContain('selected');
  });
});
