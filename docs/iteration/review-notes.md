# Iteration Review Notes

## 2026-07-22：ITER-017 缺陷池与 BUG-017-001 评审

### QA / 回归评审

- P0：甩牌失败判定把队友也当成“可压住的人”。
  - 已修复为 `BUG-017-002`：只检查对手座位，同队队友不触发失败；补规则层和 round 层回归测试。
- P1：快速重复操作缺少 pending 锁，成功操作后的第二次请求会显示误导性 `wrong-turn/wrong-phase`。
  - 已记录为 `BUG-017-003`，对应 `ITER-001`。
- P2：跟牌阶段选择 4 张也显示“出牌 / 甩牌”；收墩驻留期间仍可选择手牌。
  - 已记录为 `BUG-017-006` 和 `BUG-017-007`。

### 对抗工程评审

- Critical：重连/刷新后，如果 `lastTrick` 已存在且 `currentTrick` 已经开始，旧逻辑会在初始挂载时回放上一墩并禁用出牌。
  - 已修复：`nextSettledReview` 只有在当前墩为空时才启动驻留；当前墩变化进入 `settledReviewStateKey`，会立即清理旧驻留。
- Important：赢家显示仍有 `view.lastTrickWinnerSeat ?? view.turnSeat` 的不可信 fallback。
  - 已修复：只使用 `lastTrickWinnerSeat`；字段缺失时显示“本墩结束”。
- Important：失败甩牌后残留选择、服务端不阻止真人抢跑。
  - 已记录为 `BUG-017-004` 和 `BUG-017-005`，需要单独产品/协议决策。

### Release Reviewer

- 回滚建议：`BUG-017-001` 可按单提交回滚；手工回滚重点是 `apps/web/src/lib/settledReview.ts`、`GameTable.tsx` 和 `apps/web/test/settledReview.test.ts`。
- 回滚建议：`BUG-017-002` 可按单提交回滚；手工回滚重点是 `packages/game/src/throw.ts`、`packages/game/test/throw.test.ts` 和 `packages/game/test/round.test.ts`。
- 剩余风险：缺少 `roundId/trickIndex/stateVersion`，无法完美区分“刚结墩”和“重连快照”；当前先用 `currentTrick.length` 阻断最伤体验的错误回放。

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

## 2026-07-22：ITER-001 第一小闭环多角色评审

### 产品经理 / 真实玩家体验官

- 发现：重复点击后的 `wrong-turn` 对玩家语义不正确；真实感知是“刚才点过了，系统是否还在处理”。
- 采纳：服务端动作提交后按钮显示“处理中…”，并禁用继续选择或再次提交。
- 发现：亮牌/反主/出牌流程中等待反馈应落在操作栏附近，不能只靠顶部状态。
- 采纳：本轮先在 ActionBar 原操作位置展示 pending 文案，减少视线跳转。

### 前端交互评审 / 对抗评审

- 发现：只给按钮加 `disabled` 存在 React 重绘前的双击窗口。
- 采纳：`GameTable` 增加同步 `pendingActionRef`，第一次 handler 内立即锁定，第二次 handler 即使同帧触发也不再 emit。
- 发现：结算弹窗“下一局”绕过了 ActionBar。
- 采纳：弹窗按钮改用同一个 `nextRound` pending 入口。

### QA 测试工程师

- 新增 SSR 组件测试覆盖 pending 出牌和 pending 过牌。
- 目标回归覆盖出牌提示、推荐高亮、ActionBar 既有状态。
- 浏览器真实验证覆盖亮主阶段快速过牌、出牌阶段双击出牌，toast 均为空。

### Release Reviewer

- 回滚建议：按本轮单提交回滚；手工回滚重点是 `apps/web/src/pages/GameTable.tsx`、`apps/web/src/components/ActionBar.tsx` 和 `apps/web/test/actionBar.test.tsx`。
- 剩余风险：错误提示持久化、重复错误弱提示和 socket 级重复动作断言还未完成，继续保留在 ITER-001 后续小闭环。

## 2026-07-22：ITER-001 第二小闭环多角色评审

### 产品经理 / 真实玩家体验官

- 发现：3 秒自动消失的错误不利于玩家理解，也无法在 review 时复盘。
- 采纳：错误保留到用户关闭或下一次成功状态刷新；错误中显示主标题和上下文解释。
- 发现：`wrong-turn` / `wrong-phase` 可能既是真非法，也可能是重复点击或状态刚切换。
- 采纳：文案补充“动作可能已经提交或当前轮次/阶段已变化，请以桌面当前提示为准”，避免玩家以为自己一定操作错。

### 前端交互评审

- 发现：错误 code 是调试和回归的重要证据，但不应以生硬日志形式露出。
- 采纳：DOM 保留 `data-error-code`，可用于测试和调试；屏幕文案保持玩家语言。
- 发现：关闭控件需要小而稳定，不能挤压错误文案。
- 采纳：toast 改为 flex 布局，文案列和 28px 关闭按钮固定分工。

### QA 测试工程师

- 新增 `errors.test.ts` 覆盖错误格式化和 unknown fallback。
- 新增 `errorToast.test.tsx` 覆盖 alert、关闭按钮和 `data-error-code`。
- 浏览器真实验证覆盖非法出牌后错误持久化超过 3 秒和手动关闭。

### Release Reviewer

- 回滚建议：按本轮单提交回滚；手工回滚重点是 `apps/web/src/store.tsx`、`apps/web/src/App.tsx`、`apps/web/src/lib/errors.ts`、`apps/web/src/components/ErrorToast.tsx` 和 toast CSS。
- 剩余风险：socket 级重复动作断言仍未完成；错误是否需要分级为“强错误/弱提示”进入 ITER-001 后续小闭环。

## 2026-07-22：ITER-001 第三小闭环多角色评审

### 规则专家 / 工程实现者

- 发现：服务端状态机本身已经保证失败动作不落盘，重复包会在新状态下被 `wrong-turn` 或 `wrong-phase` 拒绝。
- 采纳：不改协议，只补 socket 级断言证明 pass/play/next-round 重复请求不会多推进。
- 发现：重复 play 的第二包可能是 `wrong-turn` 而不是 `cards-not-in-hand`，取决于第一次成功后 turn 是否切走。
- 采纳：验收关注“不多出牌、不多删手牌、不多推进”，不绑定具体次要错误码之外的状态安全。

### QA 测试工程师

- 新增 4 真人 socket 夹具，避免 bot 自动动作干扰重复动作断言。
- 覆盖重复 `BidPass`、重复 `TrickPlay`、重复 `RoundNext`。
- 夹具调试发现 host 可能错过入座广播，已改为 seat take 前订阅对应更新。

### 对抗评审者

- 发现：没有客户端 action id / stateVersion 时，服务端无法区分“重复包”和“用户在错误阶段真的操作”。
- 决策：不做服务端静默吞错；由前端 pending 锁消除主路径重复点击，服务端继续暴露真实错误，并由错误文案说明状态可能已变化。

### Release Reviewer

- ITER-001 验收标准已满足：双击主路径被前端阻断，错误可复查，socket 重复包不污染状态。
- 回滚建议：本轮仅改测试和文档；如需回滚，恢复 `apps/server/test/gameFlow.test.ts` 中新增夹具与三个重复动作测试。

## 2026-07-22：ITER-002 第一小闭环多角色评审

### QA 测试工程师

- 发现：临时浏览器脚本无法复跑，也没有失败 trace。
- 采纳：新增 `pnpm test:e2e`、Playwright config、trace/screenshot/video retain-on-failure。
- 发现：Vitest 会收集 `.spec.ts`。
- 采纳：E2E 文件统一 `.e2e.ts`，Playwright 显式 `testMatch`。

### 工程实现者 / Release Reviewer

- 发现：固定牌序应通过 app options 注入，不能在生产路径暴露调试 HTTP 接口。
- 采纳：`createApp` 支持 `rng`，server 入口仅在 `SHENGJI_TEST_SEED` env 存在时使用 seeded rng。
- 发现：bot delay 需要可控，否则 E2E 容易靠 sleep。
- 采纳：`SHENGJI_BOT_DELAY_MS` 仅作为入口 env hook，默认不影响现有调度。

### 产品经理 / 真实玩家体验官

- 发现：本人视角和其他玩家视角的亮主文案不同，但都合理。
- 采纳：E2E 同时断言 host 的“你 亮主”和 guest 的“E2E甲 亮主”，并断言反主后双方都看到“小王单张”和当前主变化。

### 对抗评审者

- 发现：直接点可访问名称 `王小单` 不稳定，因为按钮视觉拆成徽标和牌面。
- 采纳：点击 `button.bid-nt.lit` 表示“当前唯一可用无主反牌按钮”，结果仍通过玩家可见文案验证，避免只测 CSS。
- 剩余风险：当前只覆盖亮主/反主 smoke，尚未覆盖收墩驻留、响应式、断线重连和结算。

## 2026-07-22：ITER-002 第二小闭环响应式评审

### 前端交互评审

- 发现：`844x390` 横屏截图中左侧玩家徽章重叠，虽然页面没有横向溢出。
- 采纳：E2E 增加 `.player-badge` bounding-box 互斥断言，不只检查 scrollWidth。
- 修复：紧凑横屏下 `.player-left` 上移到 `top: 34%`，与 `.player-bottom` 分离。

### QA 测试工程师

- 新增断言覆盖 document/body/status/action 无横向溢出。
- 新增断言覆盖四个玩家徽章互不重叠。
- 新增 `two-context-counter-compact.png` 截图作为响应式证据。

### Release Reviewer

- 回滚建议：如本轮引发布局回归，可先回滚 CSS 中 `.player-left top: 34%` 和 E2E 的 compact 断言；Playwright 基础设施可保留。
- 剩余风险：聊天抽屉打开态、长昵称、当前墩多牌、收墩驻留仍未纳入响应式 E2E。

## 2026-07-22：ITER-002 第三小闭环重连评审

### QA 测试工程师

- 发现：已有 server reconnect 测试证明手牌恢复，但浏览器层没有验证刷新后公共牌局信息是否还可见。
- 采纳：E2E 在 guest 完成小王反主后执行 `page.reload()`，断言同房间码、反主、小王单张和昵称恢复。

### 产品经理 / 真实玩家体验官

- 发现：玩家刷新后最关心的是“我还在这桌吗、刚才反主结果还在吗”。
- 采纳：本轮先覆盖刷新后公共契约和身份恢复；离线标记、多标签竞争和房间销毁留给后续重连专项。

### Release Reviewer

- 回滚建议：本轮仅改 E2E 和文档；如需回滚，移除 `guest.reload()` 相关断言。
- 剩余风险：未覆盖实际网络断线、server 重启和多标签同 playerId 竞争。

## 2026-07-22：ITER-018 外站基准初始评审

### 产品经理

- 发现：`shengji.org` 的单人入口是“快速开始 4人/6人”，点击后直接发牌，用户不用理解房间、座位、加机器人和开始游戏之间的关系。
- 采纳：本项目第一小闭环只处理 `开一桌` 一键自动开局，普通创建/邀请好友流程保持手动开始。
- 验收重点：不能再停在房间页等待用户发现 `开始游戏`。

### 真实玩家体验官

- 发现：外站牌桌左上常驻主花色、级牌、最新亮牌、闲家分和队伍级牌；出牌时中下部只保留提示、出牌、等待、上轮出牌这些关键动作。
- 采纳：快速开始完成后，后续结算和信息层级对齐应避免新增解释性长文，优先把关键状态放在扫视位置。

### 规则专家

- 观察事实：4 人样本中闲家 55 分，结算显示“庄家小胜 +1级”，庄家队 B 队从 2 升到 3；底牌展示并标注“庄家守住底牌 (无扣底)”。
- 推断：外站分段与本项目 `ROUND_SCORE_TABLE` 大体一致，但外站服务端规则不可见；只能通过更多样本和测试验证。
- 建议：结算文案可先对齐已有分段，不改变分数计算。

### 前端交互评审

- 发现：外站提示按钮会直接选牌并把主按钮变成 `出牌(n)`；等待状态明确显示 `等待...`，上一墩回看用 `上轮出牌` 按钮承载。
- 采纳：本项目已有提示按钮和 pending 锁；本轮不重做操作栏，只验证快速开始不阻塞。

### QA 测试工程师

- 建议第一红测：Playwright 从大厅输入昵称点击 `开一桌`，断言不会出现需要手动点击 `开始游戏` 的终态，并最终看到 `叫主`、`埋底`、`出牌` 或 `结算`。
- 建议回归：保留现有两客户端亮主/反主 E2E，避免快速开始改动破坏房间创建、socket 连接和牌局 UI。

### 对抗评审者

- 风险：自动加机器人后会收到多次 `RoomStateView`，若没有 guard 可能重复发送 `GameStart`。
- 风险：快速开始 session 标记若不清理，可能污染下一次普通建房。
- 采纳：实现必须把自动开始标记与 quick start 生命周期绑定，并用 ref/sessionStorage 双重防重。

### Release Reviewer

- 回滚路径：只需回滚 `Lobby.tsx`、`Room.tsx`、新增 E2E 和 `ITER-018` 文档状态即可恢复原手动开始流程。
- 暂不处理：6 人模式、排名积分、自动继续倒计时和完整机器人策略复制，原因是当前项目规则/座位模型仍是 4 人，直接展开会改变功能范围。

### 子代理报告

- 产品体验对比：`.superpowers/sdd/agents/iter018-product-review.md`
  - 采纳：快速开始必须不再停留普通等待态；后续把收墩赢家/得分/下一领出方做成默认摘要；结算页需要连续游戏节奏。
  - 暂缓：复制外站视觉皮肤、6 人模式、排行榜、音效、语言切换、完整牌谱保存。
- 规则与机器人对照：`.superpowers/sdd/agents/iter018-rules-bot-review.md`
  - 采纳：外站 55 分样本与本地 `ROUND_SCORE_TABLE` 一致，先补纯计分样本测试，不改规则。
  - 暂缓：外站“造反”是否允许非庄后反、甩牌范围、`高级机器人` 是否有主动甩牌或长期记牌，需要继续采样后再定。
- QA 矩阵：`.superpowers/sdd/agents/iter018-qa-matrix.md`
  - 采纳：新增 quick-start E2E；后续新增完整局到结算 E2E、bot 无卡顿 E2E、收墩驻留 E2E。
  - 暂缓：6 人产品决策测试，直到服务端座位模型和规则模型明确支持。

### 第一小闭环复审

- 快速开始红测已证明旧流程会停在 `4/4 人 ... 开始游戏`。
- 修复后 `pnpm test:e2e apps/web/e2e/quick-start.e2e.ts` 通过，普通创建房间仍等待显式开始。
- 对抗发现：新增 E2E 与原 bidding E2E 并行运行时共享 seeded server，导致牌序污染；已通过 Playwright `workers: 1` 修复，并记录到 `decision-log.md`。

### 第二小闭环复审：结算原因化文案

- 产品经理：结算页不能只显示“获胜方升几级”，需要直接回答“为什么升、谁升、底牌有没有扣”。已采纳为顶部结果条、基础得分、扣底说明和队伍升级。
- 真实玩家体验官：外站的 `庄家小胜 +1级` / `换庄 (不升级)` 比纯分数更容易理解。本项目采用同类短文案，不增加教程式解释。
- 规则专家：结算文案只从现有 `RoundResultView` 和 `teamOfSeat` 推导，不改 `scoring.ts` 分数段；外站 55 分样本继续由 `packages/game/test/scoring.test.ts` 锁定。
- 前端交互评审：结果条放在 `本局结算` 标题下方，基础分、扣底和总分逐行展示，避免把关键结论埋在底牌之后。
- QA 测试工程师：`apps/web/test/resultModal.test.tsx` 覆盖甩牌惩罚、庄家 55 分守庄、80 分换庄、扣底无分说明。
- 对抗评审者：旧测试只看数值，无法捕捉“玩家看不懂为什么这样结算”；新增测试直接断言玩家文案。

### 第三小闭环复审：结算自动继续

- 产品经理：快速机器人局应接近外站“结算后继续玩”的节奏，但普通邀请房不能被自动推进。
- 采纳：快速开始 session 保留已绑定房间标记；自动开局后只清 pending，结算倒计时只在该快速房间内生效。
- 前端交互评审：倒计时放在弹窗按钮下方，保留 `查看牌桌` 和 `下一局`。玩家查看牌桌会取消自动继续，手动下一局会清理倒计时。
- QA 测试工程师：新增完整局 E2E，从大厅 `开一桌` 自动打到 `本局结算`，断言结果文案、基础得分、扣底说明和 `秒后自动继续`。
- 对抗评审者：风险点是自动计时器在组件重渲染或离开房间后残留。已在 effect cleanup、手动下一局、查看牌桌和离开房间路径清理 timer/session。
- Release Reviewer：回滚重点是 `quickStart.ts` 的 pending/room 标记拆分、`Room.tsx` 自动开局清理方式、`GameTable.tsx` 自动继续 effect、`ResultModal.tsx` 倒计时展示和快速开始 E2E 完整局场景。

### 代码审查处理记录

- Important：quick-start pending 可能污染普通创建/加入房间。
  - 已修复：`Lobby.tsx` 在普通 `创建房间` 和 `加入房间` 前调用 `clearQuickStartSession()`；`quick-start.e2e.ts` 在普通建房测试中预置残留 pending，断言仍停留在等待室。
- Important：正数扣底时 `闲家基础得分` 显示了含扣底的小计，再单独显示 `闲家扣底 +N` 会像重复计分。
  - 已修复：`ResultModal.tsx` 把 `闲家基础得分` 改为扣底前牌分，`扣底说明` 单独展示扣底加分；新增正数扣底弹窗测试。
- Minor：`获胜方 ... 升 0 级` 与 `换庄 (不升级)` 文案冲突。
  - 已修复：0 级场景改为 `换庄，不升级`。
- Minor：`ITER-002` 截图因重跑 E2E 被刷新。
  - 处理：保留本次测试成功产物，最终提交前统一确认纳入或剔除；不影响运行时逻辑。

### 第四小闭环复审：牌桌顶部信息密度

- 产品经理：玩家在出牌时不应同时读两套主/级/庄/分信息。已采纳为“状态栏只管房间级状态，契约摘要管本局事实”。
- 真实玩家体验官：新 facts strip 能稳定扫到 `主`、`队伍级牌`、`庄`、`闲家`；最新亮牌/反主仍保留在标题和 detail 中。
- 前端交互评审：紧凑横屏隐藏长句 detail，保留 facts 和亮出的牌；E2E 增加 `.contract-summary` scrollWidth 断言。
- QA 测试工程师：新增 `contractSummary.test.tsx` 和 `statusBar.test.tsx`，扩展 `contract.test.ts`；E2E 覆盖反主后 facts 可见和紧凑横屏无溢出。
- 对抗评审者：风险是状态栏收敛后信息丢失。已通过 `ContractSummary` facts 测试覆盖 `主`、`队伍级牌`、`庄`、`闲家` 和反牌窗口，避免只从状态栏删除字段。
- Release Reviewer：回滚重点是 `contract.ts` facts 字段、`ContractSummary.tsx` fact strip、`StatusBar.tsx` 收敛和 CSS 响应式规则。

### 第四小闭环代码审查处理记录

- Important：紧凑横屏 E2E 只验证了不溢出，没有直接验证 `.contract-facts` 在紧凑视口仍展示关键事实。
  - 已修复：`bidding-flow.e2e.ts` 在 `844x390` 视口下直接断言 `.contract-facts` 可见 `主`、`无主`、`队伍级牌`、`庄`，并断言 `.contract-cards` 仍有亮出的牌。
- Minor：`contract-facts` 的 `aria-label` 没覆盖队伍级牌和反牌窗口。
  - 已修复：aria label 改为 `当前主牌、级牌、庄家、分数与反牌窗口`。
- Recommendation：补无主 facts 单测。
  - 已修复：`contract.test.ts` 的无人亮主/无主 fallback 场景断言 `主 无主 2` 和 `庄 你`。

### 第五小闭环复审：自动续局后的第二局起始状态

- 产品经理：外站结算倒计时的价值不是只显示倒计时，而是玩家不用再操作即可继续下一局。
- QA 测试工程师：`quick-start.e2e.ts` 的完整局场景扩展为结算后等待倒计时结束，断言 `本局结算` 消失并进入下一局 `叫主|埋底|出牌`。
- 对抗评审者：该 E2E 同时确认 `ContractSummary` facts 在第二局仍可见，避免自动续局后信息面板空白或停留上一局。
- Release Reviewer：这是一项测试/证据扩展；如需回滚，只移除 `quick-start-auto-continued-round.png` 和 quick-start E2E 后半段自动续局断言即可。

### 第六小闭环复审：亮主/反主策略解释样本池

- 产品经理：外站快速开始的策略体验来自“机器人动作可被看见且节奏不断”，本项目下一步不能只靠随机试玩评价 bot 是否自然。已采纳为固定策略样本池，先让亮主/反主输出原因码。
- 真实玩家体验官：外站重采样中，顶部明确展示机器人 C 亮 `♥2`、当前主 `♥`、级牌 `2` 和庄家；提示按钮能在 9 张跟牌场景中一次性选满。已记录到 `bot-strategy-samples.md`。
- 规则专家：`explainBid` 不改变 `availableBids` / `bidBeats` 的规则强度，只解释既有候选选择；`decideBid` 复用解释结果，避免双逻辑。
- QA 测试工程师：新增亮主/反主解释样本，红测失败于 `explainBid is not a function`；补充保护自身合约、无更强候选和领牌样本后 `pnpm test packages/bot/test/bot.test.ts --no-cache` 通过 33 项。
- QA 补充建议：外站可见机器人会主动领多张组合。已采纳为 `explainPlay` 固定样本：无安全散单时主动领拖拉机、无安全散单/拖拉机时主动领强对子；不改变现有策略。
- 对抗评审者：外站机器人会领多张组合，但本项目不应让 bot 访问全量对手手牌来“知道”甩牌是否失败；主动甩牌必须另建非全知风险模型。
- QA 回归：全套 `pnpm test:e2e` 首次失败于完整快速机器人局 45 秒推进窗口不足，页面仍在正常出牌阶段；单独复跑该用例通过。已把完整局验证预算扩到 130 秒/100 秒，避免把较慢确定性牌局误判为回归。
- Release Reviewer：回滚范围小，涉及 `packages/bot/src/bid.ts`、`packages/bot/src/index.ts`、`packages/bot/test/bot.test.ts`、`apps/web/e2e/quick-start.e2e.ts` 的验证预算和 ITER-018 文档；服务端和前端协议无变化。

### 第七小闭环复审：非全知主动甩牌策略

- 产品经理：外站机器人能领出多张组合，本项目需要向“会主动打大牌型”靠近，但不能因此让 bot 变成偷看全手牌的全知玩家。
- 规则专家：采纳保守边界。只有当 bot 自己已成对持有所有能压住子对子的更高对子时，才允许主动甩；副牌多对子无法证明不会被主对压住时继续保守。
- QA 测试工程师：新增两条 `explainPlay` 样本，可证明安全的无主级牌/王组主动甩，无法证明安全的副牌多对子不主动甩；目标测试 `pnpm test packages/bot/test/bot.test.ts --no-cache` 通过 35 项。
- 代码评审 Minor：补充主花色级牌 + 王对仍按普通拖拉机、非主级牌组可安全甩、仅小王对 + 大王对不足以甩牌三个边界样本；目标测试更新为 38 项通过。
- 前端交互评审：新增 `lead-safe-throw-pairs` 提示文案，玩家点击提示时能理解这是低风险主动甩牌。
- Release Reviewer：回滚重点是 `packages/bot/src/play.ts` 的安全甩牌 helper、`apps/web/src/lib/playHint.ts` reason 文案和 `packages/bot/test/bot.test.ts` 新样本；不涉及服务端协议和甩牌规则层。
