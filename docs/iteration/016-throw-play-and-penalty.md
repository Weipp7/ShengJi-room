# ITER-016 Throw Play And Failed Throw Penalty

## 功能名称

甩牌功能与失败惩罚结算

## 优先级

P0

## 当前状态

Backlog

## 背景

用户要求支持甩牌，并在甩牌失败时惩罚，按照甩出的牌型扣 `20 * n`。这是规则和结算层的重要扩展，必须先定义失败判定、惩罚归属、展示方式，再接 UI。

## 需要解决的问题

- 需要定义哪些组合可作为甩牌候选。
- 需要判断其他玩家是否存在能压住甩牌中某个子牌型的牌。
- 甩牌失败后如何改为实际出牌、如何扣分、扣谁的分、`n` 如何计算必须明确。
- 惩罚必须在墩区、公告、结算中可见，不能只写入内部日志。

## 用户可感知收益

- 支持升级/拖拉机真实玩法中的关键进攻手段。
- 甩牌失败有明确反馈和代价，玩家能理解为什么扣分。
- bot 和提示按钮可以围绕甩牌风险做更像真人的判断。

## 涉及模块 / 文件

- `packages/game/src/combo.ts`
- `packages/game/src/follow.ts`
- `packages/game/src/trick.ts`
- `packages/game/src/scoring.ts`
- `packages/game/src/round.ts`
- `packages/game/test/combo.test.ts`
- `packages/game/test/follow.test.ts`
- `packages/game/test/round.test.ts`
- `packages/shared/src/state.ts`
- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/components/TrickArea.tsx`
- `apps/web/src/lib/announcements.ts`

## 实现思路

1. 在规则文档和测试中定义甩牌子牌型、失败检测和 `n` 的含义。
2. 先实现纯规则函数：输入甩牌、其他玩家手牌、当前主，输出成功/失败、失败原因、惩罚分。
3. 在 `applyPlay` 中接入甩牌 action，失败时记录 penalty event。
4. UI 展示甩牌成功/失败、惩罚分、实际进入墩的牌。
5. bot 策略后续通过 `ITER-012` 使用同一规则函数评估风险。

## 验收标准

- 合法甩牌能作为领牌进入当前墩。
- 失败甩牌会按 `20 * n` 计罚，且惩罚归属明确。
- 失败原因能在 UI 中被玩家看到。
- 甩牌不会破坏跟牌合法性、墩赢家判定或最终结算。
- 甩牌场景有单元测试、状态机测试和浏览器验证。

## 测试方式

- `pnpm test packages/game/test/combo.test.ts`
- `pnpm test packages/game/test/follow.test.ts`
- `pnpm test packages/game/test/round.test.ts`
- `pnpm test packages/game/test/scoring.test.ts`
- 浏览器验证：成功甩牌、失败甩牌、惩罚展示、结算分变化。

## 风险和回滚方式

- 风险：不同地区甩牌失败规则存在变体。
- 控制：本任务先实现用户指定的 `20 * n`，变体写入 decision-log。
- 回滚：回滚甩牌 action、规则函数和 UI 展示，普通出牌流程保留。

## 依赖

- `ITER-005`
- `ITER-013`

## 执行记录

尚未开始。
