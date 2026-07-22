# ITER-006 Responsive Chat Layout

## 功能名称

响应式、聊天抽屉和长昵称布局硬化。

## 优先级

P1。

## 当前状态

Backlog。

## 背景

上一轮已加入 compact landscape 样式和公告槽，但 UI QA 仍指出聊天抽屉、长昵称、对子/拖拉机、多尺寸、结果弹窗等缺少自动覆盖。`ChatPanel` 是 fixed drawer，可能覆盖右侧座位或出牌区。

## 需要解决的问题

- 聊天打开时可能遮挡右侧玩家、当前 trick 或操作区域。
- 长昵称在 seat badge、status bar、contract summary 中可能挤压布局。
- 667x375、844x390、1024x600 等尺寸缺少自动断言。
- 结果弹窗在窄屏可能不完整。

## 用户可感知收益

小屏、横屏手机、聊天打开、长昵称时仍能看清当前动作并完成出牌。

## 涉及模块 / 文件

- `apps/web/src/components/ChatPanel.tsx`
- `apps/web/src/components/SeatRing.tsx`
- `apps/web/src/components/StatusBar.tsx`
- `apps/web/src/components/ContractSummary.tsx`
- `apps/web/src/components/TrickArea.tsx`
- `apps/web/src/components/ResultModal.tsx`
- `apps/web/src/styles.css`
- E2E screenshot tests from ITER-002。

## 实现思路

1. 先用 E2E 固定长昵称和 chat open 场景，捕获当前重叠。
2. 定义最小支持视口：desktop 1280x720、compact landscape 844x390，是否支持 667x375 需决策。
3. chat 在 compact 下改为底部/全屏 modal 或自动收起策略。
4. seat/status/contract 文本加 `min-width: 0`、ellipsis、wrap 规则。
5. 对 result modal 加窄屏滚动和尺寸约束。

## 验收标准

- 1280x720、844x390 下 chat open 不遮挡当前行动者、当前 trick、ActionBar。
- 长昵称不会挤出视口或覆盖牌面。
- result modal 在窄屏可滚动并可点击按钮。
- `document.documentElement.scrollWidth <= innerWidth`，除手牌横向滚动区域外无页面级横向溢出。

## 测试方式

- E2E screenshot + DOM bounding box overlap checks。
- 手动浏览器验证：chat open、long nickname、pair/tractor trick、scoring modal。
- `pnpm test && pnpm typecheck && pnpm build`

## 风险和回滚方式

- 风险：CSS 调整可能破坏桌面牌桌比例。
- 风险：chat modal 改动影响消息输入和滚动。
- 回滚：按 CSS 区块回退 chat/compact/result modal 变更。

## 依赖

ITER-002。

## 执行记录

未开始。
