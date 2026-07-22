# ITER-004 Bot Scheduler Race Coverage

## 功能名称

Bot 调度竞态、取消和驻留节奏测试。

## 优先级

P1。

## 当前状态

Backlog。

## 背景

`botRunner.ts` 使用每房间一个 pending timer。现有 `botRunner.test.ts` 只验证 delay 范围，缺少 fake timer 对“重复调度、取消、房间结束、驻留后领出”的行为覆盖。

## 需要解决的问题

- `scheduleBots` 被多次调用时是否只保留一个 timer。
- `cancelBots` 是否能阻止后续 bot 行动。
- 房间销毁/下一局/真人抢先行动后，旧 timer 是否安全。
- 收墩驻留 3 秒是否只影响 bot 领出新墩。

## 用户可感知收益

Bot 不会突然抢跑、重复行动或在房间结束后继续操作；收墩节奏更可信。

## 涉及模块 / 文件

- `apps/server/src/botRunner.ts`
- `apps/server/src/app.ts`
- `apps/server/test/botRunner.test.ts`
- `apps/server/test/gameFlow.test.ts`

## 实现思路

1. 使用 Vitest fake timers 为 `scheduleBots` 建立行为测试。
2. 构造最小 room fixture，控制当前 phase/acting seat。
3. 覆盖 pending 去重、normal delay、settle delay、cancel、非 bot turn、timer fire 后状态重新校验。
4. 必要时导出测试辅助或重构纯函数，但不改变生产行为。

## 验收标准

- 同一房间重复 schedule 只执行一次 bot action。
- cancel 后推进 timer 不执行 action/broadcast。
- settle 状态下 3600ms 前不领出，达到延迟后执行。
- 状态变成真人 turn 或 scoring 后 timer fire 不执行 bot。
- 相关测试稳定通过。

## 测试方式

- `pnpm vitest run apps/server/test/botRunner.test.ts`
- `pnpm vitest run apps/server/test/gameFlow.test.ts`
- `pnpm test`

## 风险和回滚方式

- 风险：为测试重构 `botRunner` 可能改变调度行为。
- 风险：fake timer 与 Socket.IO 集成测试混用造成 flake。
- 回滚：回退 `botRunner.ts` 重构，保留纯测试 fixture 思路。

## 依赖

ITER-000。

## 执行记录

未开始。
