# Iteration Review Notes

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
