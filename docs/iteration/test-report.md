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

## ITER-015 出牌提示按钮与可解释推荐

### 红测记录

- 命令：`pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
- 结果：失败，`playHint` 模块不存在。
- 结论：前端没有从 `RoomStateView` 生成可解释推荐的入口。

- 命令：`pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
- 结果：失败，ActionBar HTML 不包含 `提示` 或推荐理由。
- 结论：玩家出牌回合没有可见提示入口。

- 命令：`pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
- 结果：失败，HandFan HTML 不包含 `hinted`。
- 结论：推荐牌没有独立高亮状态。

### 修复后验证

- 命令：`pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
- 结果：通过，3 个测试文件，8 个测试。
- 覆盖：普通跟牌提示、非本地回合不提示、成功甩牌跟牌提示、甩牌事件进入 context key、ActionBar 提示文案、HandFan 推荐高亮。

- 命令：`pnpm test`
- 结果：通过，25 个测试文件，204 个测试。
- 覆盖：shared/game/bot/server/web 全量单测。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

### BUG-017-002 队友误触发甩牌失败

#### 红测记录

- 命令：`pnpm test packages/game/test/throw.test.ts`
- 结果：失败，`succeeds when only the thrower teammate can beat a thrown pair` 收到 `failure`，期望 `success`。
- 结论：旧实现把队友也当成可挑战甩牌的人。

- 命令：`pnpm test packages/game/test/throw.test.ts packages/game/test/round.test.ts`
- 结果：失败，round 层只落桌 `S-5` 对，期望完整甩牌 `S-5` 对 + `S-8` 对。
- 结论：队友误挑战不仅影响规则结果，也会错误改变实际落桌牌和罚分账本。

#### 修复后验证

- 命令：`pnpm test packages/game/test/throw.test.ts packages/game/test/round.test.ts packages/game/test/scoring.test.ts`
- 结果：通过，3 个测试文件，40 个测试。
- 覆盖：队友不能触发甩牌失败、对手仍可触发失败、round 层不产生错误罚分、结算规则未回归。

- 命令：`pnpm test`
- 结果：通过，26 个测试文件，210 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

### 浏览器验证

- 命令：`pnpm dev`
- URL：`http://localhost:5173/`
- 交互路径：输入昵称 `试玩员` -> `开一桌` -> `开始游戏` -> 亮大王无主 -> 选 8 张并确认埋底 -> 本人出牌回合点击 `提示`。
- 结果：提示后操作栏显示推荐理由，DOM 记录 `selectedCount=1`、`hintedCount=1`，当前墩为空；点击 `出牌` 后进入等待机器人，DOM 记录 `selectedCount=0`、`hintedCount=0`，当前墩出现本人领出的牌。
- 移动端：`390x844` 视口下操作栏 `clientWidth=390`、`scrollWidth=390`，无横向溢出。
- 截图：
  - `docs/iteration/015-browser-play-hint.png`
  - `docs/iteration/015-browser-play-hint-mobile.png`

## ITER-017 扩展功能缺陷池与回归修复流程

### BUG-017-001 上一墩回放覆盖当前墩

#### 红测记录

- 命令：`pnpm test apps/web/test/settledReview.test.ts apps/web/test/trickArea.test.tsx`
- 结果：失败，`settledReview` 模块不存在。
- 结论：上一墩驻留判定散落在 `GameTable.tsx` 内，缺少可测试入口来复现重连/刷新后旧墩覆盖当前墩的问题。

- 命令：`pnpm test apps/web/test/settledReview.test.ts`
- 结果：失败，`settledReviewStateKey is not a function`。
- 结论：仅使用 `lastTrick` key 不足以在当前墩开始时清理旧驻留，需要把当前墩纳入 effect 依赖 key。

#### 修复后验证

- 命令：`pnpm test apps/web/test/settledReview.test.ts apps/web/test/trickArea.test.tsx`
- 结果：通过，2 个测试文件，8 个测试。
- 覆盖：当前墩已开始时不回放上一墩、缺失上一墩赢家时不使用 `turnSeat` 冒充赢家、当前墩变化会触发驻留状态清理。

- 命令：`pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
- 结果：通过，3 个测试文件，8 个测试。
- 覆盖：修复未破坏出牌提示按钮和高亮状态。

- 命令：`pnpm test`
- 结果：通过，26 个测试文件，208 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。
