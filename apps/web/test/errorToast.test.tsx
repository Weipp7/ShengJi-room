import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ErrorToast from '../src/components/ErrorToast';

describe('ErrorToast', () => {
  it('renders an inspectable alert with a dismiss control', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorToast, {
        error: {
          id: 7,
          code: 'wrong-phase',
          title: '当前阶段不能进行此操作',
          hint: '动作可能已经提交或牌局阶段已变化，请以桌面当前提示为准。',
          text: '当前阶段不能进行此操作：动作可能已经提交或牌局阶段已变化，请以桌面当前提示为准。',
        },
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('当前阶段不能进行此操作');
    expect(html).toContain('桌面当前提示');
    expect(html).toContain('aria-label="关闭错误提示"');
    expect(html).toContain('data-error-code="wrong-phase"');
  });
});
