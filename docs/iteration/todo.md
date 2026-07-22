# Shengji Long-Term Iteration Todo

更新时间：2026-07-22
工作区：`/Users/weipanyue/shengji/.worktrees/codex-game-iteration-visibility`
分支：`codex/game-iteration-visibility`

## 使用规则

- 任何后续代码修改必须先对应到本文件中的一个功能项。
- 每次只推进一个 `In Progress` 功能；发现新问题先记录到本文件或 `decision-log.md`，再判断是否阻塞当前验收。
- 每个功能开始前必须重读对应 `docs/iteration/NNN-*.md` 的目标、验收标准和验证方式。
- 代码修改完成后必须更新对应功能文档的执行记录、测试结果、失败记录和回滚说明。
- 未经记录，不扩大范围；只有阻塞当前验收的问题可以插队。

## 状态说明

- `Backlog`：已识别，尚未开始。
- `Ready`：依赖满足，可作为下一项启动。
- `In Progress`：当前正在推进。
- `Blocked`：缺少决策或前置条件。
- `Done`：验收和文档证据完整。

## 功能清单

| ID | 功能名称 | 优先级 | 状态 | 依赖 | 详情文档 | 主要证据来源 |
| --- | --- | --- | --- | --- | --- | --- |
| ITER-000 | 基线收敛与分支治理 | P0 | Done | 无 | `000-baseline-governance.md` | 当前 worktree 有大量未提交改动；README 第一版限制；`docs/game-iteration/test-report.md` |
| ITER-001 | 快速/重复操作的幂等与可理解错误反馈 | P0 | Backlog | ITER-000 | `001-action-idempotency-error-feedback.md` | `ActionBar.tsx` 无 in-flight 锁；`apps/server/src/app.ts#act`; rules review P2 |
| ITER-002 | 确定性 E2E 与多客户端浏览器验证基础设施 | P0 | Backlog | ITER-000 | `002-deterministic-e2e-harness.md` | `docs/game-iteration/test-report.md` 标注浏览器脚本未纳入仓库；UI QA matrix |
| ITER-003 | 卡牌操作无障碍与键盘/触屏一致性 | P0 | Backlog | ITER-002 | `003-card-accessibility.md` | `CardFace.tsx` 使用 clickable div；UI QA P0 |
| ITER-004 | Bot 调度竞态、取消和驻留节奏测试 | P1 | Backlog | ITER-000 | `004-bot-scheduler-race-coverage.md` | `botRunner.test.ts` 只测 delay range；`botRunner.ts` pending timer |
| ITER-005 | 规则边界与结算端到端测试补齐 | P1 | Done | ITER-000 | `005-rule-boundary-coverage.md` | rules review: cross-team level, no-trump, broken follow, kitty multiplier |
| ITER-006 | 响应式、聊天抽屉和长昵称布局硬化 | P1 | Backlog | ITER-002 | `006-responsive-chat-layout.md` | UI QA P1；当前 CSS 固定 chat drawer 与 absolute table regions |
| ITER-007 | 收墩驻留体验：倒计时、跳过和下一手说明 | P1 | Backlog | ITER-001, ITER-004 | `007-settled-trick-review-ux.md` | Product review P2；`GameTable.tsx` 固定 3s hold |
| ITER-008 | 重连、旁观、多标签与离线状态恢复验证 | P2 | Backlog | ITER-002 | `008-reconnect-offline-resilience.md` | `store.tsx` localStorage reconnect；server per-player rooms；existing duplicate connection tests |
| ITER-009 | 发布、部署和回滚证据规范化 | P2 | Backlog | ITER-000 | `009-release-hardening.md` | README 第一版限制；Dockerfile；docs/game-iteration rollback |
| ITER-010 | 机器人亮庄与反主策略升级 | P1 | Done | ITER-013, ITER-014 | `010-bot-bidding-counter-strategy.md` | 用户新增目标；`packages/bot/src/bid.ts`; `packages/game/src/bidding.ts` |
| ITER-011 | 机器人埋牌策略升级 | P1 | Done | ITER-005 | `011-bot-bury-strategy.md` | 用户新增目标；`packages/bot/src/bury.ts`; `packages/game/src/scoring.ts` |
| ITER-012 | 高级机器人领牌与跟牌策略升级 | P1 | Done | ITER-016 | `012-advanced-bot-play-strategy.md` | 用户新增目标；`packages/bot/src/play.ts`; `packages/game/src/follow.ts`; `packages/game/src/trick.ts` |
| ITER-013 | 任意张数亮庄、大小王反主与亮牌强度模型 | P0 | Done | ITER-000 | `013-flexible-reveal-counter-rules.md` | 用户新增目标；现有 `BidDeclaration.cards` 与 `BidStrength` 只覆盖单张/对子 |
| ITER-014 | 庄前反牌与庄后反牌阶段 | P0 | Done | ITER-013 | `014-pre-post-dealer-counter-phases.md` | 用户新增目标；`packages/game/src/round.ts`; bidding -> bury -> play 状态机 |
| ITER-015 | 出牌提示按钮与可解释推荐 | P1 | Done | ITER-012 | `015-play-hint-button.md` | 用户新增目标；`ActionBar.tsx`; `HandFan.tsx`; bot play evaluator |
| ITER-016 | 甩牌功能与失败惩罚结算 | P0 | Done | ITER-005, ITER-013 | `016-throw-play-and-penalty.md` | 用户新增目标；combo/follow/trick/scoring 规则链路 |
| ITER-017 | 扩展功能缺陷池与回归修复流程 | P0 | In Progress | ITER-000 | `017-bugfix-regression-pool.md` | 用户新增目标“多项 bug 修复”；当前体验 review 与测试缺口 |

## 阶段进度

当前完成项：`ITER-000 基线收敛与分支治理`，已通过提交当前 worktree 建立可追踪基线。

当前完成项：`ITER-013 任意张数亮庄、大小王反主与亮牌强度模型`。

当前完成项：`ITER-014 庄前反牌与庄后反牌阶段`。

当前完成项：`ITER-010 机器人亮庄与反主策略升级`。

当前完成项：`ITER-005 规则边界与结算端到端测试补齐`。

当前完成项：`ITER-016 甩牌功能与失败惩罚结算`。

当前完成项：`ITER-011 机器人埋牌策略升级`。

当前完成项：`ITER-012 高级机器人领牌与跟牌策略升级`。

当前完成项：`ITER-015 出牌提示按钮与可解释推荐`。

当前推进项：`ITER-017 扩展功能缺陷池与回归修复流程`。当前小闭环为 `BUG-017-001`：修复重连/刷新后上一墩回放覆盖当前墩、赢家显示不可信的回归风险。

## 已知延期但必须追踪

- Playwright 或等价 E2E 框架尚未接入仓库；当前浏览器证据来自手工/脚本运行记录。
- 生产部署仍是单实例内存状态；房间重启清空是 MVP 限制。
- 完整规则变体未全部决策，尤其是“跨队反主是否切换本局级牌”。
- 错误提示目前 3 秒自动消失，缺少持久、可复查的错误记录。
- 卡牌是 `div` 点击，不具备按钮语义、焦点态、键盘选择、`aria-pressed`。
- 亮庄强度、大小王反主和庄前/庄后反牌已有基础规则文档和测试；跨队反主是否切换本局级牌等地方变体仍未决策。
- 现有 bot 出牌偏保守，缺少针对领牌、跟牌、保分、杀牌、垫牌、甩牌的统一评估器。
- 甩牌第一版已实现同一有效花色多对子甩牌；混合甩牌、bot 主动甩牌和自动化 E2E fixture 继续由后续任务追踪。
