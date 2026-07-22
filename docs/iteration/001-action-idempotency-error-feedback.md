# ITER-001 Action Idempotency And Error Feedback

## 功能名称

快速/重复操作的幂等与可理解错误反馈。

## 优先级

P0。

## 当前状态

In Progress。

## 背景

服务端按单线程状态机处理动作，重复点击会导致第二次请求落到新状态并返回 `wrong-turn` 或 `wrong-phase`。这在规则上安全，但玩家看到的是“还没轮到你”等误导性错误。前端 `ActionBar.tsx` 没有 in-flight 锁，错误 toast 在 `store.tsx` 中 3 秒后自动消失。

## 需要解决的问题

- 双击 `过`、`出牌`、`确认埋牌`、`下一局` 会产生错误提示。
- 错误缺少上下文，玩家不知道是重复点击、网络延迟还是规则非法。
- toast 自动消失，不利于复盘和测试断言。

## 用户可感知收益

玩家快速点击不会被误导为规则错误；真正非法操作能保留足够久并说明原因。

## 涉及模块 / 文件

- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/pages/GameTable.tsx`
- `apps/web/src/store.tsx`
- `apps/server/src/app.ts`
- `apps/server/test/gameFlow.test.ts`
- 可能新增 `apps/web/test/actionState.test.ts` 或 E2E 用例。

## 实现思路

1. 先写 socket 级回归测试：同一玩家同步发两次 pass/play/next-round，确认只有第一次改变状态，第二次不会造成额外状态推进。
2. 前端为发出的动作建立 pending key，直到收到新 `RoomStateView` 或错误后释放。
3. 对 pending 状态禁用按钮并显示“处理中…”或保持原按钮但防重复触发。
4. 错误提示改为可复查：保留到下一次成功状态或用户关闭；重复点击类错误尽量静默或弱提示。
5. 文档记录哪些错误应展示，哪些应作为重复提交忽略。

## 验收标准

- 双击 `过` 不产生误导性 `wrong-turn` toast。
- 双击 `出牌` 不多出牌、不误删选择。
- 双击 `下一局` 不创建两局或报错。
- 真正非法出牌仍显示明确错误。
- 目标 socket 测试和前端行为测试通过。

## 测试方式

- `pnpm vitest run apps/server/test/gameFlow.test.ts`
- 目标 web 测试文件。
- 浏览器：快速双击 bidding pass、playing play、scoring next-round，记录 DOM/截图。
- 全量：`pnpm test && pnpm typecheck`

## 风险和回滚方式

- 风险：pending 锁过强可能导致合法重试被禁用。
- 风险：socket 错误被静默后真实规则错误不易发现。
- 回滚：回退 ActionBar/GameTable pending 状态和 store 错误展示改动；服务端状态机测试可保留。

## 依赖

ITER-000。

## 执行记录

2026-07-22 启动第一小闭环。范围限定为：

- 前端对会发送服务端动作的按钮建立本地 pending 锁：亮牌、过牌、埋底、出牌、下一局。
- pending 从点击开始，到收到新的 `RoomStateView` 或错误后释放。
- pending 期间禁用对应服务端动作和手牌选择，并显示“处理中…”反馈。
- 提示、清空选择等本地动作不发送服务端状态，但 pending 期间不允许继续改选，避免玩家误以为能修改已提交动作。
- 本轮不改服务端协议，不改变真实非法操作的错误展示；错误持久化和重复错误静默进入后续小闭环。

## 第一小闭环计划

1. 红测：ActionBar 在 pending 状态下禁用出牌、过牌、埋底和下一局，并显示“处理中…”。
2. 实现：给 `ActionBar` 增加 pending action prop；给 `BidOptions` 增加 disabled 透传。
3. 实现：`GameTable` 在 emit 前设置 pending；收到新 view 或 error 后释放。
4. 回归：提示按钮、甩牌文案、埋牌、叫主测试不回归。
5. 浏览器：快速双击出牌或过牌时不再出现误导性 `wrong-turn` toast。

## 第一小闭环结果

2026-07-22 完成。

- 代码：`ActionBar` 增加 `pendingAction`，亮牌/过牌/埋牌/出牌/下一局 pending 时禁用并显示“处理中…”。
- 代码：`GameTable` 对所有会发送服务端动作的入口统一 `submitAction`，包括结算弹窗的“下一局”。
- 对抗验证发现：仅依赖 React 重新渲染后的 `disabled` 不足以拦截同一帧双击。
- 修复：新增 `pendingActionRef` 同步锁，第一次 handler 内立即写入，第二次 handler 即使发生在重新渲染前也会被阻断。
- 浏览器验证：真实牌局中先在亮主阶段快速连续点 `过`，再在出牌阶段选中合法跟牌并对 `出牌` 执行双击；DOM 未出现 `wrong-turn` 或 `wrong-phase` toast，出牌只推进到下一位。
- 剩余范围：错误提示持久化、重复错误弱提示、socket 级重复动作断言仍留在 ITER-001 后续小闭环。
