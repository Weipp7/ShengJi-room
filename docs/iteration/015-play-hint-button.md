# ITER-015 Play Hint Button

## 功能名称

出牌提示按钮与可解释推荐

## 优先级

P1

## 当前状态

Backlog

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
- `apps/web/src/store.tsx`
- `packages/bot/src/play.ts`
- `packages/shared/src/events.ts`

## 实现思路

1. 在 bot/play 层暴露纯函数 `suggestPlay`，返回推荐牌组和 reason code。
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

尚未开始。
