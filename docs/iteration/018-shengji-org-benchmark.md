# ITER-018 Shengji.org Quick Start Benchmark

## 功能名称

对齐 `shengji.org` 快速开始、牌桌信息层级、结算说明和机器人体验基准。

## 优先级

P0。

## 当前状态

In Progress。第一小闭环“快速机器人局一键自动开局”、第二小闭环“结算结果原因化文案”、第三小闭环“快速机器人局结算倒计时自动续局”、第四小闭环“牌桌顶部信息密度收敛”已完成；6 人模式和机器人策略样本池仍在后续小闭环。

## 背景

用户要求继续自主迭代，并明确要求“`shengji.org` 模仿该网站的快速开始模式，多多试玩，归纳其页面排布、记分规则和机器人策略，向其靠近”。

本任务不是复制外站实现，而是把外站中真实玩家能感知的顺畅流程提炼为本项目可验证的小闭环。

## 外站证据

来源：

- `https://shengji.org/`
- 静态 HTML：页面描述“AI机器人随时开局，不用等人，想玩就玩”，支持 4 人和 6 人模式。
- 公开前端 bundle：存在 `快速开始 4人`、`快速开始 6人`、`出牌提示按钮`、`甩牌失败`、`造反`、`庄家小胜 +1级`、`闲家总分`、`继续游戏`、`保存牌局` 等文案。
- 浏览器自动化试玩：
  - 4 人快速开始：点击 `快速开始 4人` 后直接进入房间并自动发牌，没有额外“开始游戏”步骤。
  - 4 人一局样本：机器人 D 亮 `♠2`，主花色变为 `♠`，级牌 `2`，庄家机器人 D，闲家最终 55 分，结算为“庄家小胜 +1级”，B 队从 2 升到 3，下一局庄家机器人 B，页面提示 10 秒后自动继续。
  - 出牌提示：点击 `💡 提示` 后自动选中推荐牌，操作按钮变为 `出牌(n)`，并保留 `等待...` 和 `上轮出牌` 入口。
  - 6 人快速开始：点击 `快速开始 6人` 后直接进入发牌/出牌；样本出现 `需要选9张牌` 的大牌型跟牌场景，说明多副牌/多张组合在 UI 上被直接表达。

截图证据：

- `docs/iteration/artifacts/ITER-018/shengji-org-landing.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-quick-start-4p.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-dealt-bid-state.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-hint-state.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-after-human-play-1.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-auto-play-sample-2.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-quick-start-6p.png`
- `docs/iteration/artifacts/ITER-018/shengji-org-quick-start-6p-after-wait.png`

## 当前本项目差距

### P0：快速开始仍需手动开始

修复前，`apps/web/src/pages/Lobby.tsx` 的“快速机器人局”会创建房间并设置 `sessionStorage('shengji:quickBots')`。`apps/web/src/pages/Room.tsx` 自动补机器人，但仍要求房主等按钮变为可用后手动点击 `开始游戏`。

外站单击快速开始后直接进入发牌/叫主/出牌流程，这也是用户之前“进入网站之后发现不能开始游戏”的直接痛点。

当前已改为：大厅 `开一桌` 标记快速开始请求；房间页自动补机器人；补满后房主自动发送一次 `GameStart`；普通创建房间仍保持手动开始。

### P1：结算说明不够原因化

本项目 `ResultModal.tsx` 展示闲家总分、底牌、获胜方、升级数、下局级牌和下局庄家。外站额外把结果翻译成玩家语言：

- `庄家小胜 +1级`
- `换庄 (不升级)`
- `闲家小胜 +1级`
- `庄家守住底牌 (无扣底)`
- `闲家(A队) 基础得分`
- `10秒后自动继续`

当前已改为：结算弹窗顶部固定展示 `庄家小胜 +1级`、`闲家小胜 +1级`、`换庄 (不升级)` 等结果文案；分开展示 `闲家基础得分`、`扣底说明`、`闲家总分`、`队伍升级`；快速机器人局结算后显示 `n 秒后自动继续` 并自动触发下一局。

### P1：牌桌顶部信息可以更集中

本项目 `StatusBar.tsx` 和 `ContractSummary.tsx` 已展示房间、阶段、级牌、主、庄、闲家分、亮牌/反主历史。外站把主花色、级牌、最新亮牌、闲家分和队伍级牌压缩到左上信息面板，常驻且扫视成本低。

当前已改为：`StatusBar` 只保留房间、阶段、当前操作方和离开入口；`ContractSummary` 统一展示当前亮牌/反主详情，并用结构化 facts strip 常驻展示 `主`、`队伍级牌`、`庄`、`闲家` 和反牌窗口，避免玩家在两条顶部栏之间反复扫描重复字段。

### P2：机器人策略只可从行为推断

外站公开前端没有暴露服务端策略实现。当前可观察到：

- 机器人会在发牌结束前后自动亮主。
- 机器人能主动领出大牌型/多张组合。
- 页面提供机器人反馈入口和 debug 文案，说明策略可被反馈和迭代。

本项目已有 `packages/bot/src/bid.ts`、`bury.ts`、`play.ts` 以及提示按钮，后续改动必须用规则测试和 E2E 固定样本验证，不用无法验证的“像不像”替代测试。

## 第一小闭环目标

把“快速机器人局”改为一次点击直达牌局：

1. 用户输入昵称后点击大厅 `开一桌`。
2. 系统创建房间、自动补机器人。
3. 所有座位补满后自动触发 `GameStart`。
4. UI 需要给出可感知的过渡反馈，例如 `正在快速开始...` 或 `机器人已补齐，正在开局...`。
5. 自动开始必须幂等，不能因为多次 `RoomStateView` 更新重复发送 `GameStart`。
6. 普通“创建房间”流程不变，仍可手动加机器人和手动开始。

## 后续小闭环候选

1. E2E 扩展：把下一局自动续局后的二局起始状态纳入 `pnpm test:e2e`。
2. 机器人策略样本池：用固定牌序采样并记录 bot 亮主、埋底、领牌、跟牌原因，避免只靠随机试玩评价。
3. 6 人模式调研与范围决策：外站支持 6 人快速开始，本项目当前 4 人状态机不应在未评估规则影响时直接扩展。

## 涉及模块 / 文件

- `apps/web/src/pages/Lobby.tsx`
- `apps/web/src/pages/Room.tsx`
- `apps/web/e2e/*.e2e.ts`
- `apps/web/src/components/ResultModal.tsx`
- `apps/web/test/resultModal.test.tsx`
- `packages/game/src/scoring.ts`
- `packages/game/test/scoring.test.ts`
- `packages/bot/src/*.ts`
- `packages/bot/test/bot.test.ts`
- `docs/iteration/todo.md`
- `docs/iteration/plan.md`
- `docs/iteration/test-report.md`
- `docs/iteration/review-notes.md`
- `docs/iteration/decision-log.md`

## 验收标准

第一小闭环：

- `pnpm test:e2e` 覆盖快速机器人局：点击 `开一桌` 后无需手动点击 `开始游戏`，最终进入 `叫主`、`埋底`、`出牌` 或 `结算` 中任一牌局阶段。
- 快速开始过程中能看到明确等待反馈。
- 快速开始只触发一次 `GameStart`，重复状态刷新不会报错或重复开局。
- 普通创建房间不自动开始。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

完整 ITER-018：

- 文档记录外站观察、推断和本项目采纳/不采纳原因。
- 至少有一条完整局 E2E 或浏览器自动化记录支撑结算页对齐。
- 机器人策略改动必须有规则/策略单测，不用纯视觉主观判断作为唯一证据。

## 测试方式

- 红绿测试：
  - 新增 E2E 先断言快速机器人局无需手动开始，红测应在旧代码下失败。
  - 修改 `Room.tsx` 后复跑该 E2E。
- 回归测试：
  - `pnpm test:e2e`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
- 手工/浏览器验证：
  - 打开 `http://localhost:5173/`
  - 输入昵称
  - 点击 `开一桌`
  - 观察不再停留在房间等待手动开始，而是进入牌局阶段
  - 保存截图到 `docs/iteration/artifacts/ITER-018/`

## 风险和回滚方式

风险：

- 自动开始如果不加一次性 guard，可能在机器人补齐后的多次状态刷新中重复发送 `GameStart`。
- 自动开始如果污染普通建房，会破坏邀请好友流程。
- 如果服务端 bot 补位异步返回较慢，前端必须显示等待状态而不是空白等待。

回滚：

- 回滚 `Lobby.tsx` 中快速开始 session 标记扩展。
- 回滚 `Room.tsx` 中自动开始 effect 和等待反馈。
- 回滚新增 E2E/测试和本文件状态更新。

## 执行记录

2026-07-22：

- 完成外站 4 人快速开始、提示出牌、完整一局结算样本采集。
- 完成外站 6 人快速开始/大牌型跟牌样本采集。
- 新增 `apps/web/e2e/quick-start.e2e.ts`：
  - 红测失败：旧代码停在 `4/4 人 ... 开始游戏`，没有进入牌局阶段。
  - 修复后通过：点击 `开一桌` 后无需手动点击 `开始游戏`，最终进入 `叫主|埋底|出牌|结算`；普通创建房间仍停留在等待室。
- 新增 `apps/web/src/lib/quickStart.ts` 和 `apps/web/test/quickStart.test.ts`，固定快速开始 session 标记生命周期。
- `Room.tsx` 增加快速开始状态反馈：
  - `正在快速开始，机器人入座中...`
  - `机器人已补齐，正在开局...`
- 新增 `packages/game/test/scoring.test.ts` 中的外站 55 分样本测试，锁定“庄家 55 分小胜 +1、无扣底、对家坐庄、B 队 2->3”的规则一致性。
- 修复 E2E 基础设施：`pnpm test:e2e` 新增文件后并行测试会抢占共享 seeded server 随机流，导致原亮主/反主 smoke 拿不到预期手牌；`playwright.config.ts` 设置 `workers: 1`。

### 第一小闭环验证

- `pnpm test:e2e apps/web/e2e/quick-start.e2e.ts`：红测失败后修复通过，2 个 chromium E2E。
- `pnpm test apps/web/test/quickStart.test.ts packages/game/test/scoring.test.ts`：通过，2 个测试文件，23 个测试。
- `pnpm test:e2e`：通过，3 个 chromium E2E。
- 本地截图：`docs/iteration/artifacts/ITER-018/screenshots/quick-start-auto-game.png`。

### 第二小闭环：结算原因化文案

- 红测命令：`pnpm test apps/web/test/resultModal.test.tsx`
- 红测结果：失败，旧弹窗不包含 `庄家小胜 +1级`、`换庄 (不升级)`、`庄家守住底牌 (无扣底)`、`闲家扣底成功，但底牌无分`。
- 修复：`ResultModal.tsx` 复用 `teamOfSeat` 判定庄家/闲家阵营，把 `RoundResultView` 转译为玩家语言；固定展示基础得分、扣底说明、总分和队伍升级。
- 复测命令：`pnpm test apps/web/test/resultModal.test.tsx`
- 复测结果：通过，1 个测试文件，4 个测试。

### 第三小闭环：快速机器人局结算自动继续

- 红测命令：`pnpm test apps/web/test/quickStart.test.ts apps/web/test/resultModal.test.tsx`
- 红测结果：失败，缺少 `clearQuickStartPending`/`isQuickStartRoom`，结算弹窗不显示 `10 秒后自动继续`。
- 修复：快速开始 session 拆分为“待绑定房间”和“已绑定快速房间”；自动开局后只清除 pending，不清除房间标记；`GameTable.tsx` 在快速房间 scoring 阶段启动 10 秒倒计时并自动发 `RoundNext`，`查看牌桌`、手动 `下一局`、离开房间会取消倒计时或清理 session。
- 复测命令：`pnpm test apps/web/test/quickStart.test.ts apps/web/test/resultModal.test.tsx`
- 复测结果：通过，2 个测试文件，8 个测试。
- E2E 命令：`pnpm test:e2e apps/web/e2e/quick-start.e2e.ts`
- E2E 结果：通过，3 个 chromium E2E；新增完整局场景从快速开局自动打到结算，断言 `本局结算`、结果文案、`闲家基础得分`、`扣底说明` 和 `秒后自动继续`。
- 截图：`docs/iteration/artifacts/ITER-018/screenshots/quick-start-explanatory-settlement.png`。
- 本地服务 smoke：`http://localhost:5173/` 点击 `开一桌` 后进入 `叫主`，没有停在 `开始游戏`；截图 `docs/iteration/artifacts/ITER-018/screenshots/local-latest-quick-start.png`。

### 第四小闭环：牌桌顶部信息密度收敛

- 红测命令：`pnpm test apps/web/test/contract.test.ts`
- 红测结果：失败，`describeContract` 没有结构化 `facts`，无法直接测试 `主`、`队伍级牌`、`庄`、`闲家` 等高频信息。
- 红测命令：`pnpm test apps/web/test/contractSummary.test.tsx`
- 红测结果：失败，`ContractSummary` HTML 不包含 `contract-facts`。
- 红测命令：`pnpm test apps/web/test/statusBar.test.tsx`
- 红测结果：失败，`StatusBar` 仍重复展示 `级牌`、`主`、`庄`、`闲家`。
- 修复：`apps/web/src/lib/contract.ts` 增加 `ContractFact` 和 facts 生成；`ContractSummary.tsx` 渲染紧凑 fact strip；`StatusBar.tsx` 收敛为房间/阶段/轮到/离开；CSS 增加响应式换行和紧凑横屏隐藏长 detail。
- 复测命令：`pnpm test apps/web/test/contract.test.ts apps/web/test/contractSummary.test.tsx apps/web/test/statusBar.test.tsx`
- 复测结果：通过，3 个测试文件，11 个测试。
- E2E 命令：`pnpm test:e2e apps/web/e2e/bidding-flow.e2e.ts`
- E2E 结果：通过，1 个 chromium E2E；断言反主后 `.contract-facts` 可见 `主`、`队伍级牌`、`庄`，紧凑横屏 `.contract-summary` 无横向溢出。
- 本地服务 smoke：`http://localhost:5173/` 点击 `开一桌` 后进入 `叫主`；`status-bar` 为 `房间 ... 叫主 轮到 你 离开`，`contract-facts` 为 `主 ... 队伍级牌 ... 庄 ...`。
- 截图：`docs/iteration/artifacts/ITER-018/screenshots/contract-facts-quick-start.png`。

### 当前全量验证

- `pnpm test`：通过，32 个测试文件，232 个测试。
- `pnpm typecheck`：通过。
- `pnpm build`：通过。
- `pnpm test:e2e`：通过，4 个 chromium E2E，49.2 秒。
- `git diff --check`：通过。

### 后续待推进

- 自动继续后第二局起始状态 E2E。
- 机器人策略样本池：继续采集外站可观察决策，再转成固定手牌测试。
