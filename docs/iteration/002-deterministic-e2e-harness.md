# ITER-002 Deterministic E2E Harness

## 功能名称

确定性 E2E 与多客户端浏览器验证基础设施。

## 优先级

P0。

## 当前状态

Backlog。

## 背景

当前浏览器验证依赖人工和临时脚本，证据写在 `docs/game-iteration/test-report.md`，但脚本没有进入仓库。多客户端同步、固定牌序、响应式截图和回归断言都不能稳定复跑。

## 需要解决的问题

- 缺少仓库内 E2E 测试框架。
- 无法固定发牌和 bot 行为，导致浏览器回归不确定。
- 多客户端场景只靠单浏览器观察。
- 截图和 DOM 断言没有自动产物规范。

## 用户可感知收益

后续试玩中出现的问题可以转成可重复 E2E；亮主、反主、收墩、重连等关键流程更不容易回归。

## 涉及模块 / 文件

- 可能新增：`apps/web/e2e/*`
- 可能新增：`apps/server/src/testHooks.ts` 或测试专用配置入口
- `apps/server/src/app.ts`
- `packages/game/src/deck.ts`
- `package.json`
- `docs/iteration/*`

## 实现思路

1. 选择 E2E 技术：优先 Playwright，因为已有浏览器验证矩阵要求多 context、截图、DOM 断言。
2. 增加测试专用 server seed 或 fixture 注入，避免生产路径暴露调试能力。
3. 建立一人三 bot 和四客户端最小流程。
4. 固定产物目录，例如 `docs/iteration/artifacts/ITER-002/` 或测试输出目录。
5. 将关键断言固化：room create/start、first bid、counter、burying、playing、settled trick、scoring、responsive no-overlap。

## 验收标准

- `pnpm test:e2e` 或等价命令可本地运行。
- 至少两个 browser contexts 能加入同一房间并观察相同 `RoomStateView` 派生 UI。
- 可固定一局出现首亮/反主/无人亮主中的至少两个场景。
- 失败时保留截图或 trace。
- 文档记录如何运行、如何更新截图、如何调试失败。

## 测试方式

- E2E 框架自测命令。
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- 手动核验一次 E2E 失败产物路径。

## 风险和回滚方式

- 风险：引入 Playwright 增加依赖和 CI 时间。
- 风险：测试 hook 若暴露到生产会影响安全。
- 回滚：移除 E2E 依赖、测试脚本和测试 hook；保留文档说明已撤回。

## 依赖

ITER-000。

## 执行记录

未开始。
