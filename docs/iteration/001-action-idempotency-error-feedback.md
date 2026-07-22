# ITER-001 Action Idempotency And Error Feedback

## 功能名称

快速/重复操作的幂等与可理解错误反馈。

## 优先级

P0。

## 当前状态

Backlog。

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

未开始。
