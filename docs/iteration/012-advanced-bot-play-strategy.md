# ITER-012 Advanced Bot Play Strategy

## 功能名称

高级机器人领牌与跟牌策略升级

## 优先级

P1

## 当前状态

Backlog

## 背景

当前 bot 出牌能完成基本合法出牌，但真实玩家会根据当前墩、队友位置、分牌、主牌控制、是否能杀、是否该垫分来决策。新增甩牌和出牌提示后，需要一个更系统的出牌评估器。

## 需要解决的问题

- 领牌策略需要考虑出分、保分、拉主、清主、送队友、试探断门。
- 跟牌策略需要区分能赢、必须跟、可垫、可杀、队友当前领先时是否省牌。
- bot 不应为了赢小墩浪费大主，也不应在可保分时随意垫掉。
- 甩牌加入后，bot 需要判断甩牌价值和失败风险。

## 用户可感知收益

- AI 出牌更像真人，不再只像合法牌生成器。
- 玩家对当前轮次、队友配合和分牌争夺的理解更自然。
- 出牌提示按钮可以给出更可信的建议。

## 涉及模块 / 文件

- `packages/bot/src/play.ts`
- `packages/bot/test/bot.test.ts`
- `packages/game/src/follow.ts`
- `packages/game/src/trick.ts`
- `packages/game/src/combo.ts`
- `packages/shared/src/state.ts`
- `apps/web/src/lib/format.ts`

## 实现思路

1. 抽出 `choosePlay` 内部的候选生成和评分逻辑。
2. 领牌评分覆盖：优先出可控牌型、保护分、尝试建立长套、必要时拉主。
3. 跟牌评分覆盖：合法跟牌、能赢则评估收益、队友领先时省控制牌、敌方领先且有分时争抢。
4. 加入甩牌候选但默认保守，具体规则依赖 `ITER-016`。
5. 所有策略先以固定手牌单元测试验证，再跑完整 gameFlow。

## 验收标准

- bot 领牌不会明显拆掉更有价值的组合。
- bot 跟牌能在敌方拿分时尝试赢墩。
- bot 在队友当前领先且无必要时会省大牌。
- bot 遵守所有跟牌规则，策略升级不引入非法出牌。
- 高级策略测试覆盖主牌、非主、分牌、队友领先、敌方领先、断门杀牌。

## 测试方式

- `pnpm test packages/bot/test/bot.test.ts`
- `pnpm test packages/game/test/follow.test.ts packages/game/test/trick.test.ts`
- `pnpm test apps/server/test/gameFlow.test.ts`
- 随机多局 smoke：确认 bot 不抛错、不非法出牌、不死循环。

## 风险和回滚方式

- 风险：策略升级可能让测试过度依赖具体牌序。
- 控制：测试断言策略原则，例如“保留最大主”或“优先保分”，避免断言全部手牌排序。
- 回滚：保留原合法出牌路径作为 fallback，必要时回滚 `packages/bot/src/play.ts`。

## 依赖

- `ITER-016`

## 执行记录

尚未开始。
