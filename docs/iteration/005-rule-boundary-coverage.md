# ITER-005 Rule Boundary Coverage

## 功能名称

规则边界与结算端到端测试补齐。

## 优先级

P1。

## 当前状态

Done。

## 背景

当前 `packages/game` 有较多单元测试，但对部分 Shengji 规则边界缺少状态机端到端覆盖。规则评审明确指出跨队反主级牌、无主级牌跟牌、破结构跟牌、末墩多张扣底等需要锁定。

## 需要解决的问题

- 跨队反主是否切换本局级牌是规则选择，当前实现不切换。
- no-trump 下所有级牌为主，跟牌/胜负边界需要端到端测试。
- 破对子/破拖拉机合法跟牌后不能赢，需要 settlement 测试。
- 末墩每人多张时 kitty multiplier 需要 round 层验证。

## 用户可感知收益

玩家看到的输赢和扣底更符合规则预期；后续改规则时能明确知道影响面。

## 涉及模块 / 文件

- `packages/game/src/round.ts`
- `packages/game/src/bidding.ts`
- `packages/game/src/follow.ts`
- `packages/game/src/trick.ts`
- `packages/game/src/scoring.ts`
- `packages/game/test/round.test.ts`
- `packages/game/test/trick.test.ts`
- `packages/game/test/follow.test.ts`
- `packages/game/test/scoring.test.ts`
- `docs/iteration/decision-log.md`

## 实现思路

1. 先写“现状锁定”测试，不立即改变规则。
2. 对跨队反主级牌写决策测试：planned dealer team level 是当前规则。
3. 对 no-trump effective suit 写 follow + winner 组合测试。
4. 构造 round 级末墩多张扣底场景，验证 `lastTrickCardsPerPlayer` 和 `kittyBonus`。
5. 如果用户要求规则变体，再另开设计文档。

## 验收标准

- 每个规则边界至少有一个失败优先的回归测试。
- 决策记录说明当前 house rule。
- 规则测试能解释为何某玩家赢墩、为何扣底倍数如此。
- 不改变规则时，所有新增测试应锁定现状；改变规则时，文档和 UI 文案同步更新。

## 测试方式

- `pnpm vitest run packages/game/test/round.test.ts`
- `pnpm vitest run packages/game/test/trick.test.ts`
- `pnpm vitest run packages/game/test/follow.test.ts`
- `pnpm vitest run packages/game/test/scoring.test.ts`
- `pnpm test`

## 风险和回滚方式

- 风险：构造 round fixture 复杂，容易测试实现细节而非行为。
- 风险：规则改动影响 bot 和 UI 叫主文案。
- 回滚：如果只加测试，删除相关测试；如果改规则，回退 `bidding/round/follow/trick/scoring` 相关变更并恢复决策日志。

## 依赖

ITER-000。

## 执行记录

2026-07-22：

- 进入测试补齐阶段。
- 本轮先补“现状锁定”测试：无主局级牌跟主约束、round 层末墩每人多张扣底倍率。
- 如果新增测试直接通过，不改生产规则代码。
- 目标测试第一次运行时失败 1 项，原因是测试牌例误用了 K，K 本身计 10 分；这不是规则缺陷，改为 Q 后只验证扣底倍率。
- 目标验证：`pnpm test packages/game/test/follow.test.ts packages/game/test/round.test.ts packages/game/test/scoring.test.ts packages/game/test/trick.test.ts` 通过 4 个测试文件、51 个测试。
- 全量验证：`pnpm test` 通过 21 个测试文件、163 个测试；`pnpm typecheck` 通过；`pnpm build` 通过。
- 生产代码改动：无。
