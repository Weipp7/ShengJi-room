# Iteration Test Report

更新时间：2026-07-22

## ITER-011 机器人埋牌策略升级

### 红测记录

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，`prefers voiding a short safe side suit over burying lower scattered cards` 未通过。
- 结论：旧埋牌策略只按单卡成本排序，不会主动制造安全短门。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，`does not force a void when the dealer is weak and safe filler is scarce` 未通过。
- 结论：第一版断门奖励缺少庄家强弱门槛，弱庄仍会为了断门牺牲更保守的埋法。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，`does not create a void-bonus candidate when a balanced dealer would need unsafe filler` 初始失败于 `explainBury is not a function`。
- 结论：补牌门槛需要在候选层可审计，公开 `decideBury` 输出无法可靠区分自然低成本埋牌和断门奖励候选。

### 修复后验证

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：通过；当前 Vitest 配置下执行 23 个测试文件，187 个测试。
- 覆盖：安全断门、弱庄不强断、强庄安全断门、补牌门槛候选审计、关键主控不埋、200 组随机手牌合法性、完整 bot vs bot 牌局合法性。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts packages/game/test/scoring.test.ts`
- 结果：通过，23 个测试文件，187 个测试。
- 覆盖：bot 埋牌变更未破坏结算和甩牌惩罚相关规则。

- 命令：`pnpm test`
- 结果：通过，23 个测试文件，187 个测试。
- 覆盖：shared/game/bot/server/web 全量单测。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/web/server 均构建成功。

### 浏览器验证边界

本阶段只调整机器人埋牌策略。埋牌属于庄家隐藏信息，普通玩家 UI 不应展示具体底牌，因此没有新增浏览器可见交互。上一轮甩牌和亮牌可见性浏览器证据保留在：

- `docs/iteration/016-browser-throw-actionbar.png`
- `docs/iteration/016-browser-actionbar-crop.png`
- `docs/iteration/014-browser-post-dealer-counter-result.png`
- `docs/iteration/013-browser-big-joker-single.png`

仓库内可重复 E2E 仍由 `ITER-002` 跟踪。

## ITER-012 高级机器人领牌与跟牌策略升级

### 红测记录

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，`opponent winning with points: uses the smallest winning single instead of spending the ace` 收到 `S-14`，期望 `S-11`。
- 结论：旧单张策略会直接用最大牌抢分，浪费控制牌。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，`void in lead suit with points: trumps with the cheapest trump single` 收到 `D-3`，期望 `H-3`。
- 结论：旧断门策略只垫低牌，不会用小主杀分。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，`lead: preserves tractor shape when a safe low single is available` 收到整组拖拉机，期望安全散单 `C-3`。
- 结论：旧领牌策略太激进，开局容易暴露或消耗组合。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，对子/拖拉机 P0 场景 4 项。
- 结论：旧对子/拖拉机跟牌总取最大可赢组合，且队友领先时也浪费高组合。

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：失败，断门对子/拖拉机杀分和 `throw-pairs` 跟牌排序 4 项。
- 结论：旧策略无法用完整主牌型杀分，且 `throw-pairs` 跟牌受手牌顺序影响。

### 修复后验证

- 命令：`pnpm test -- packages/bot/test/bot.test.ts`
- 结果：通过；当前 Vitest 配置下执行 23 个测试文件，198 个测试。
- 覆盖：单张/对子/拖拉机最小可赢、断门杀分、队友送分省控制、领牌保形、throw-pairs 稳定跟牌、完整 bot vs bot smoke。

- 命令：`pnpm test packages/bot/test/bot.test.ts --no-cache`
- 结果：通过，1 个测试文件，25 个测试。
- 覆盖：`explainPlay` 入口导出在无缓存路径下可用。

- 命令：`pnpm test packages/game/test/follow.test.ts packages/game/test/trick.test.ts apps/server/test/gameFlow.test.ts`
- 结果：通过，3 个测试文件，26 个测试。
- 覆盖：跟牌合法性、墩赢家判定和服务端完整牌局 smoke 未因策略变化回归。

- 命令：`pnpm test`
- 结果：通过，23 个测试文件，198 个测试。
- 覆盖：shared/game/bot/server/web 全量单测。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/web/server 均构建成功。

### 浏览器验证边界

本阶段只调整 bot 决策和解释接口，不改变玩家可见 UI。真实浏览器试玩仍需要等 `ITER-002` 的确定性 E2E 基础设施落地后，把固定牌序和多客户端截图纳入仓库。
