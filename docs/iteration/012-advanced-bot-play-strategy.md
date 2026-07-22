# ITER-012 Advanced Bot Play Strategy

## 功能名称

高级机器人领牌与跟牌策略升级

## 优先级

P1

## 当前状态

Done

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

2026-07-22 启动实现。第一小闭环限定为：

- 跟单张时，敌方当前领先且本墩已有分牌时，优先用最小可赢牌争抢，而不是直接用最大牌。
- 队友当前领先时继续保留控制牌，必要时垫分。
- 对子、拖拉机跟牌采用同样原则：有分才用最小可赢牌型争抢，无分或队友领先时省控制/送分。
- 断门且敌方有分时，只用完整主单张、主对子或主拖拉机杀分，不用散牌伪装赢墩。
- `throw-pairs` 跟牌不尝试“反甩赢牌”，只稳定满足对子数量，并按队友/敌方领先选择送分或省控制。
- 不在本轮实现出牌提示按钮 UI，不引入长期记牌或概率模型。

## 实现结果

- `packages/bot/src/play.ts`
  - 新增 `explainPlay(view) -> { cardIds, reason }`，`decidePlay` 保持原 API 并复用解释结果。
  - 领牌优先选择非主、无分、非对子成员的安全散单，避免开局自动暴露拖拉机或强对子。
  - 单张、对子、拖拉机跟牌在敌方当前领先且墩中有分时，选择最小可赢组合争抢。
  - 队友当前领先时，组合选择按送分和省控制排序。
  - 断门杀分只从完整主牌型中选最小可赢组合，保持 `validateFollow` 和 `trickWinner` 规则一致。
  - `throw-pairs` 跟牌从手牌顺序改为按策略排序选对子，避免高对无谓消耗。
- `packages/bot/src/index.ts`
  - 导出 `explainPlay`、`PlayPlan`、`PlayReason`，为后续 `ITER-015` 出牌提示按钮复用。

## 测试记录

### 红测

- `pnpm test -- packages/bot/test/bot.test.ts`
  - 失败：`opponent winning with points: uses the smallest winning single instead of spending the ace`，旧实现直接出 `S-A`。
- `pnpm test -- packages/bot/test/bot.test.ts`
  - 失败：`void in lead suit with points: trumps with the cheapest trump single`，旧实现垫 `D-3` 放分。
- `pnpm test -- packages/bot/test/bot.test.ts`
  - 失败：`lead: preserves tractor shape when a safe low single is available`，旧实现直接领出拖拉机。
- `pnpm test -- packages/bot/test/bot.test.ts`
  - 失败：对子/拖拉机 P0 场景 4 项，旧实现用最大对子/最大拖拉机争抢或跟队友。
- `pnpm test -- packages/bot/test/bot.test.ts`
  - 失败：断门对子/拖拉机杀分和 `throw-pairs` 跟牌排序 4 项，旧实现垫低副牌或按手牌顺序浪费高对。

### 当前验证

- `pnpm test -- packages/bot/test/bot.test.ts`
  - 通过：当前 Vitest 配置下执行 23 个测试文件，198 个测试。
- `pnpm test packages/bot/test/bot.test.ts --no-cache`
  - 通过：1 个测试文件，25 个测试。
- `pnpm test packages/game/test/follow.test.ts packages/game/test/trick.test.ts apps/server/test/gameFlow.test.ts`
  - 通过：3 个测试文件，26 个测试。
- `pnpm test`
  - 通过：23 个测试文件，198 个测试。
- `pnpm typecheck`
  - 通过：`pnpm -r exec tsc --noEmit` 无错误。
- `pnpm build`
  - 通过：shared/game/bot/web/server 均构建成功。

## 多角色评审记录

- 产品经理 / 真实玩家体验官：第一闭环聚焦最常见的出牌感知问题：抢分时节制用牌、队友领先时送分、省高牌、领牌保形。
- 规则专家：杀牌只在断门且具备完整主牌型时发生；`throw-pairs` 当前规则由领出者固定赢，因此跟牌策略不制造“反甩赢牌”错觉。
- QA / 对抗评审：采纳 P0 的对子/拖拉机最小可赢和队友省控制；采纳 P1 的断门对子/拖拉机杀分和 throw-pairs 稳定跟牌；P2 的复杂降级对子只做排序稳定，不新增独立验收项。
- 代码审查：修复随机 bot-vs-bot smoke 使用固定 `trickPointsSoFar: 0` 的问题，改为按当前墩真实分牌计算；同时断言策略不落入 `fallback`。清理未使用的 reason，并把队友领先/省控制场景的解释改为 `support-teammate` 和 `preserve-control`。

## 未处理事项

- 不做主动甩牌策略，避免 bot 使用全知信息触发失败惩罚。
- 不做长期记牌、概率模型、剩余主牌推断。
- 不做出牌提示 UI；`explainPlay` 只作为后续提示复用的策略接口。
