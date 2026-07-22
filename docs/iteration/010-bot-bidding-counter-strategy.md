# ITER-010 Bot Bidding And Counter Strategy

## 功能名称

机器人亮庄与反主策略升级

## 优先级

P1

## 当前状态

Done

## 背景

当前 bot 亮庄策略主要围绕可识别的基础牌型做保守选择。新增规则会允许任意张数亮庄、大小王反主、庄前反牌和庄后反牌，bot 必须理解更丰富的强度模型，否则会出现该反不反、该抢不抢、抢完解释不清的问题。

## 需要解决的问题

- bot 不能只看是否有对子，需要按亮牌张数、花色、主级牌数量、大小王组合和队伍位置评估。
- bot 需要区分亮庄、庄前反牌、庄后反牌三个语境。
- bot 需要避免过度反主，尤其是在弱牌、队友已占优、主牌长度不足时。
- bot 行为需要可测试，不依赖随机“看起来合理”。

## 用户可感知收益

- 机器人更像真实玩家，会主动抢主、保护强主、放弃低质量反牌。
- 亮庄/反主阶段节奏更自然，玩家能看到 AI 为什么做出关键操作。
- 后续出牌提示可复用同一评估逻辑，减少“bot 会但玩家提示不会”的割裂。

## 涉及模块 / 文件

- `packages/bot/src/bid.ts`
- `packages/bot/test/bot.test.ts`
- `packages/game/src/bidding.ts`
- `packages/game/src/round.ts`
- `packages/game/test/bidding.test.ts`
- `packages/game/test/round.test.ts`
- `packages/shared/src/state.ts`
- `apps/web/src/lib/announcements.ts`

## 实现思路

1. 在规则层先完成 `ITER-013` 的强度模型，bot 不重复实现强度比较。
2. 新增 bot 牌力评估函数，输入手牌、当前级牌、当前合约、阶段、座位队伍，输出候选亮牌及分数。
3. 将策略拆成“候选生成”和“候选选择”，测试覆盖每类候选。
4. 控制反主阈值，只有收益明显高于风险时反主。
5. UI 公告沿用 `bidHistory`，不在 bot 层拼接文案。

## 验收标准

- bot 能在强主长套时主动亮庄。
- bot 能用更高强度牌反主，包括大王压小王等规则场景。
- bot 不会用低质量短主反掉队友的强合约。
- 庄前/庄后反牌行为由阶段决定，不能在非法阶段操作。
- 每个关键策略分支都有单元测试或状态机测试。

## 测试方式

- `pnpm test packages/bot/test/bot.test.ts`
- `pnpm test packages/game/test/bidding.test.ts packages/game/test/round.test.ts`
- 固定手牌场景：强主主动亮、弱主不亮、大王反小王、队友强约不反、庄后只在允许窗口反。
- 浏览器验证：亮庄/反主公告显示操作方、操作类型、牌、主花色/主级牌变化。

## 风险和回滚方式

- 风险：bot 过度激进会破坏人类玩家体验。
- 控制：阈值和候选评分必须在测试中显式体现。
- 回滚：回滚 `packages/bot/src/bid.ts` 和对应测试，不影响规则层强度模型。

## 依赖

- `ITER-013`
- `ITER-014`

## 执行记录

2026-07-22：

- 进入实现阶段。
- 本轮聚焦 bot 亮庄/反主策略，不修改埋牌和出牌策略。
- 策略原则：复用规则层候选和强度比较；优先选择最强且有牌力支撑的候选；同队已有同张数强约时不乱反；庄后反牌复用同一策略。
- RED：`pnpm test packages/bot/test/bot.test.ts` 失败 3 项，失败点为开局先返回弱花色单张、不能用单张大王反小王、会用同张数小王对反队友级牌对。
- GREEN：`decideBid` 改为复用 `availableBids`，按张数、王/花色类别和花色长度评分选最强候选；同队已有同张数合约时不反；`pnpm test packages/bot/test/bot.test.ts` 通过 8 项。
- 接线：`botRunner` 在 bidding 和 post-dealer burying 阶段都向 bot 传入 `biddingStage`，庄后反牌复用同一策略。
- 目标验证：`pnpm test packages/bot/test/bot.test.ts apps/server/test/botRunner.test.ts apps/server/test/gameFlow.test.ts` 通过 3 个测试文件、14 个测试；`pnpm typecheck` 通过。
- 全量验证：`pnpm test` 通过 21 个测试文件、161 个测试；`pnpm build` 通过。
