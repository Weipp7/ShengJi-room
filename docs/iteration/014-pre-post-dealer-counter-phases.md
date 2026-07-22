# ITER-014 Pre And Post Dealer Counter Phases

## 功能名称

庄前反牌与庄后反牌阶段

## 优先级

P0

## 当前状态

Done

## 背景

用户要求支持亮庄、庄前反牌和庄后反牌。现有流程基本是 bidding -> bury -> playing，反主窗口没有被明确拆成庄前和庄后两个玩家可理解阶段。

## 需要解决的问题

- 需要定义庄前反牌和庄后反牌的触发点、结束条件和合法操作方。
- 状态切换必须有等待反馈，不能让玩家以为卡住。
- 反牌成功后，庄家、主花色、主级牌、底牌归属和埋底责任是否变化必须明确。
- bot 和玩家都不能在错误窗口重复反牌或越权反牌。

## 用户可感知收益

- 玩家知道当前是在抢庄、庄前反、庄后反、埋底还是出牌。
- 反牌窗口结束原因清楚：无人反、反主成功、进入埋底、进入出牌。
- 真实玩法中的庄前/庄后互动可被支持。

## 涉及模块 / 文件

- `packages/shared/src/state.ts`
- `packages/game/src/round.ts`
- `packages/game/src/bidding.ts`
- `packages/game/test/round.test.ts`
- `apps/server/src/app.ts`
- `apps/server/src/botRunner.ts`
- `apps/web/src/pages/GameTable.tsx`
- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/components/ContractSummary.tsx`

## 实现思路

1. 在 shared state 中明确阶段枚举或阶段元数据，区分庄前反和庄后反。
2. 在 round 状态机中写失败测试：非法阶段反牌、庄前反成功、庄后反成功、无人反自动推进。
3. 服务端只接受当前阶段允许的 action，错误文案可理解。
4. UI 在 ActionBar 和 ContractSummary 中展示当前窗口、剩余等待方、当前合约。
5. botRunner 按阶段调度 pass/reveal，不制造瞬间跳变。

## 验收标准

- 庄前反牌和庄后反牌都有明确 phase/status。
- 每个阶段 UI 都有玩家可感知的说明和可操作按钮。
- 非当前操作方不能反牌；重复操作不会破坏状态。
- 阶段结束后进入正确下一阶段，不跳过埋底或出牌。
- 浏览器完整流程能看到两类反牌窗口。

## 测试方式

- `pnpm test packages/game/test/round.test.ts`
- `pnpm test apps/server/test/socket.test.ts apps/server/test/gameFlow.test.ts`
- 浏览器自动化：多人或 bot 房间中记录阶段变化、公告、按钮可见性。

## 风险和回滚方式

- 风险：阶段拆分会影响现有 bot 调度和 UI 操作按钮。
- 控制：先加状态机测试，再改服务端和 UI。
- 回滚：回滚 phase 扩展和 UI 文案，恢复单一 bidding 窗口。

## 依赖

- `ITER-013`

## 执行记录

2026-07-22：

- 进入实现阶段。
- 本轮最小规则决策：庄前反牌沿用现有 bidding 轮次；庄后反牌发生在庄家拿到底牌后、埋底前，只有庄家可以用手牌中的更强亮牌再次反/改主。
- 本项暂不加入所有玩家庄后轮流反牌；若后续需要，新增规则变体任务。
- RED：`pnpm test packages/game/test/round.test.ts` 失败 3 项，失败点为缺少 `biddingStage`、庄后 reveal 被 `wrong-phase` 拒绝、非庄后反牌错误码不明确。
- GREEN：新增 `biddingStage`，`applyReveal` 在 `burying/post-dealer` 允许庄家用更强牌反主；`pnpm test packages/game/test/round.test.ts` 通过 11 项。
- UI RED：`pnpm test apps/web/test/waiting.test.ts apps/web/test/contract.test.ts apps/web/test/actionBar.test.tsx` 失败 5 项，等待文案、契约摘要和埋底操作栏均未显示庄前/庄后窗口。
- UI GREEN：等待文案显示 `庄前反牌中` / `庄后反牌或埋底`，契约摘要显示 `庄后反牌窗口`，庄家埋底操作栏显示 `庄后可反` 选项；目标 UI 测试通过 15 项。
- 全量验证：`pnpm test` 通过 21 个测试文件、158 个测试；`pnpm typecheck` 通过；`pnpm build` 通过。
- 浏览器验证：机器人局中先看到 `庄前反牌中` 文案；随后同一庄家机器人4 在埋底前从 `♦2 一对` 庄后反成 `大王一对`，再进入出牌。
- 浏览器截图：`docs/iteration/014-browser-post-dealer-counter-result.png`。
