# ITER-002 Deterministic E2E Harness

## 功能名称

确定性 E2E 与多客户端浏览器验证基础设施。

## 优先级

P0。

## 当前状态

In Progress。

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

2026-07-22 启动第一小闭环：Playwright E2E 基础设施和两客户端亮主/反主 smoke。

### 第一小闭环范围

- 引入 `@playwright/test` 和根脚本 `pnpm test:e2e`。
- 新增 `playwright.config.ts`，自动拉起 deterministic server 和 Vite web。
- 新增 server 测试 hook：
  - `SHENGJI_TEST_SEED` 控制发牌随机流；
  - `SHENGJI_BOT_DELAY_MS` 控制 bot 行动节奏；
  - 默认未设置 env 时生产路径仍使用 `Math.random` 和原 bot delay。
- 新增 E2E：两个 browser context 进入同一房间，host 首亮 ♣2，guest 小王反主，两端都能看到亮主/反主、当前主和等待方。
- 成功截图：
  - `docs/iteration/artifacts/ITER-002/screenshots/two-context-counter-host.png`
  - `docs/iteration/artifacts/ITER-002/screenshots/two-context-counter-guest.png`

### 运行方式

```bash
pnpm test:e2e
```

该命令使用固定端口：

- server: `http://127.0.0.1:43101`
- web: `http://127.0.0.1:45175`

失败时 Playwright 产物落在 `docs/iteration/artifacts/ITER-002/test-results/`；HTML report 落在 `docs/iteration/artifacts/ITER-002/playwright-report/`。这两个目录由 `.gitignore` 忽略，成功截图按需提交。

### 第一小闭环验证记录

- 红测/失败 1：`pnpm test:e2e` 因 `3101` 端口已有未知 node 进程监听而失败。处理：不杀外部进程，改用 `43101/45175`。
- 红测/失败 2：host 视角显示“你 亮主”，非“E2E甲 亮主”。处理：E2E 同时断言本人视角和他人视角文案。
- 红测/失败 3：guest 的小王反主按钮视觉文案拆成“小单 / 王”，accessibility name 不等于 `王小单`。处理：使用 `button.bid-nt.lit` 点击可用无主反牌按钮，并保留文本断言验证结果。
- 红测/失败 4：`pnpm test` 把 Playwright `.spec.ts` 当 Vitest 文件收进来。处理：E2E 文件改名为 `.e2e.ts`，Playwright config 设置 `testMatch: '**/*.e2e.ts'`。
- 通过：`pnpm test:e2e`，1 个 chromium E2E 通过。
- 通过：`pnpm test`，29 个测试文件，221 个测试。
- 通过：`pnpm typecheck`。
- 通过：`pnpm build`。

### 剩余范围

ITER-002 仍未完全完成。后续小闭环继续补：

- 多客户端断线/重连 E2E；
- 收墩驻留和“上一墩”稳定截图断言；
- 移动端/更多紧凑视口响应式截图；
- fixture 化无人亮主、bot 反主、结算等更多确定性场景。

## 第二小闭环：紧凑横屏响应式断言

2026-07-22 完成。

### 范围

- 复用同一个 deterministic 亮主/反主房间，在 `844x390` 横屏视口打开第三个 browser context。
- 断言紧凑视口下：
  - document/body 无横向溢出；
  - `status-bar` / `action-bar` 无横向溢出；
  - 四个 `.player-badge` 之间没有互相重叠。
- 生成截图：
  - `docs/iteration/artifacts/ITER-002/screenshots/two-context-counter-compact.png`

### 发现与修复

- 红测：新增 `.player-badge` bounding-box 互斥断言后，E2E 失败，重叠对为 `E2E甲25 张思考中… / 机器人425 张`。
- 根因：`max-width: 900px` 横屏布局中 `.player-left` 仍保持 `top: 50%`，短高视口下会与左下角 `.player-bottom` 徽章挤到一起。
- 修复：紧凑横屏下将 `.player-left` 上移到 `top: 34%`。
- 验证：`pnpm test:e2e` 通过，截图确认左侧徽章上下分离。
