# Iteration Decision Log

## 2026-07-22：建立 `docs/iteration/` 为长期迭代入口

**决策：** 后续新功能、修复和验证工作以 `docs/iteration/todo.md` 为唯一任务入口；原 `docs/game-iteration/` 保留为上一轮亮主/反主专项证据档案。

**原因：** 现有 `docs/game-iteration/` 记录的是一次专题迭代，不适合作为长期 backlog；用户明确要求统一维护 `docs/iteration/`。

**影响：** 后续代码修改必须关联 `ITER-xxx` 任务编号。

**回滚：** 删除 `docs/iteration/` 不影响运行代码；但会失去后续迭代追踪入口。

## 2026-07-22：当前阶段不修改业务代码

**决策：** 本阶段只读取代码/文档/测试/提交历史并新增迭代文档，不改 `apps/`、`packages/`、配置或测试。

**原因：** 用户明确要求“请先不要直接改代码”。

**影响：** 已发现问题只记录，不在本阶段修复。

**回滚：** 仅回滚 `docs/iteration/` 文档即可恢复。

## 2026-07-22：以当前 worktree 作为事实基线

**决策：** 文档事实基于 `/Users/weipanyue/shengji/.worktrees/codex-game-iteration-visibility` 当前状态，而不是 `main` 的提交快照。

**原因：** 当前试玩和上一墩赢家修复都发生在该 worktree；用户后续试玩也指向该分支服务。

**影响：** `ITER-000` 必须先解决未提交改动的收敛方式。

**回滚：** 可切回主工作区 `/Users/weipanyue/shengji` 的 `main` 重新生成基线文档。

## 2026-07-22：先做操作可靠性，再铺开视觉和规则专项

**决策：** 优先级顺序为基线治理、重复操作/错误反馈、E2E 基础设施、无障碍、bot 调度、规则边界、响应式、收墩体验、重连、发布硬化。

**原因：** 用户试玩已经暴露“状态反馈不可信”的问题；没有基线和 E2E 护栏前继续做大 UI 改动风险高。

**影响：** 即使响应式和无障碍也重要，仍需排在可重复验证基础之后或与其绑定。

**回滚：** 可在 `todo.md` 调整优先级，但必须记录新原因。

## 2026-07-22：跨队反主级牌规则先不改，只列为规则决策任务

**决策：** 当前文档不默认改变“本局级牌由计划庄家队伍确定，反主不切换级牌”的 MVP 规则。

**原因：** 这是现有实现和测试锁定的行为；改动会影响 `detectBid`、`applyReveal`、UI 文案和结算理解，需要单独规则设计。

**影响：** `ITER-005` 先补规则边界测试和决策文档，再决定是否改规则。

**回滚：** 若用户明确指定新规则，可新增规则设计文档并调整 `ITER-005` 验收标准。

## 2026-07-22：新增高级玩法先进入 ITER-013 到 ITER-017

**决策：** 将用户新增目标拆成可独立验收的功能项：任意张数亮庄和大小王反主、庄前/庄后反牌、甩牌和失败惩罚、机器人亮庄/埋牌/领牌/跟牌策略、出牌提示按钮、扩展 bugfix 缺陷池。

**原因：** 这些能力跨规则状态机、bot、UI、测试和文档；如果混在一个“大改机器人和规则”的任务里，会导致测试边界和回滚路径不清晰。

**影响：** 后续实现必须先做规则基础，再接 bot 和 UI；每个功能的完成证据写回对应 `docs/iteration/NNN-*.md`。

**回滚：** 若某个高级玩法实现风险过高，可只回滚对应 `ITER-xxx` 的提交，不影响已经完成的基线、亮牌可见性和普通出牌流程。

## 2026-07-22：当前 dirty worktree 作为基线提交

**决策：** 在新增功能说明文档后，提交当前 worktree 的既有代码和文档改动，形成后续迭代的 Git 检查点。

**原因：** 用户明确要求“加上上述功能的说明文档后，提交本 worktree 代码，然后进行迭代开发”；当前分支已有上一轮可见性、收墩归属、等待反馈和测试改动，继续叠加会降低回滚能力。

**影响：** 新功能开发从提交后的 HEAD 开始；任何新增 bugfix 都必须对应 `ITER-xxx`。

**回滚：** 可用该基线提交的父提交作为整体回滚点，或使用后续单功能提交逐项回滚。

## 2026-07-22：ITER-013 亮牌强度采用张数优先

**决策：** 任意张数亮牌的强度比较采用“张数优先；同张数时花色级牌 < 小王 < 大王；同张数同类别不同花色不能反”的模型。单张小王和单张大王均为无主亮牌，大王单张可以反小王单张。

**原因：** 用户明确要求任意张数亮牌和大王反小王。张数优先能兼容现有单张/对子顺序，并为多副牌或测试构造的三张以上级牌保留扩展空间。

**影响：** `BidKind` 扩展为 suit/small-joker/big-joker 的 single/pair/multiple；UI 按真实张数显示亮牌文案。

**回滚：** 回滚 `packages/shared/src/cards.ts`、`packages/game/src/bidding.ts`、`apps/web/src/lib/contract.ts`、`apps/web/src/lib/announcements.ts`、`apps/web/src/components/ActionBar.tsx` 及对应测试即可恢复旧单张/对子模型。

## 2026-07-22：ITER-014 庄后反牌先限定为庄家拿底后反牌

**决策：** 庄前反牌等同于现有 bidding 轮次；庄后反牌窗口插在庄家拿到底牌后、埋底前，并且只有庄家可以用更强亮牌再次反/改主。完成后仍由同一庄家埋底。

**原因：** 这是最小可验收实现：不改变底牌归属和庄家责任，同时支持“拿底后发现更强主牌再反”的真实体验。

**影响：** `RoomStateView` 和 `RoundState` 新增 `biddingStage`；bot 在 burying 阶段会先尝试庄后反牌，再埋底；UI 会在契约摘要、等待文案和 ActionBar 展示庄后窗口。

**回滚：** 回滚 `biddingStage` 字段、`applyReveal` 的 burying 分支、ActionBar 庄后可反 UI 和 botRunner burying reveal 尝试，即可恢复旧的 bidding -> burying -> playing 流程。

## 2026-07-22：ITER-010 bot 反主先做强度评分和同队保护

**决策：** bot 叫主/反主候选由规则层 `availableBids` 生成，策略层只负责过滤和排序。排序优先张数、王/花色类别和花色长度；同队已有同张数合约时不做仅类别更高的反主。

**原因：** 这样能避免 bot 重复实现规则强度，也能修复“先遇到弱花色单张就亮、漏掉大王反小王、乱反队友强约”的三个体验问题。

**影响：** bot 开局更倾向亮最强高置信牌；庄后拿底后也能复用同一策略先尝试更强反牌。

**回滚：** 回滚 `packages/bot/src/bid.ts`、`packages/bot/test/bot.test.ts` 和 `apps/server/src/botRunner.ts` 中传入 `biddingStage` 的改动。

## 2026-07-22：ITER-005 先锁定现状规则，不改实现

**决策：** 本轮只补规则边界测试，不改变现有规则实现。新增测试覆盖无主级牌必须当主跟、round 层末墩每人多张时扣底倍率来自 `lastTrickCardsPerPlayer`。

**原因：** 这些边界是甩牌惩罚和埋牌策略的基础；先锁定现状能避免后续新增规则时误改结算。

**影响：** 测试数增加，生产代码不变。

**回滚：** 删除 `packages/game/test/follow.test.ts` 和 `packages/game/test/round.test.ts` 中本轮新增测试即可回滚。

## 2026-07-22：ITER-016 甩牌第一版限定为非拖拉机多对子

**决策：** 第一版甩牌只支持首家领出时“同一有效花色的两个或以上对子，且整组不是普通拖拉机”。`n` 定义为尝试甩出的对子数，失败惩罚为 `20 * n`。任一对手能以更大同花色对子或主对子压住任一子对子即失败；失败后只实际领出最低且可被压住的对子，其余尝试牌留在手牌。

**原因：** 该范围能覆盖升级中最核心、最容易解释的甩牌场景，同时避免把混合单张、对子加拖拉机、跨花色等地方变体一次性塞进现有 `Combo`/`follow`/`trickWinner` 链路。规则专家评审认为这是最小且可审计的实现。

**影响：** `ComboType` 新增 `throw-pairs`；`RoundState` 和 `RoomStateView` 新增甩牌事件和队伍惩罚分；结算结果新增基础分和甩牌惩罚差值。成功甩牌首家锁定本墩赢家，失败甩牌按实际落桌对子继续普通墩判定。

**回滚：** 回滚 `packages/game/src/throw.ts`、`round.ts` 中甩牌分支、`follow.ts`/`trick.ts` 的 `throw-pairs` 处理、`scoring.ts` 惩罚分字段、`packages/shared/src/cards.ts`/`state.ts` 新类型，以及对应 UI 和测试改动，即可恢复普通出牌流程。

## 2026-07-22：ITER-011 埋牌断门奖励必须有低风险边界

**决策：** 机器人埋牌候选只对“明确目标断门”给奖励；补足到底牌 8 张的牌必须是非主、无分、非对子成员。弱庄不主动拿断门奖励，均衡庄和强庄才会比较安全断门候选。新增 `explainBury` 返回候选和庄家强弱估算，用于策略审计和测试。

**原因：** 代码评审指出第一版 `candidateCost` 容易被理解为把断门奖励外溢到整组候选，导致为了断门牺牲分牌或对子。虽然当前单卡成本排序已经大幅惩罚分牌、主牌和对子成员，显式边界更容易审计，也能让弱庄策略与强庄策略分开。

**影响：** `decideBury(hand, trump)` 保持外部调用方式不变，内部通过主牌数量和关键主控估算庄家强弱。弱庄更保守，强庄更愿意在补牌安全时制造短门。`explainBury` 只在 bot 包层暴露策略解释，不改变服务端状态机，也不会让玩家 UI 看到隐藏底牌。

**回滚：** 回滚 `packages/bot/src/bury.ts` 中 `DealerProfile`、`BuryCandidate`、`explainBury`、低风险补牌门槛和对应 `packages/bot/test/bot.test.ts` 用例，即可恢复上一版候选评分。

## 2026-07-22：ITER-012 出牌策略先做可解释的局部评估

**决策：** 新增 `explainPlay(view) -> { cardIds, reason }` 作为 bot 出牌解释接口，`decidePlay` 保持原返回值。第一版只基于当前手牌、当前墩、队友/敌方领先、分牌和有效花色做局部评估，不做长期记牌、主动甩牌或概率模型。

**原因：** 用户目标同时包含高级 bot 和后续出牌提示按钮。先把推荐理由沉淀在 bot 包内，可以让测试直接验证“为什么出这手”，也能避免 UI 提示阶段重新实现一套策略。

**影响：** bot 领牌会优先保留组合，跟牌会在有分可抢时用最小可赢组合，队友领先时送分并省控制牌。`throw-pairs` 跟牌仍遵循当前规则中“领出者固定赢”，不设计反甩。

**回滚：** 回滚 `packages/bot/src/play.ts` 的 `explainPlay`、`PlayReason`、组合排序 helper 和对应 `packages/bot/test/bot.test.ts` 用例；`decidePlay` 可恢复为直接返回原 `decideLead/decideFollow` 结果。

## 2026-07-22：ITER-015 出牌提示只做本地推荐和解释

**决策：** 前端出牌提示复用 `@shengji/bot` 的 `explainPlay`，点击“提示”只在本地选中推荐牌并展示一句理由，不自动发送 `TrickPlay`，也不新增服务端协议。

**原因：** 用户目标是让玩家理解当前可选出牌，而不是让系统代打。复用 bot 策略能避免提示和机器人决策分叉，且本地状态不会改变公共牌局。

**影响：** web 包显式依赖 `@shengji/bot`；前端需要用 `detectCombo` 和甩牌事件重建当前墩的 `Combo`。提示状态绑定阶段、座位、主牌、手牌、当前墩和甩牌事件元数据，避免状态变化后残留。

**回滚：** 回滚 `apps/web/src/lib/playHint.ts`、`GameTable.tsx`、`ActionBar.tsx`、`HandFan.tsx`、`CardFace.tsx`、`styles.css`、web 依赖声明和对应测试，即可恢复无提示按钮的出牌流程。

## 2026-07-22：ITER-015 暂不引入新的前端交互测试框架

**决策：** 本轮不引入 React Testing Library 或 jsdom；保留现有 SSR 组件测试风格，动态点击流程用浏览器自动化验证并记录截图。

**原因：** 当前仓库测试体系以规则纯函数、服务端 socket 和 SSR markup 为主。为了一个小闭环引入新测试栈会扩大依赖和配置风险；稳定浏览器 E2E 已由 `ITER-002` 专项追踪。

**影响：** `GameTable` 点击提示、手动出牌、移动端布局的证据写入 `015-play-hint-button.md` 和 `test-report.md`，但还不是可重复 CI fixture。

**回滚：** 文档决策可单独调整；如果后续 `ITER-002` 引入 E2E，可把本轮浏览器路径迁移为自动化脚本。

## 2026-07-22：BUG-017-001 先用当前墩状态阻断错误回放

**决策：** 上一墩驻留只在 `phase=playing`、`currentTrick.length=0`、`lastTrick` 完整时启动；如果当前墩已经开始，客户端必须展示当前墩并允许符合回合的操作。上一墩赢家只使用 `lastTrickWinnerSeat`，不再用 `turnSeat` fallback。

**原因：** 用户反馈的核心问题是旧墩回放覆盖当前墩、赢家显示不可信。当前协议缺少 `roundId/trickIndex/stateVersion`，但 `currentTrick.length > 0` 已足以判断“下一墩已经开始”，应立即阻止旧驻留覆盖当前事实。

**影响：** 重连/刷新到已开下一墩的牌局时不会再回放上一墩；缺失赢家字段时显示“本墩结束”，避免把下一位跟牌者错误标为上一墩赢家。

**回滚：** 回滚 `apps/web/src/lib/settledReview.ts`、`apps/web/src/pages/GameTable.tsx` 和 `apps/web/test/settledReview.test.ts` 即可恢复旧驻留逻辑。长期更稳的协议字段由 `ITER-002`/`ITER-007` 后续评估。

## 2026-07-22：BUG-017-002 甩牌失败只看对手

**决策：** 甩牌失败判定中，“有人可压住其中对子”的“有人”限定为对手，不包含甩牌者队友。队友持有更大同花色对子或主对，不会导致甩牌失败或产生罚分。

**原因：** 升级甩牌失败的惩罚语义是防止甩牌方被对方压住；队友可压不应惩罚本方。旧实现扫描除自己外三家，导致合法甩牌被误判失败，并污染实际落桌牌和罚分账本。

**影响：** `evaluateThrowLead` 只允许对手触发失败；round 层在只有队友能压时会保留完整甩牌并不增加 `throwPenaltyPoints`。

**回滚：** 回滚 `packages/game/src/throw.ts` 中同队过滤和对应 `throw.test.ts` / `round.test.ts` 用例即可恢复旧行为。

## 2026-07-22：ITER-001 先用前端同步 pending 锁消除误导性重复点击

**决策：** 第一小闭环不改服务端协议，先在 `GameTable` 对所有服务端动作建立本地 pending 锁，并用 `pendingActionRef` 做同步幂等保护；`ActionBar` 负责展示“处理中…”和禁用状态。

**原因：** 用户可见问题来自快速重复点击后的误导性错误提示。服务端已有规则校验能保证状态安全，但玩家需要在操作位置看到“请求已提交”。浏览器验证证明仅依赖重新渲染后的 `disabled` 存在同帧双击窗口，因此需要同步 ref 锁。

**影响：** 亮牌、过牌、埋底、出牌、下一局提交后进入 pending；收到新 `RoomStateView` 或错误后释放。提示、清空选择、手牌选择在 pending 期间禁用，避免玩家误以为能修改已提交动作。

**回滚：** 回滚 `ActionBar` 的 `pendingAction` prop、`GameTable` 的 `submitAction`/`pendingActionRef` 和 `actionBar.test.tsx` 的 pending 用例即可恢复旧行为。错误持久化和 socket 级幂等断言继续作为 ITER-001 后续小闭环。

## 2026-07-22：ITER-001 错误提示保留到关闭或成功状态刷新

**决策：** 前端错误从短字符串升级为带 `id/code/title/hint/text` 的 `VisibleError`；不再 3 秒自动消失，改为用户关闭或下一次成功 `RoomStateView` 到达时清除。

**原因：** 真实玩家和 QA 都需要能复查错误内容；短 toast 容易在玩家读完前消失，也难以用浏览器自动化断言。错误 id 还解决了同一错误文案连续出现时 React effect 无法感知新事件的问题。

**影响：** `wrong-turn` / `wrong-phase` 追加“动作可能已经提交或状态变化”的解释；unknown code 会展示 code 和服务端 message。`GameTable` 的 pending 释放改为监听 `state.error?.id`。

**回滚：** 回滚 `apps/web/src/lib/errors.ts`、`apps/web/src/components/ErrorToast.tsx`、`apps/web/src/store.tsx` 错误对象化、`App.tsx` 顶层错误组件和对应测试/CSS 即可恢复旧 3 秒 toast。

## 2026-07-22：ITER-001 暂不静默服务端重复动作错误

**决策：** 本轮不在服务端静默吞掉 `wrong-turn` / `wrong-phase`，也不把它们统一降级为弱提示；只补 socket 级测试证明重复请求不会重复落盘。

**原因：** 当前协议没有 action id、客户端 stateVersion 或服务端去重窗口，无法可靠判断一个错误是重复包、网络延迟还是玩家真实非法操作。静默处理会掩盖真实规则错误，降低 QA 发现问题的能力。

**影响：** 前端主路径通过 pending 锁避免重复点击；如果仍出现服务端错误，错误卡片会解释“动作可能已经提交或状态变化”。服务端测试覆盖重复 `BidPass`、`TrickPlay` 和 `RoundNext` 不多推进。

**回滚：** 本决策对应的是测试和文档，不改变生产逻辑；如后续引入 action id / stateVersion，可新增服务端幂等表并调整错误展示分级。

## 2026-07-22：ITER-002 使用 Playwright + env-only deterministic hooks

**决策：** E2E 采用 Playwright；确定性通过 `createApp({ rng })` 和 server 入口 env `SHENGJI_TEST_SEED` 注入，不新增测试 HTTP 控制接口。bot 节奏通过 `SHENGJI_BOT_DELAY_MS` 固定。

**原因：** Playwright 能覆盖多 browser context、截图、trace 和真实 DOM 交互；rng 注入比生产暴露 debug endpoint 更安全，也能被 server 单测覆盖。env 未设置时仍走现有 `Math.random` 和默认 bot delay。

**影响：** 新增 `pnpm test:e2e`、`playwright.config.ts`、`apps/web/e2e/*.e2e.ts`、`apps/server/src/testHooks.ts`。Playwright 自动拉起 server `43101` 和 web `45175`，失败产物写入 `docs/iteration/artifacts/ITER-002/` 下的忽略目录，成功截图可提交。

**回滚：** 移除 `@playwright/test`、`playwright.config.ts`、`apps/web/e2e/`、`apps/server/src/testHooks.ts` 和 `createApp`/`gameFlow` 的 rng 参数；删除 `pnpm test:e2e` 脚本和 `.gitignore` 中 Playwright artifact 规则。

## 2026-07-22：ITER-002 紧凑横屏徽章上移优先于缩小文字

**决策：** 在 `max-width: 900px` 横屏布局中，将 `.player-left` 从垂直居中调整到 `top: 34%`，避免与左下 `.player-bottom` 徽章重叠。

**原因：** 红测截图显示重叠不是文字过长造成，而是短高视口内两个绝对定位锚点过近。继续缩小字号会降低可读性，且不能保证不同昵称下不重叠。

**影响：** 紧凑横屏下左侧座位更靠上，给底部玩家和手牌区域留空间。E2E 用 bounding-box 断言固定该约束。

**回滚：** 恢复 `.player-left` 紧凑横屏样式，删除 compact E2E 中的 badge overlap 断言和截图即可。

## 2026-07-22：ITER-018 用 shengji.org 作为产品基准但不复制不可见服务端策略

**决策：** 新增 `ITER-018`，优先对齐 `shengji.org` 的快速开始和玩家可见信息层级；外站只能从页面、截图、公开前端文案和试玩行为得出结论，机器人内部策略只记录“观察事实”和“推断”，不把推断写成规则真相。

**原因：** 用户明确要求模仿 `shengji.org` 快速开始模式并多次试玩。外站核心服务端逻辑不可见，若直接声称复制记分或 AI 算法会失去证据基础。

**影响：** 当前推进项从 `ITER-002` 暂切到 `ITER-018`。第一小闭环只做一键快速机器人局自动开局，因为它直接阻塞试玩；结算文案、自动继续、6 人模式和机器人概率策略进入后续小闭环。

**回滚：** 回滚 `018-shengji-org-benchmark.md`、`todo.md`/`plan.md`/`test-report.md`/`review-notes.md`/`decision-log.md` 中的任务切换，以及后续快速开始相关代码和 E2E 即可恢复到继续 `ITER-002` 的路线。

## 2026-07-22：ITER-018 E2E 共享 seeded server 串行运行

**决策：** Playwright 配置设置 `workers: 1`。

**原因：** 新增 quick-start E2E 后，多个 E2E 文件并行共用同一个 `SHENGJI_TEST_SEED=iter-002` server。并行开局会抢占同一随机流，导致原亮主/反主 smoke 中 host 不再拿到可亮的 `♣2`，测试超时。当前 server 没有 per-test seed 重置接口，串行运行是最小可验证修复。

**影响：** `pnpm test:e2e` 稍慢，但 3 个 chromium E2E 仍在 10 秒内完成；确定性牌序恢复稳定。

**回滚：** 若后续引入 per-test/per-room seed fixture，可移除 `workers: 1` 并把 E2E 重新并行化。

## 2026-07-22：ITER-018 快速开始房间标记保留到结算

**决策：** 快速机器人局自动开局后只清除 `shengji:quickStartPending`，保留 `shengji:quickStartRoom` 到玩家离开房间或主动清理 session。

**原因：** `shengji.org` 快速开始样本在结算后显示自动继续倒计时。本项目如果开局时完全清掉 quick-start session，牌桌结算阶段无法区分“快速机器人局”和“普通邀请房”，要么无法自动继续，要么误伤普通房间。

**影响：** `GameTable.tsx` 只在 `isQuickStartRoom(view.roomCode)` 且 `phase === scoring` 时启动 10 秒倒计时；`查看牌桌`、手动 `下一局` 和 `离开本局` 会清理计时器或 session，普通创建房间不自动续局。

**回滚：** 恢复 `Room.tsx` 开局后调用 `clearQuickStartSession()`，删除 `clearQuickStartPending` / `isQuickStartRoom`、`GameTable.tsx` 自动继续 effect、`ResultModal.tsx` 倒计时展示和相关测试即可回到只自动开局、不自动续局的行为。
