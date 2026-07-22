# ITER-007 Settled Trick Review UX

## 功能名称

收墩驻留体验：倒计时、跳过和下一手说明。

## 优先级

P1。

## 当前状态

Backlog。

## 背景

当前 `GameTable.tsx` 在完整一墩后固定展示 3 秒，`ActionBar` 显示赢家收墩文案。用户试玩已经发现过赢家漂移问题；虽然根因已修，但驻留仍缺少剩余时间、跳过、下一手说明。

## 需要解决的问题

- 玩家不知道驻留还要多久。
- 真人想快速继续时无法明确跳过。
- 下一墩谁领出/谁将行动不够突出。
- result modal 与最后一墩 hold 的衔接需要持续验证。

## 用户可感知收益

收墩复盘像真实牌桌停顿，而不是卡顿；玩家可以理解节奏并主动继续。

## 涉及模块 / 文件

- `apps/web/src/pages/GameTable.tsx`
- `apps/web/src/components/TrickArea.tsx`
- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/lib/waiting.ts`
- `apps/web/src/styles.css`
- E2E settled trick tests。

## 实现思路

1. 先用测试覆盖 settled state 的文案、赢家、下一手 actor。
2. 在前端 hold state 中记录开始时间和剩余秒数。
3. ActionBar 显示“X 收墩，Y 将领出，2 秒后继续”。
4. 增加“继续”按钮，允许本地提前结束视觉驻留，但不能发送额外出牌动作。
5. 最后一墩进入 scoring 时保证结果弹窗不会被过长 hold 阻塞。

## 验收标准

- 收墩驻留显示赢家、下一手领出者、剩余时间。
- 本地“继续”只影响本地展示，不改变服务端状态。
- Bot 领出仍受服务端 settle delay 保护。
- 最后一墩后 result modal 在合理时间出现。

## 测试方式

- 组件/渲染测试：文案和按钮状态。
- E2E：完整一墩，观察 countdown、click continue、下一墩进入。
- `pnpm test && pnpm typecheck`

## 风险和回滚方式

- 风险：前端提前结束展示可能与服务端 bot delay 产生感知不一致。
- 风险：本地 skip 不能让玩家非法抢跑。
- 回滚：移除 countdown/skip，恢复固定 3 秒视觉驻留。

## 依赖

ITER-001、ITER-004。

## 执行记录

未开始。
