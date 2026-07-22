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

## ITER-001 快速/重复操作的幂等与可理解错误反馈

### 第一小闭环：前端 pending 锁

#### 红测记录

- 命令：`pnpm test apps/web/test/actionBar.test.tsx apps/web/test/playHint.test.ts apps/web/test/handFan.test.tsx`
- 结果：失败，ActionBar pending 场景 HTML 不包含 `处理中…`，按钮仍为可用态。
- 结论：服务端动作提交后缺少玩家可见的等待反馈，也不能阻止重复点击。

#### 修复后验证

- 命令：`pnpm test apps/web/test/actionBar.test.tsx apps/web/test/playHint.test.ts apps/web/test/handFan.test.tsx`
- 结果：通过，3 个测试文件，10 个测试。
- 覆盖：pending 出牌、pending 过牌、提示按钮、推荐高亮和 ActionBar 既有文案不回归。

- 命令：`pnpm test`
- 结果：通过，26 个测试文件，212 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

- 命令：`git diff --check`
- 结果：通过，无 whitespace error。

#### 浏览器验证

- 命令：`pnpm dev`
- URL：`http://localhost:5173/`
- 亮主阶段路径：页面位于真人叫主回合，DOM 显示 `♠♥♦♣王小对过`；快速连续点击 `过` 后进入机器人叫主/庄后反牌流程，toast 为空。
- 出牌阶段路径：真人跟牌回合，先选中一张黑桃，再对 `出牌` 执行双击；页面只推进到等待下一位机器人出牌，toast 为空。
- 对抗发现：第一版浏览器验证中连续点击可能发生在 React disabled 重绘之前，因此补了同步 `pendingActionRef` 锁后重新验证。

### 第二小闭环：错误提示持久化与可关闭

#### 红测记录

- 命令：`pnpm test apps/web/test/errors.test.ts apps/web/test/errorToast.test.tsx`
- 结果：失败，`errors` 格式化模块和 `ErrorToast` 组件不存在。
- 结论：错误仍是短字符串 toast，无法携带错误 code、解释文案和关闭行为。

#### 修复后验证

- 命令：`pnpm test apps/web/test/errors.test.ts apps/web/test/errorToast.test.tsx apps/web/test/actionBar.test.tsx`
- 结果：通过，3 个测试文件，8 个测试。
- 覆盖：`wrong-turn` 解释文案、unknown code fallback、错误 alert、关闭按钮、`data-error-code`、pending ActionBar 回归。

- 命令：`pnpm test`
- 结果：通过，28 个测试文件，215 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

#### 浏览器验证

- 命令：`pnpm dev`
- URL：`http://localhost:5173/`
- 交互路径：真人领牌回合选中两张不同黑桃 -> 点击 `出牌` -> 服务端返回非法甩牌/非法组合类错误。
- 结果：DOM 记录 `toastCode=invalid-throw`，错误文本在约 3.95 秒后仍存在，`closeCount=1`；点击 `关闭错误提示` 后 `toastText=""` 且 `closeCount=0`。

### 第三小闭环：socket 级重复动作断言

#### 红测 / 夹具调试记录

- 命令：`pnpm test apps/server/test/gameFlow.test.ts`
- 结果：失败，新增重复动作测试超时。
- 结论：测试夹具在最后才让 host 等“全员入座”，可能错过 seat take 广播；不是业务状态机失败。
- 修复：`createFourHumanRoom` 改为每次 seat take 前先订阅 host 对应座位更新，再发起动作。

#### 修复后验证

- 命令：`pnpm test apps/server/test/gameFlow.test.ts`
- 结果：通过，1 个测试文件，7 个测试。
- 覆盖：重复 `BidPass` 只推进到下一家，重复 `TrickPlay` 只落一张牌且只移除一次手牌，重复 `RoundNext` 只推进一局。

- 命令：`pnpm test`
- 结果：通过，28 个测试文件，218 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

## ITER-002 确定性 E2E 与多客户端浏览器验证基础设施

### 第一小闭环：Playwright 两客户端亮主/反主 smoke

#### 失败记录

- 命令：`pnpm test:e2e`
- 结果：失败，`http://127.0.0.1:3101/healthz is already used`。
- 修复：不终止未知 node 进程，改用 `43101/45175`。

- 命令：`pnpm test:e2e`
- 结果：失败，host 本人视角显示 `你 亮主`，测试错误期待 `E2E甲 亮主`。
- 修复：测试区分本人视角和其他玩家视角。

- 命令：`pnpm test:e2e`
- 结果：失败，guest 小王反主按钮 accessibility name 不是 `王小单`。
- 修复：点击稳定的 `button.bid-nt.lit`，并通过结果文案断言反主成功。

- 命令：`pnpm test`
- 结果：失败，Vitest 收集了 Playwright `.spec.ts`。
- 修复：E2E 文件改名为 `.e2e.ts`，Playwright config 显式 `testMatch`。

#### 修复后验证

- 命令：`pnpm test:e2e`
- 结果：通过，1 个 chromium E2E。
- 覆盖：两个 browser context 进入同一房间，seat0 亮 ♣2，seat1 用小王反主；host/guest 两端都能看到亮主/反主、当前主和等待方。

- 命令：`pnpm test`
- 结果：通过，29 个测试文件，221 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

#### 截图

- `docs/iteration/artifacts/ITER-002/screenshots/two-context-counter-host.png`
- `docs/iteration/artifacts/ITER-002/screenshots/two-context-counter-guest.png`

### 第二小闭环：紧凑横屏响应式断言

#### 失败记录

- 命令：`pnpm test:e2e`
- 结果：失败，新增 `.player-badge` bounding-box 断言捕获重叠：`E2E甲25 张思考中… / 机器人425 张`。
- 修复：`max-width: 900px` 横屏 CSS 中将 `.player-left` 调整为 `top: 34%`，避开左下角玩家徽章。

#### 修复后验证

- 命令：`pnpm test:e2e`
- 结果：通过，1 个 chromium E2E。
- 覆盖：`844x390` 横屏第三 context 可见反主状态；document/body/status/action 无横向溢出；玩家徽章无互相重叠。

- 命令：`pnpm test`
- 结果：通过，29 个测试文件，221 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。

#### 截图

- `docs/iteration/artifacts/ITER-002/screenshots/two-context-counter-compact.png`

### 第三小闭环：刷新重连恢复反主状态

#### 修复后验证

- 命令：`pnpm test:e2e`
- 结果：通过，1 个 chromium E2E。
- 覆盖：guest 小王反主后刷新页面；刷新后仍显示同一房间码、反主文案、小王单张和 `E2E乙`。

- 命令：`pnpm test`
- 结果：通过，29 个测试文件，221 个测试。

- 命令：`pnpm typecheck`
- 结果：通过，`pnpm -r exec tsc --noEmit` 无错误。

- 命令：`pnpm build`
- 结果：通过，shared/game/bot/server/web 均构建成功。
