# Iteration Review Notes

## 2026-07-22：ITER-015 出牌提示按钮与可解释推荐评审

### 产品经理 / 真实玩家体验官

- 发现：提示入口必须出现在玩家可决策的位置，但不能自动替玩家出牌。
  - 采纳：只在本人出牌回合展示“提示”，点击后只本地选中推荐牌并显示理由，正式出牌仍需玩家点击“出牌”。
- 发现：提示理由必须短且可感知，避免把提示变成教程长文。
  - 采纳：每个 `PlayReason` 映射为一句话，显示在操作栏。

### 规则专家 / 对抗评审

- 发现：前端投影没有 `combo`，提示前必须按当前主牌重建首家牌型。
  - 采纳：`createPlayHint` 使用 `detectCombo` 重建普通当前墩；成功甩牌重建 `throw-pairs`，失败甩牌按实际落桌牌型处理。
- 发现：甩牌元数据变化时，即使牌面相同，旧提示也应失效。
  - 采纳：`playHintContextKey` 纳入 `throwEvent.id/success/n/penaltyPoints/actualCards/challengedCards`。

### 前端交互评审

- 发现：推荐牌需要和已选牌有独立视觉层级。
  - 采纳：`CardFace` 新增 `hinted` 状态；推荐牌被自动选中后同时具有 `selected` 和 `hinted`。
- 发现：移动端操作栏容易被推荐理由撑宽。
  - 采纳：推荐文案设置宽度约束；浏览器 390px 视口验证无横向溢出。

### QA 测试工程师

- 新增测试覆盖：
  - `apps/web/test/playHint.test.ts`
  - `apps/web/test/actionBar.test.tsx`
  - `apps/web/test/handFan.test.tsx`
- 浏览器验证覆盖：
  - 提示不自动出牌；
  - 点击提示后推荐牌高亮且出牌按钮可用；
  - 手动出牌后提示/选择清空；
  - 移动端操作栏不横向溢出。

### 代码审查

- Critical：无。
- Important：无。
- Minor：提示上下文 key 缺少甩牌事件元数据。
  - 已修复：context key 纳入甩牌事件关键字段，并补单测。
- Minor：成功甩牌 combo 重建没有镜像规则层 pair 校验和 components。
  - 已修复：重建时要求同有效花色、非普通 combo、全由对子组成，并构造 pair components。
- Minor：缺少成功甩牌提示覆盖。
  - 已修复：新增 `follow-throw-pairs` 提示测试。

### Release Reviewer

- 回滚建议：按 ITER-015 单提交回滚；手工回滚重点是 `apps/web/src/lib/playHint.ts`、`GameTable.tsx`、`ActionBar.tsx`、`HandFan.tsx`、`CardFace.tsx`、`styles.css` 和 web 依赖声明。
- 剩余风险：缺少仓库内可重复浏览器 E2E fixture；当前浏览器证据为手工自动化记录，稳定 E2E 仍由 `ITER-002` 跟踪。

## 2026-07-22：ITER-012 高级机器人领牌与跟牌策略评审

### 产品经理 / 真实玩家体验官

- 发现：第一小闭环应聚焦高频单张跟牌、断门杀分、队友送分和领牌保形，不应直接做长期记牌或主动甩牌。
  - 采纳：优先实现单张、对子、拖拉机的局部评估；领牌优先安全散单保形。
- 发现：bot 为 0 分小墩浪费 A 或大主会明显破坏真人感。
  - 采纳：只有敌方当前领先且本墩已有分时才争抢；争抢时使用最小可赢组合。

### 规则专家 / 对抗评审

- 发现：有效花色和牌面花色不同，级牌、王、无主局级牌都必须走主牌规则。
  - 采纳：所有选择都通过 `effectiveSuit`、`findPairs`、`findTractors` 和 `validateFollow` 兜底。
- 发现：`throw-pairs` 当前由领出者固定赢，跟牌不能制造“反甩赢牌”错觉。
  - 采纳：`throw-pairs` 只做稳定跟牌排序，不尝试用主对反赢。
- 发现：断门杀牌不能用散牌伪装赢墩。
  - 采纳：断门杀分只选择完整主单张、主对子或主拖拉机。

### QA 测试工程师

- 采纳 P0：
  - 单张有分用最小可赢牌；
  - 对子有分用最小可赢对；
  - 对子无分省控制对；
  - 拖拉机有分用最小可赢拖拉机；
  - 队友领先拖拉机时送分并保留高拖拉机。
- 采纳 P1：
  - 断门对子有分用最小主对杀；
  - 断门拖拉机有分用最小主拖拉机杀；
  - 敌方/队友 `throw-pairs` 跟牌不再受手牌顺序影响。
- 未完全采纳：主动甩牌策略、复杂剩余牌推断和出牌提示 UI，分别留给后续 bot/提示专项。

### Release Reviewer

- 回滚建议：按 ITER-012 单提交回滚；手工回滚重点是 `packages/bot/src/play.ts`、`packages/bot/src/index.ts` 和 `packages/bot/test/bot.test.ts`。
- 剩余风险：策略仍是局部启发式；没有浏览器固定牌序 E2E，已由 `ITER-002` 跟踪。

### 代码审查

- Critical：无。
- Important：随机 bot-vs-bot smoke 一度传入固定 `trickPointsSoFar: 0`，与生产 `botRunner` 按当前墩真实分牌传参不一致。
  - 已修复：测试改用 `countPoints(currentTrick.cards)`，并断言 `explainPlay` 不回落到 `fallback`。
- Minor：`PlayReason` 存在未使用的 `follow-pair`，且队友领先/省控制场景的解释不够准确。
  - 已修复：删除未使用 reason，改用 `support-teammate` 和 `preserve-control`。
- Minor：测试报告里 `pnpm test -- packages/bot/test/bot.test.ts` 与单文件无缓存命令的执行范围容易混淆。
  - 已修复：报告明确区分当前 Vitest 配置下的全量执行结果和 `--no-cache` 单文件结果。

## 2026-07-22：ITER-011 机器人埋牌策略代码评审

### 对抗评审 / 规则专家

- Important：第一版断门奖励按候选整组扣减，代码语义上可能让安全断门奖励外溢到补足牌。
  - 采纳：候选显式携带目标断门；只有目标断门享受奖励；补足牌必须满足非主、无分、非对子成员。
  - 补充验证：新增弱庄场景，旧实现会强行断门；修复后弱庄不强断。
- 二次复审 Important：弱庄场景没有真正覆盖均衡/强庄下的补牌门槛。
  - 采纳：新增 `explainBury` 策略解释接口；新增候选层测试，断言 balanced 庄需要不安全补牌时不会生成目标断门奖励候选。
- Important：文档目标包含“庄家强弱策略”，但实现没有建模。
  - 采纳：`decideBury` 内部以主牌张数和关键主控估算 `weak/balanced/strong`；不改变 server 调用或状态机。
  - 补充验证：新增强庄安全补牌场景，确认强庄仍倾向制造安全短门。
- Minor：`dealerProfile` 启发式仍偏粗。
  - 暂不扩展：当前安全补牌门槛限制了误判影响；8/9 张无控制主、短主强控等精细策略进入 `ITER-012`。

### QA 测试工程师

- 新增固定手牌测试覆盖：
  - 安全短副门优先断门；
  - 弱庄且安全补牌不足时不强断；
  - 强庄且补牌低风险时仍安全断门；
  - 均衡庄候选层不为不安全补牌生成断门奖励候选；
  - 关键主控不埋底；
  - 200 组随机手牌始终输出 8 张、不重复、全部来自手牌。
- 当前仍缺浏览器层“埋牌可解释性”展示，因为本轮只改 bot 策略，庄家埋牌内容对其他玩家不可见；是否增加开发态解释面板另列后续需求，不纳入本轮。

### Release Reviewer

- 回滚建议：按 ITER-011 单提交回滚；如需手工回滚，只需恢复 `packages/bot/src/bury.ts` 和 `packages/bot/test/bot.test.ts`，文档可单独保留作为决策记录。
- 剩余风险：强弱估算是启发式，不做长期记牌和概率模型；与领牌/跟牌的联动和更细的强弱分类进入 `ITER-012`。

## 2026-07-22：ITER-016 甩牌功能多角色评审

### 规则专家 / 对抗评审

- 发现：现有 `Combo` 只能表达单张、对子、拖拉机，甩牌不能伪装成 `combo: null` 或普通拖拉机。
- 采纳：新增 `throw-pairs`，成功甩牌首家锁定赢家；失败甩牌回落到实际对子再走普通墩判定。
- 发现：失败甩牌如果移除所有尝试牌，会破坏牌守恒、跟牌张数和末墩扣底指数。
- 采纳：失败只移除实际领出的最低可压对子，其余尝试牌保留在手中。
- 发现：直接改 `defenderTrickPoints` 会丢失审计信息。
- 采纳：新增 `throwPenaltyPoints` 队伍账本，结算时折算到闲家有效分。

### QA 测试工程师

- 发现：需要覆盖纯规则函数、状态机、结算、服务端投影和 UI 可见性。
- 采纳：新增/更新测试：
  - `packages/game/test/throw.test.ts`
  - `packages/game/test/follow.test.ts`
  - `packages/game/test/round.test.ts`
  - `packages/game/test/scoring.test.ts`
  - `apps/server/test/socket.test.ts`
  - `apps/web/test/announcements.test.ts`
  - `apps/web/test/trickArea.test.tsx`
  - `apps/web/test/actionBar.test.tsx`
  - `apps/web/test/resultModal.test.tsx`
- 未完全采纳：自动化浏览器 fixture 暂未接入；该工作已由 `ITER-002` 追踪。

### 产品经理 / 前端交互评审

- 发现：玩家需要同时看到谁甩牌、成功/失败、实际领出、惩罚公式和结算影响。
- 采纳：公告、墩区常驻标签、结算弹窗三处展示甩牌结果。
- 发现：失败原因不能暴露对手具体手牌。
- 采纳：失败公告只显示“有人可压住其中的 X”，不显示哪家持有哪张。
- 发现：短 toast 不能承担公共结算反馈。
- 采纳：失败甩牌是 `throwEvents` 持久状态，不只通过错误 toast 展示。

### Release Reviewer

- 验收证据：目标测试通过、`pnpm typecheck` 通过、浏览器真实开桌和 DOM 断言记录已写入 `016-throw-play-and-penalty.md`。
- 回滚建议：按 `ITER-016` 单提交回滚；如需手工回滚，优先恢复 `RoundState`/`RoomStateView` 类型，再移除 UI 展示和测试。
- 剩余风险：复杂甩牌变体、bot 主动甩牌、稳定 E2E fixture 未在本轮完成，均已记录为后续任务。

### 代码评审

- Critical：无。
- Important：结算弹窗在两队甩牌罚分抵消时隐藏账本。
  - 已修复：显示 `蓝队 X / 红队 Y，净 Z`，并补 `resultModal.test.tsx` 回归。
- Important：上一墩回看缺少甩牌标签。
  - 已修复：折叠摘要和展开明细都展示上一墩甩牌成功/失败，并补 `trickArea.test.tsx` 回归。
- Minor：bot 通过拖拉机兜底跟 `throw-pairs`。
  - 已修复：新增显式 `throw-pairs` 跟牌分支，并补 `bot.test.ts` 回归。
