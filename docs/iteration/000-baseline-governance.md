# ITER-000 Baseline Governance

## 功能名称

基线收敛与分支治理。

## 优先级

P0。

## 当前状态

Done。当前 worktree 的既有业务改动、新增文档和验证证据将在本轮基线提交中固化。

## 背景

上一轮迭代已经修改亮主/反主、契约摘要、等待反馈、收墩赢家等功能，但尚未提交。继续开发前必须把当前状态整理成可 review、可回滚的基线，否则后续任务会混入旧变更。

## 需要解决的问题

- 当前分支 HEAD 与 `main` 相同，但工作树包含大量未提交改动。
- `docs/game-iteration/` 是专题档案，不是长期任务入口。
- 后续每个功能需要明确起点、测试基线和回滚策略。

## 用户可感知收益

后续试玩反馈可以准确定位到某个任务和改动批次，避免“修 A 时把 B 搞坏”却无法回滚。

## 涉及模块 / 文件

- Git/worktree：`/Users/weipanyue/shengji/.worktrees/codex-game-iteration-visibility`
- 文档：`docs/game-iteration/*`、`docs/iteration/*`
- 验证命令：`pnpm test`、`pnpm typecheck`、`pnpm build`

## 实现思路

1. 读取 `git status --short` 和 `git diff --stat`，确认变更范围。
2. 运行全量测试、类型检查、构建，记录基线。
3. 决定当前大批改动的处理方式：
   - 单一提交：适合继续在当前分支上 review。
   - 拆分提交：适合把文档、状态模型、UI、测试分开 review。
   - 暂不提交：适合继续快速迭代，但需要明确风险。
4. 在 `decision-log.md` 记录选择。

## 验收标准

- `todo.md` 中 `ITER-000` 状态更新为 `Done`。
- 有一条明确的分支处理决策。
- 最新 `pnpm test`、`pnpm typecheck`、`pnpm build` 结果被记录。
- 当前基线的回滚方式明确。

## 测试方式

- `git status --short`
- `git diff --stat`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`

## 风险和回滚方式

- 风险：过早提交会把仍需 review 的代码固化；过晚提交会让后续任务难以拆分。
- 回滚：如果只改文档，删除 `docs/iteration/` 即可；如果创建提交，用 `git revert <commit>` 回滚。

## 依赖

无。

## 执行记录

2026-07-22：

- 确认当前 worktree：`/Users/weipanyue/shengji/.worktrees/codex-game-iteration-visibility`。
- 确认当前分支：`codex/game-iteration-visibility`。
- 确认当前环境是 linked worktree：`GIT_DIR=/Users/weipanyue/shengji/.git/worktrees/codex-game-iteration-visibility`，`GIT_COMMON=/Users/weipanyue/shengji/.git`。
- 基线提交前验证命令：`git diff --check`、`pnpm test`、`pnpm typecheck`。
- 基线提交策略：将当前 worktree 代码、上一轮 `docs/game-iteration/` 证据、新增 `docs/iteration/` 长期文档一起提交，后续功能从新 HEAD 继续。
