# ITER-015 Play Hint Button

## 功能名称

出牌提示按钮与可解释推荐

## 优先级

P1

## 当前状态

Done

## 背景

用户要求新增出牌提示按钮。该功能不能只是随机选一张合法牌；它需要结合当前轮次、跟牌规则、主牌、队友状态和分牌收益，给出玩家能理解的推荐。

## 需要解决的问题

- 前端需要一个不会自动替玩家出牌的提示入口。
- 推荐结果必须合法，并能在手牌中高亮。
- 推荐理由需要简洁解释，例如“必须跟方块”、“敌方当前领先且桌上有分，建议杀牌”。
- 推荐逻辑应复用 bot 评估器，避免两套策略不一致。

## 用户可感知收益

- 新玩家能更容易理解当前该怎么出。
- 玩家能学习规则，而不是只看到不可解释的按钮。
- 复杂阶段如甩牌、断门杀牌、保分时体验更友好。

## 涉及模块 / 文件

- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/components/HandFan.tsx`
- `apps/web/src/components/CardFace.tsx`
- `apps/web/src/pages/GameTable.tsx`
- `apps/web/src/lib/playHint.ts`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- `packages/bot/src/play.ts`

## 实现思路

1. 复用 bot/play 层已暴露的 `explainPlay`，返回推荐牌组和 reason code。
2. 前端在本地 state 中保存当前推荐，不直接发送 play action。
3. 点击“提示”后高亮推荐牌，并显示一句简短理由。
4. 玩家可接受推荐后点击出牌，也可手动选择其他合法牌。
5. 提示在手牌、当前墩或阶段变化后自动清除。

## 验收标准

- 只有轮到玩家出牌时显示或启用提示按钮。
- 提示牌组始终是合法出牌。
- 提示不会自动出牌。
- 推荐高亮和理由在 UI 中清晰可见。
- 状态变化后旧提示不会残留。

## 测试方式

- `pnpm test packages/bot/test/bot.test.ts`
- `pnpm test apps/web/test/*hint*.test.tsx` 或新增对应组件测试。
- 浏览器验证：轮到玩家时点击提示，观察高亮、理由、手动出牌流程。

## 风险和回滚方式

- 风险：提示逻辑和 bot 策略耦合后，bot 调整可能改变 UI 推荐。
- 控制：使用 reason code 和策略原则测试，不锁死全部牌序。
- 回滚：隐藏提示按钮并保留 bot 策略；UI 改动可单独回滚。

## 依赖

- `ITER-012`

## 执行记录

2026-07-22 启动第一小闭环。范围限定为：

- 复用 `@shengji/bot` 的 `explainPlay` 计算当前玩家推荐，不重新实现规则。
- 只在 `playing` 阶段、轮到当前玩家且没有上一墩驻留遮挡时启用提示按钮。
- 点击提示后自动选中推荐牌，并在操作栏展示一句理由。
- 提示不会自动发送 `TrickPlay`，玩家仍需手动点击“出牌”。
- 手牌、当前墩、阶段、轮次或玩家选择变化导致推荐不再适用时清理旧提示。
- 本轮不做长期教学面板、不做概率解释、不做主动甩牌推荐。

## 第一小闭环计划

1. 新增 web 组件测试，红测覆盖提示按钮入口、推荐理由、推荐选牌和非出牌回合禁用。
2. 新增 `apps/web/src/lib/playHint.ts`，把 `RoomStateView` 映射为 `explainPlay` 输入，并把 reason code 映射成人类可读文案。
3. 修改 `GameTable` 管理提示状态：点击提示选中推荐牌；用户手动改选、阶段变化、手牌变化、当前墩变化时清理。
4. 修改 `ActionBar` 展示提示按钮和推荐理由。
5. 修改 `HandFan` / `CardFace` 给推荐牌提供可见高亮，不覆盖已选牌状态。
6. 运行目标测试、全量测试、类型检查和构建；必要时补浏览器验证记录。

## 实现结果

- `apps/web/src/lib/playHint.ts`
  - 新增 `createPlayHint(view)`，把 `RoomStateView` 映射为 `explainPlay` 输入。
  - 使用 `detectCombo` 重建普通当前墩；成功 `throw-pairs` 会校验同有效花色、非普通 combo、全由对子组成，并重建 `components`。
  - 新增 `playHintContextKey(view)`，把阶段、座位、主牌、手牌、当前墩和甩牌事件关键字段纳入提示失效判断。
  - 将 `PlayReason` 映射为玩家可读的一句话理由。
- `apps/web/src/pages/GameTable.tsx`
  - 管理本地提示状态；点击“提示”只选中推荐牌并展示理由，不发送出牌事件。
  - 玩家手动改选、清空、出牌、阶段变化、当前墩变化、手牌变化或上一墩驻留时清理旧提示。
- `apps/web/src/components/ActionBar.tsx`
  - 玩家出牌回合显示“提示”按钮；有推荐后显示“推荐：...”理由。
- `apps/web/src/components/HandFan.tsx` / `CardFace.tsx` / `styles.css`
  - 推荐牌增加 `hinted` 视觉状态；已选牌仍使用原 `selected` 状态。
- `apps/web/package.json` / `pnpm-lock.yaml`
  - web 显式依赖 `@shengji/bot`，确保构建期可解析 `explainPlay`。

## 测试记录

### 红测

- `pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
  - 失败：`playHint` 模块不存在。
  - 失败：ActionBar 出牌回合没有“提示”按钮和推荐理由。
  - 失败：HandFan 不会给推荐牌输出 `hinted` 状态。

### 修复后验证

- `pnpm test apps/web/test/playHint.test.ts apps/web/test/actionBar.test.tsx apps/web/test/handFan.test.tsx`
  - 通过：3 个测试文件，8 个测试。
  - 覆盖：普通跟牌提示、非本地回合不提示、成功甩牌跟牌提示、甩牌事件进入 context key、ActionBar 提示文案、HandFan 推荐高亮。
- `pnpm test`
  - 通过：25 个测试文件，204 个测试。
- `pnpm typecheck`
  - 通过：`pnpm -r exec tsc --noEmit` 无错误。
- `pnpm build`
  - 通过：shared/game/bot/server/web 均构建成功。

## 浏览器验证

- 命令：`pnpm dev`
- URL：`http://localhost:5173/`
- 路径：输入昵称 `试玩员` -> `开一桌` -> `开始游戏` -> 亮大王无主 -> 选 8 张并确认埋底 -> 进入本人出牌回合。
- 验证 1：出牌回合可见“提示”按钮，点击后操作栏显示 `推荐：先出安全散牌，保留对子或拖拉机。`，DOM 显示 `selectedCount=1`、`hintedCount=1`，当前墩仍为空，确认提示没有自动出牌。
- 验证 2：点击“出牌”后页面切换为等待机器人出牌，DOM 显示 `selectedCount=0`、`hintedCount=0`，当前墩显示 `你 领出 3♦`。
- 验证 3：下一次本人出牌回合再次点击“提示”，操作栏显示 `推荐：这墩分牌收益不高，建议保留控制牌。`，推荐牌为 `6♦`，`selectedCount=1`、`hintedCount=1`。
- 移动端验证：临时视口 `390x844`，操作栏 `clientWidth=390`、`scrollWidth=390`，推荐文案无横向溢出。
- 截图：
  - `docs/iteration/015-browser-play-hint.png`
  - `docs/iteration/015-browser-play-hint-mobile.png`

## 多角色评审记录

- 产品 / 真实玩家体验：提示按钮只在玩家需要决策的位置出现；推荐理由使用短句，不把提示包装成强制答案。
- 规则专家：提示复用 bot 策略，`currentTrick` 在前端按规则重建 combo；成功甩牌用 `throw-pairs` 语义，失败甩牌回落到实际领出的普通牌型。
- 前端交互评审：提示不会自动出牌；推荐牌同时被选中和高亮，玩家仍能手动改选或清空。
- QA / 对抗评审：补充成功甩牌提示和 context key 测试；GameTable 点击和移动端布局用浏览器证据记录，稳定 E2E fixture 仍归 `ITER-002`。
- 代码审查：无 Critical/Important；已处理甩牌元数据进入 context key、成功甩牌 combo 重建校验和 throw-pairs 单测。

## 未处理事项

- 不引入 React Testing Library 或 jsdom；当前仓库组件测试主要使用 SSR，动态点击流程由浏览器自动化证据覆盖。
- 不做主动甩牌推荐，避免提示使用全知信息诱导玩家冒险。
- 不做长期记牌、概率解释或教程面板。
