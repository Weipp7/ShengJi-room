# ITER-017 Bugfix Regression Pool

## 功能名称

扩展功能缺陷池与回归修复流程

## 优先级

P0

## 当前状态

In Progress

## 背景

用户要求“大幅改进机器人亮庄、跟牌策略和多项 bug 修复”。多项 bug 修复不能作为口头承诺，需要一个统一入口记录发现、复现、修复、验证和回滚。

## 需要解决的问题

- 试玩中发现的新 bug 需要先记录，再判断是否阻塞当前功能。
- 规则扩展后容易产生状态跳变、重复操作、bot 非法牌、UI 文案错位等回归。
- 如果每个 bug 混入功能提交，后续回滚会困难。
- 需要区分阻塞当前验收的 bug 和可排期 bug。

## 用户可感知收益

- 修复过程可追踪，不会出现“感觉修了但不知道修了什么”。
- 每个试玩问题都有复现路径和测试证据。
- 回滚时能按 bug 或功能粒度处理。

## 涉及模块 / 文件

- `docs/iteration/todo.md`
- `docs/iteration/decision-log.md`
- `docs/iteration/*`
- `apps/server/test/*`
- `apps/web/test/*`
- `packages/game/test/*`
- `packages/bot/test/*`

## 实现思路

1. 在本文件维护缺陷处理规则；具体 bug 记录在对应功能文档执行记录中。
2. bug 进入当前迭代的条件：阻塞验收、造成数据错乱、造成非法出牌、或玩家无法继续牌局。
3. 每个 bug 先写复现步骤和失败测试，再修复。
4. 修复后记录测试命令、浏览器路径或截图证据。
5. 非阻塞 bug 写入 `todo.md` 或对应后续 `ITER-xxx`。

## 验收标准

- 每个已修 bug 都有复现描述。
- 每个行为 bug 都有自动测试或明确说明为什么只能浏览器验证。
- 当前迭代不会携带未记录的 bugfix。
- bugfix 提交信息能关联 `ITER-xxx`。

## 测试方式

- 依据具体 bug 运行最小测试。
- 每轮合并前运行 `pnpm test`、`pnpm typecheck`。
- UI/流程 bug 补浏览器验证和截图。

## 风险和回滚方式

- 风险：缺陷池变成无限 backlog。
- 控制：只有阻塞当前验收的 bug 才插队；其他问题记录后排期。
- 回滚：按 bugfix 提交回滚，或回滚对应功能任务。

## 依赖

- `ITER-000`

## 执行记录

2026-07-22 启动缺陷池。输入来源：

- 本地代码阅读：`GameTable.tsx`、`TrickArea.tsx`、`store.tsx`、`app.ts`、`botRunner.ts`、`round.ts`、`throw.ts`、`play.ts`。
- QA/回归只读 agent：扫描测试、文档和近期提交。
- 对抗工程只读 agent：扫描状态机、UI 状态和竞态风险。

## 缺陷池

| ID | 优先级 | 状态 | 缺陷 | 影响 | 复现入口 | 进入当前迭代 | 建议验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-017-001 | P0 | Done | 重连/刷新后上一墩回放覆盖已经开始的当前墩，并在驻留期间禁用出牌 | 玩家看到旧墩、赢家和当前轮次不一致，直接对应“每墩结束莫名回放上一墩”的体验风险 | 初始 `RoomStateView` 已有 `lastTrick` 四手，同时 `currentTrick.length > 0` 且轮到当前玩家 | 已修 | `pnpm test apps/web/test/settledReview.test.ts apps/web/test/trickArea.test.tsx` |
| BUG-017-002 | P0 | Ready | 甩牌失败判定把队友也当成“可压住的人” | 合法甩牌被误判失败，实际出牌和罚分错误，污染结算 | seat 0 甩两对，seat 2 队友持有更大同花色对子，敌方无可压对子 | 是；BUG-017-001 后处理 | `pnpm test packages/game/test/throw.test.ts packages/game/test/round.test.ts packages/game/test/scoring.test.ts` |
| BUG-017-003 | P1 | Backlog | 快速重复点击动作会把成功操作后的第二次请求显示成 `wrong-turn`/`wrong-phase` | 玩家误以为成功操作失败或规则不可信 | 连续双击 `过`、`出牌`、`确认埋牌`、`下一局` | 否；由 ITER-001 专项处理 | `pnpm test apps/server/test/socket.test.ts apps/server/test/gameFlow.test.ts apps/web/test/actionBar.test.tsx` |
| BUG-017-004 | P1 | Backlog | 失败甩牌后未实际出的尝试牌仍可能保持选中 | 下一次轮到玩家时可能误出残留选择 | 玩家选 4 张甩牌失败，实际只领出其中一对，剩余一对仍在手牌 | 否；与甩牌 UI/选择状态一并处理 | 需要 GameTable 级交互测试或 E2E |
| BUG-017-005 | P1 | Backlog | 结墩驻留只在客户端和 bot delay 实现，服务端不阻止真人通过 socket 抢跑 | 一个客户端还在看上一墩，另一个客户端已推进下一墩，造成状态跳变 | 第四家落牌后赢家立即发送下一墩 `TrickPlay` | 否；需先决定强制服务端 settle 还是仅前端响应新 `currentTrick` | socket 测试 + 浏览器多客户端 |
| BUG-017-006 | P2 | Backlog | 跟牌阶段选择 4 张也显示“出牌 / 甩牌” | 文案误导玩家以为非首家也能甩牌 | 非首家跟 4 张时操作栏文案 | 否；小 UI 文案修复 | `pnpm test apps/web/test/actionBar.test.tsx` |
| BUG-017-007 | P2 | Backlog | 收墩驻留期间仍可选择手牌 | 驻留结束后可能带着预选牌进入下一手，削弱复盘体验 | 一墩结束 3 秒驻留时点击手牌 | 否；归入 ITER-007 或选择状态专项 | 组件测试或 E2E |
| BUG-017-008 | P2 | Backlog | bot fallback 如果产生非法跟牌，`botRunner` 只 log 后停止调度 | 极端情况下房间可能卡在 bot 回合 | 构造 `explainPlay` fallback 后 `validateFollow` 失败 | 否；需要 property test 设计 | `pnpm test packages/bot/test/bot.test.ts apps/server/test/botRunner.test.ts` |

## 非缺陷增强

- 混合甩牌、对子加拖拉机、跨花色甩牌。
- bot 主动甩牌和长期记牌/概率模型。
- 跨队反主是否切换本局级牌。
- 仓库内 Playwright 固定牌序 E2E。
- 键盘/无障碍、长昵称和聊天布局硬化。

## 当前小闭环

已处理 `BUG-017-001`。理由：

- 直接对应用户已经反馈过的“上一墩回放/赢家显示不可信”体验。
- 不需要改变服务端协议即可先修复当前墩已开始时的错误回放。
- 可用纯 helper 测试锁定，避免缺少 GameTable 交互测试框架造成回归。

### BUG-017-001 修复记录

- 红测：
  - `pnpm test apps/web/test/settledReview.test.ts apps/web/test/trickArea.test.tsx`
  - 失败：`settledReview` 模块不存在。
  - 新增测试锁定：
    - 当前墩已经有 `currentTrick` 时不启动上一墩驻留；
    - `lastTrickWinnerSeat` 缺失时不使用 `turnSeat` 冒充上一墩赢家；
    - 当前墩开始时 settled review state key 必须变化。
- 实现：
  - 新增 `apps/web/src/lib/settledReview.ts`，集中管理上一墩驻留 key 与判定。
  - `GameTable.tsx` 改为只在 `phase=playing`、`currentTrick.length=0`、`lastTrick` 完整时启动驻留。
  - 驻留赢家只使用 `lastTrickWinnerSeat`；缺失时显示“本墩结束”，不再回退到 `turnSeat`。
  - effect 依赖纳入当前墩牌面，下一墩开始会立即清除旧驻留。
- 验证：
  - `pnpm test apps/web/test/settledReview.test.ts apps/web/test/trickArea.test.tsx` 通过，2 个测试文件，8 个测试。
  - `pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx` 通过，3 个测试文件，8 个测试。

## 下一小闭环

`BUG-017-002`：甩牌失败判定必须只看对手，不能把队友可压住误判为失败。
