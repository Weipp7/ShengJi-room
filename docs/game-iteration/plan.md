# 牌局体验系统迭代计划

日期：2026-07-22
工作区：`/Users/weipanyue/shengji/.worktrees/codex-game-iteration-visibility`
分支：`codex/game-iteration-visibility`

## 目标

围绕完整牌局体验做一次产品、工程、测试闭环迭代，重点保证亮牌/反主阶段的玩家可感知反馈完整、准确、稳定，同时补齐等待、出牌、结算和不同窗口尺寸下的关键信息表达。

本轮明确修复目标：

- 亮牌/反主发生时，界面清晰展示操作者、操作类型、亮出的牌、主花色/主级牌变化。
- 这类信息展示在玩家能看到的位置，不只存在于 `RoomStateView.currentBid`、日志或测试状态里。
- 流程中不能依赖短暂动画作为唯一信息源；当前契约、当前行动者和出牌归属必须有持久表达。

## 当前代码事实

- 规则状态机在 `packages/game/src/round.ts`，叫主由 `applyReveal` / `applyPass` 驱动，`currentBid`、`dealerSeat`、`trump` 会随亮牌变化。
- 叫主合法性在 `packages/game/src/bidding.ts`，强度为单张级牌 < 同花色级牌对 < 小王对 < 大王对；同强度不同花色不能反主。
- 服务端投影在 `apps/server/src/app.ts#projectRoomState`，客户端只收到最新快照。
- 前端叫主公告由 `apps/web/src/lib/announcements.ts` 从前后两个 `RoomStateView` 快照推导。
- `apps/web/src/components/TrickArea.tsx` 有 bidding 阶段的当前叫主卡，但 bidding 结束后消失。
- `apps/web/src/pages/GameTable.tsx` 在最终进入 scoring 时无法可靠知道最后一墩赢家，因为投影中 `turnSeat` 在 scoring 阶段为 `null`。

## 多角色分工

- 产品经理 / 首次玩家体验官：检查新玩家能否理解“谁做了什么、现在等谁、当前主是什么、为何阶段切换”。
- 规则专家 / 对抗评审者：检查叫主强度、反主、主牌、出牌、结算、快速重复操作和快照丢事件风险。
- 前端交互评审 / QA：检查视觉层级、等待反馈、无障碍、移动端/窗口尺寸、浏览器验证路径。
- 工程实现者：按 TDD 小步改动，优先修复明确需求和 P1 体验缺口。
- Release Reviewer：确认文档、测试证据、回滚路径和验收标准。

## 主要风险与处理策略

| 风险 | 根因 | 策略 |
| --- | --- | --- |
| 旧公告排队导致叙事落后 | bot 600-1200ms 行动快于 banner 2.4-3.5s | phase 变更时清理未展示的叫主公告；新增持久“本局契约”作为权威状态 |
| 反主文字不说明主是否真的变化 | 当前文案只说“主改为 X” | 对比前后 bid，明确“主从 X 改为 Y”或“主仍是 X，级牌不变” |
| bidding 结束后玩家忘记谁赢得叫主 | 当前叫主卡只在 bidding 展示 | burying/playing/scoring 保留 compact contract summary |
| 最后一墩赢家不可见 | scoring 投影不带最后一墩赢家 | 在共享状态加 `lastTrickWinnerSeat`，服务端投影并由前端 settled 区使用 |
| 等待反馈泛泛 | ActionBar 只说“等待其他玩家” | 等待文案命名行动者和动作，bot 明示为机器人 |
| 出牌归属要靠空间推断 | TrickArea 只显示牌 | 每个出牌槽显示玩家名，settled 阶段显示赢家 |
| 快速点击造成误导错误 | 按钮无 in-flight 锁 | 本轮至少补稳定错误/状态测试和文档记录；交互锁如改动风险过高则列为后续 |
| 移动端重叠 | 绝对定位和固定宽度 | 加 compact landscape CSS，并用浏览器截图验证 |

## 任务拆分

### T1：规则/状态可投影性测试与最终赢家字段

文件：

- `packages/shared/src/state.ts`
- `apps/server/src/app.ts`
- `apps/server/test/socket.test.ts`
- `apps/web/src/pages/GameTable.tsx`

验收：

- scoring 状态的 `RoomStateView` 含 `lastTrickWinnerSeat`。
- 最后一墩 settled 展示能显示赢家，而不是退化为“本墩结束”。

### T2：公告与契约摘要文案 TDD

文件：

- `apps/web/src/lib/announcements.ts`
- `apps/web/test/announcements.test.ts`
- 新增 `apps/web/src/lib/contract.ts`
- 新增 `apps/web/test/contract.test.ts`

验收：

- 首亮/反主文案包含操作者、操作类型、亮出的牌、主变化、级牌不变。
- 同主花色更强反主时明确“主仍是 X，级牌 Y 不变”。
- 跨主花色/无主反主时明确“主从 X 改为 Y，级牌 Y 不变”。
- 无人亮主时明确“无人亮主、本局无主、兜底庄家”。

### T3：持久 UI 状态与等待反馈

文件：

- 新增 `apps/web/src/components/ContractSummary.tsx`
- `apps/web/src/components/TrickArea.tsx`
- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/pages/GameTable.tsx`
- `apps/web/src/styles.css`

验收：

- bidding 阶段：当前叫主卡仍可见。
- burying/playing/scoring 阶段：能看到庄家、主花色/无主、级牌、赢得叫主的人和亮出的牌；无人亮主时显示兜底说明。
- ActionBar 等待文案命名行动者：等待谁叫主/埋底/出牌，机器人座位显示“机器人”。
- 当前 trick 每个已出牌槽标注操作者。

### T4：公告队列可靠性与交互可见性

文件：

- `apps/web/src/components/AnnouncementBanner.tsx`
- 新增或扩展 web 单测

验收：

- `role="status"` / `aria-live="polite"`。
- phase 事件进入时清掉未展示的 bid/counter 队列，避免进入埋底/出牌后继续展示旧亮牌。
- banner 文本可换行，不遮挡核心交互。

### T5：浏览器自动化完整流程

文件：

- `docs/game-iteration/test-report.md`
- 截图目录：`docs/game-iteration/screenshots/`

验收：

- 运行现有测试、类型检查、构建。
- 浏览器实际启动 server + web，完成至少一个 1 真人 + 3 bot 流程。
- 截图/DOM 证据证明 UI 可见“哪家亮了什么 / 哪家反了什么”、当前主、庄家、等待方、出牌归属。
- 1440x900、1280x720、844x390 至少各检查关键界面无明显遮挡。

### T6：多角色复审与发布整理

文件：

- `docs/game-iteration/review-notes.md`
- `docs/game-iteration/feature-log.md`
- `docs/game-iteration/rollback.md`
- `docs/game-iteration/test-report.md`

验收：

- 每条 agent 评审 P1/P2 结论均记录“采纳/延期/原因”。
- 文档列明修改点、测试命令、失败和修复记录、回滚建议。

## 验收标准

1. 任一玩家亮牌，所有客户端可见：操作者、亮牌、牌面、主花色/级牌影响。
2. 任一玩家反主，所有客户端可见：操作者、反主、牌面、压过谁、主是否改变、级牌是否改变。
3. 当前主花色/无主、主级牌、庄家、赢得叫主者在 bidding 之后仍能找到。
4. 玩家等待时能看到等待对象和动作，不只看到“等待其他玩家”。
5. 出牌阶段能理解当前轮次、当前出牌方、已出牌归属和收墩结果。
6. 快速重复操作、无效反主、无人亮主、重连/快照无历史场景不造成 UI 误导。
7. 全量 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。
8. 浏览器自动化验证有截图、路径和 DOM 断言记录。

## 明确延期项

- 跨队反主是否切换级牌：现有规则是“本局级牌由计划庄家队伍确定，反主只改变庄家和主花色”。这是已有 MVP 规则实现，先文档化并测试不回归；如要改为“反主后按新庄家队伍级牌”，需要单独规则设计。
- 完整键盘/读屏级卡牌操作：本轮会加 live region 和更清晰文案；把 CardFace 改成 button 会影响大量布局与交互，列入后续无障碍专项。
- 多真人 deterministic E2E 脚本：本轮用浏览器真实 1 真人 + 3 bot 流程和组件/状态测试覆盖；多客户端完全脚本化需要测试注入/固定牌序支持。
