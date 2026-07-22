# ITER-013 Flexible Reveal And Counter Rules

## 功能名称

任意张数亮庄、大小王反主与亮牌强度模型

## 优先级

P0

## 当前状态

Ready

## 背景

当前亮庄/反主模型主要覆盖单张和对子。用户明确要求亮庄支持任意张数亮牌，并支持大王反小王等更丰富强度关系。这是后续庄前反牌、庄后反牌、bot 亮庄策略和 UI 公告的基础。

## 需要解决的问题

- `BidDeclaration.cards` 虽能携带多张牌，但强度模型和合法性需要支持任意张数。
- 小王/大王反主关系需要明确：大王组合应能压过同张数或指定强度的小王组合。
- 多张亮牌必须验证牌面一致性或规则允许的组合，不能随便混牌。
- 当前主花色、主级牌、计划庄家是否变化，需要由状态机明确给出并被 UI 展示。

## 用户可感知收益

- 玩家可以按真实规则使用多张级牌亮庄。
- 大王反小王等常见反主体验可用。
- UI 能清楚显示“谁用几张什么牌亮/反，主变成什么”。

## 涉及模块 / 文件

- `packages/game/src/bidding.ts`
- `packages/game/src/round.ts`
- `packages/game/test/bidding.test.ts`
- `packages/game/test/round.test.ts`
- `packages/shared/src/state.ts`
- `packages/shared/src/cards.ts`
- `apps/web/src/lib/announcements.ts`
- `apps/web/test/announcements.test.ts`

## 实现思路

1. 先在 `bidding.test.ts` 写任意张数、大小王反主、非法混牌的失败测试。
2. 扩展 `BidStrength`，把张数、王级别、花色、是否对子/多张作为可比较属性。
3. 让 `detectBid` 返回更通用的声明类型，但保持现有单张/对子兼容。
4. 在 `applyReveal` 中记录主花色和计划庄家变化，继续写入 `bidHistory`。
5. 更新公告格式，明确张数和牌面。

## 验收标准

- 单张、对子既有亮庄/反主测试继续通过。
- 三张及以上同级牌可以按规则亮庄。
- 大王组合可以反小王组合；小王不能反更强大王组合。
- 非法混牌、数量不一致、弱反主会被拒绝并返回可理解错误。
- UI 公告能展示操作方、亮/反类型、牌、主花色/主级牌变化。

## 测试方式

- `pnpm test packages/game/test/bidding.test.ts`
- `pnpm test packages/game/test/round.test.ts`
- `pnpm test apps/web/test/announcements.test.ts`
- 浏览器验证：构造或自动推进到亮庄/反主阶段，确认多张亮牌和大小王反主公告可见。

## 风险和回滚方式

- 风险：强度模型改动影响所有亮庄/反主场景。
- 控制：先补回归测试锁定现有单张/对子行为，再加新能力。
- 回滚：回滚 `bidding.ts`、`round.ts`、`state.ts` 和公告测试；旧单张/对子规则恢复。

## 依赖

- `ITER-000`

## 执行记录

尚未开始。
