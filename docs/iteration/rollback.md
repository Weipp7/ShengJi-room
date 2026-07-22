# Iteration Rollback Guide

更新时间：2026-07-22

## 使用方式

- 优先按 git 提交回滚；如果需要手工回滚，按本文件列出的模块顺序处理。
- 回滚业务代码后必须同步回滚或更新对应测试和 `docs/iteration/*` 状态，避免文档声称的能力和代码不一致。
- 回滚前先运行 `git status --short`，确认是否有用户未提交改动；不要覆盖不属于本次迭代的文件。

## ITER-018 Shengji.org 快速开始与牌桌体验基准对齐

### 关键改动

- `apps/web/src/lib/quickStart.ts`：新增快速开始 pending/room 标记生命周期。
- `apps/web/src/pages/Lobby.tsx`：`开一桌` 写入快速开始请求。
- `apps/web/src/pages/Room.tsx`：快速房间自动补机器人，补满后自动开局。
- `apps/web/src/pages/GameTable.tsx`：快速房间结算阶段显示倒计时并自动发 `RoundNext`。
- `apps/web/src/components/ResultModal.tsx`：结果原因化文案、基础得分、扣底说明、队伍升级、自动继续倒计时。
- `apps/web/src/lib/contract.ts` / `apps/web/src/components/ContractSummary.tsx`：结构化 contract facts，集中展示主、队伍级牌、庄、闲家分和反牌窗口。
- `apps/web/src/components/StatusBar.tsx`：收敛为房间、阶段、当前操作方和离开入口。
- `apps/web/src/styles.css`：快速开始状态、结算结果条和倒计时样式。
- `apps/web/e2e/quick-start.e2e.ts`：快速开局、完整局到结算、普通房间不自动开局的浏览器回归。
- `apps/web/test/quickStart.test.ts`、`apps/web/test/resultModal.test.tsx`、`packages/game/test/scoring.test.ts`：快速 session、结算 UI 和外站 55 分样本覆盖。
- `playwright.config.ts`：E2E 串行运行，避免共享 seeded server 随机流互相污染。

### 手工回滚路径

1. 恢复 `Room.tsx` 为只自动补机器人、不自动触发 `GameStart` 的行为，或同时移除 `Lobby.tsx` 的 quick-start session 标记。
2. 删除 `quickStart.ts` 新增 helper 和对应单测。
3. 恢复 `ResultModal.tsx` 原结算布局，移除 `GameTable.tsx` 自动继续 effect 和倒计时传参。
4. 恢复 `StatusBar.tsx` 原主/级/庄/闲家分字段，移除 `ContractSummary.tsx` 的 `contract-facts` 和 `contract.ts` 的 `facts` 字段。
5. 删除或调整 `quick-start.e2e.ts`、`bidding-flow.e2e.ts` 中依赖新行为的断言。
6. 如果回滚完整 `ITER-018`，恢复 `playwright.config.ts` 的并行配置；如果仍保留多个共享 seeded E2E，则不要恢复并行。
7. 更新 `todo.md`、`plan.md`、`test-report.md`、`review-notes.md`、`decision-log.md` 和 `018-shengji-org-benchmark.md`。

### 风险说明

- 只回滚自动续局但保留一键开局时，必须让 `Room.tsx` 开局后重新调用 `clearQuickStartSession()`，否则 session 中会残留快速房间标记。
- 只回滚结算文案但保留完整局 E2E 时，`quick-start.e2e.ts` 的结算文案断言会失败，需要同步修改测试。
- 只回滚顶部信息面板但保留 `StatusBar` 收敛时，主/级/庄/分信息会从牌桌消失；必须成对回滚或成对保留。
- 恢复 E2E 并行前，必须先解决 per-test/per-room seed 隔离；否则亮主/反主 smoke 可能再次因随机流被抢占而不稳定。
