# ITER-003 Card Accessibility

## 功能名称

卡牌操作无障碍与键盘/触屏一致性。

## 优先级

P0。

## 当前状态

Backlog。

## 背景

`CardFace.tsx` 目前渲染 clickable `div`，没有按钮语义、焦点态、键盘操作、`aria-pressed` 或可读牌名。`HandFan.tsx` 通过 `onClick` 切换选择，鼠标之外的操作路径不足。

## 需要解决的问题

- 键盘用户无法选择手牌。
- 读屏用户无法知道牌面和选中状态。
- 触屏用户无法看到 hover-only 的说明。
- 自动化测试缺少稳定的可访问名称。

## 用户可感知收益

玩家可用键盘、触屏和辅助技术完成埋底/出牌；浏览器测试也能基于角色和名称定位卡牌。

## 涉及模块 / 文件

- `apps/web/src/components/CardFace.tsx`
- `apps/web/src/components/HandFan.tsx`
- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/lib/format.ts`
- `apps/web/src/styles.css`
- 可能新增 web 渲染测试或 E2E。

## 实现思路

1. 增加牌面文本格式函数，例如“黑桃 2”“大王”。
2. 让可交互手牌具备 button 语义；非交互展示牌保持静态元素。
3. 增加 `aria-pressed`、disabled 状态、焦点样式和 Enter/Space 行为。
4. 处理手牌叠放布局下的焦点可见性。
5. 更新测试和浏览器断言，覆盖选择、取消选择、埋底 8/8、出牌按钮启用。

## 验收标准

- Tab 能进入手牌区域，焦点可见。
- Enter/Space 能切换选中。
- 选中状态有视觉和 `aria-pressed` 表达。
- 已禁用阶段不能选择牌，且语义上 disabled。
- 读屏可读出具体牌名。

## 测试方式

- 组件/渲染测试验证 button role、accessible name、`aria-pressed`。
- E2E：键盘选择 8 张埋底，键盘/点击清空选择。
- 响应式截图确认焦点不被遮挡。
- `pnpm test && pnpm typecheck`

## 风险和回滚方式

- 风险：从 `div` 改成 `button` 会影响 CSS、叠牌和点击区域。
- 风险：大量按钮可能改变 Tab 顺序，需要可控策略。
- 回滚：保留牌名格式函数，回退 CardFace 交互语义和样式改动。

## 依赖

ITER-002。

## 执行记录

未开始。
