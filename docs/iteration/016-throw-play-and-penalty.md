# ITER-016 Throw Play And Failed Throw Penalty

## 功能名称

甩牌功能与失败惩罚结算

## 优先级

P0

## 当前状态

Done

## 背景

用户要求支持甩牌，并在甩牌失败时惩罚，按照甩出的牌型扣 `20 * n`。这是规则和结算层的重要扩展，必须先定义失败判定、惩罚归属、展示方式，再接 UI。

## 需要解决的问题

- 需要定义哪些组合可作为甩牌候选。
- 需要判断其他玩家是否存在能压住甩牌中某个子牌型的牌。
- 甩牌失败后如何改为实际出牌、如何扣分、扣谁的分、`n` 如何计算必须明确。
- 惩罚必须在墩区、公告、结算中可见，不能只写入内部日志。

## 用户可感知收益

- 支持升级/拖拉机真实玩法中的关键进攻手段。
- 甩牌失败有明确反馈和代价，玩家能理解为什么扣分。
- bot 和提示按钮可以围绕甩牌风险做更像真人的判断。

## 涉及模块 / 文件

- `packages/game/src/combo.ts`
- `packages/game/src/follow.ts`
- `packages/game/src/trick.ts`
- `packages/game/src/scoring.ts`
- `packages/game/src/round.ts`
- `packages/game/test/combo.test.ts`
- `packages/game/test/follow.test.ts`
- `packages/game/test/round.test.ts`
- `packages/shared/src/state.ts`
- `apps/web/src/components/ActionBar.tsx`
- `apps/web/src/components/TrickArea.tsx`
- `apps/web/src/lib/announcements.ts`

## 实现思路

1. 在规则文档和测试中定义甩牌子牌型、失败检测和 `n` 的含义。
2. 先实现纯规则函数：输入甩牌、其他玩家手牌、当前主，输出成功/失败、失败原因、惩罚分。
3. 在 `applyPlay` 中接入甩牌 action，失败时记录 penalty event。
4. UI 展示甩牌成功/失败、惩罚分、实际进入墩的牌。
5. bot 策略后续通过 `ITER-012` 使用同一规则函数评估风险。

## 验收标准

- 合法甩牌能作为领牌进入当前墩。
- 失败甩牌会按 `20 * n` 计罚，且惩罚归属明确。
- 失败原因能在 UI 中被玩家看到。
- 甩牌不会破坏跟牌合法性、墩赢家判定或最终结算。
- 甩牌场景有单元测试、状态机测试和浏览器验证。

## 测试方式

- `pnpm test packages/game/test/combo.test.ts`
- `pnpm test packages/game/test/follow.test.ts`
- `pnpm test packages/game/test/round.test.ts`
- `pnpm test packages/game/test/scoring.test.ts`
- 浏览器验证：成功甩牌、失败甩牌、惩罚展示、结算分变化。

## 风险和回滚方式

- 风险：不同地区甩牌失败规则存在变体。
- 控制：本任务先实现用户指定的 `20 * n`，变体写入 decision-log。
- 回滚：回滚甩牌 action、规则函数和 UI 展示，普通出牌流程保留。

## 依赖

- `ITER-005`
- `ITER-013`

## 执行记录

2026-07-22 启动实现。采用第一版最小规则：

- 仅支持首家领出时甩牌。
- 甩牌范围限定为同一有效花色的两个或以上对子，且整组不是普通拖拉机。
- `n = 尝试甩出的对子数`，失败惩罚为 `20 * n`。
- 任一对手能以更大同有效花色对子或主对子压住任一子对子时，甩牌失败。
- 失败后只将最低且可被压住的对子作为实际领牌，其余尝试甩出的牌留在手牌。
- 惩罚作为受益队伍分账记录，结算时折算到闲家有效分。

## 实现结果

- 新增 `packages/game/src/throw.ts`，负责甩牌候选识别、失败检测、实际领牌和惩罚事件生成。
- `ComboType` 新增 `throw-pairs`，只由甩牌规则函数构造；普通 `detectCombo` 仍只识别单张、对子、拖拉机。
- `applyPlay` 在首家领出且普通牌型非法时尝试甩牌判定：
  - 成功：完整甩牌进入 `currentTrick`，首家锁定为本墩赢家。
  - 失败：只移除实际领出的最低可压对子，其他尝试牌保留在手牌，记录 `throwEvent` 和受益队罚分。
- `settleRound` 新增 `throwPenaltyPoints` 输入，结果中输出 `baseDefenderPoints`、`throwPenaltyDelta`、`throwPenaltyPoints`，最终 `defenderPoints` 按受益队折算且不低于 0。
- `RoomStateView` 下发 `throwEvents`、`throwPenaltyPoints`，`currentTrick/lastTrick` 中的出牌也可携带 `throwEvent`。
- UI 更新：
  - `ActionBar` 在选择 4 张以上时显示 `出牌 / 甩牌`。
  - `TrickArea` 在实际领牌旁展示 `甩牌成功` 或 `甩牌失败 · 实际领出 · -X`。
  - `deriveAnnouncements` 为甩牌成功/失败生成公告，失败公告包含 `20 × n = X`。
  - `ResultModal` 展示基础牌分、甩牌惩罚差值和最终闲家总分。
  - `store.tsx` 新增 `invalid-throw` 可理解错误文案。

## 测试记录

### 红测

- `pnpm test -- packages/game/test/throw.test.ts packages/game/test/round.test.ts packages/game/test/scoring.test.ts`
  - 初始失败符合预期：缺少 `../src/throw`、`applyPlay` 返回 `invalid-combo`、结算结果缺少惩罚字段。
- `pnpm test -- apps/web/test/announcements.test.ts apps/web/test/trickArea.test.tsx apps/web/test/actionBar.test.tsx apps/web/test/resultModal.test.tsx`
  - 初始失败符合预期：公告、墩区、操作栏、结算弹窗均未展示甩牌信息。

### 当前目标验证

- `pnpm test -- packages/game/test/follow.test.ts packages/game/test/throw.test.ts packages/game/test/round.test.ts packages/game/test/scoring.test.ts apps/server/test/socket.test.ts apps/web/test/announcements.test.ts apps/web/test/trickArea.test.tsx apps/web/test/actionBar.test.tsx apps/web/test/resultModal.test.tsx`
  - 通过：23 个测试文件，179 个测试。
- 代码评审修复后新增回归：
  - `pnpm test -- apps/web/test/resultModal.test.tsx apps/web/test/trickArea.test.tsx packages/bot/test/bot.test.ts`
  - 通过：23 个测试文件，182 个测试。
- `pnpm typecheck`
  - 通过：`pnpm -r exec tsc --noEmit`。
- 最终全量验证：
  - `pnpm test`：通过，23 个测试文件，182 个测试。
  - `pnpm typecheck`：通过。
  - `pnpm build`：通过。

### 浏览器验证

- 当前 worktree 服务：
  - server: `PORT=3102 pnpm --filter @shengji/server dev`
  - web: `VITE_SERVER_URL=http://127.0.0.1:3102 pnpm --filter @shengji/web dev --host 127.0.0.1 --port 5180`
- in-app browser 打开 `http://127.0.0.1:5180/`。
- 实测流程：
  - 输入昵称并创建快速机器人局，房间 `VLQ7M`。
  - 开始游戏后，机器人2 亮主大王一对；UI 可见 `机器人2 亮主 大王一对，本局无主，级牌 2，庄家 机器人2`。
  - 进入出牌阶段，完成多轮真人跟牌，确认上一墩回看按钮不覆盖当前墩展示。
  - 选择 4 张手牌后，DOM 断言 `.action-bar` 文本为 `出牌 / 甩牌\n清空选择`。
- 截图证据：
  - `docs/iteration/016-browser-throw-actionbar.png`
  - `docs/iteration/016-browser-actionbar-crop.png`
- 限制：随机牌局未自然触发成功/失败甩牌；成功/失败可见性由 React 静态渲染测试覆盖，稳定 E2E fixture 仍归入 `ITER-002`。

## 多角色评审采纳记录

- 规则专家：采纳第一版范围限定为同一有效花色两个以上对子；采纳 `n = 甩出的对子数`；采纳失败后只落最低可压对子；采纳成功甩牌首家锁定赢家。
- QA：采纳规则函数、状态机、结算、投影和 UI 分层测试；新增 `throw.test.ts`、`round.test.ts`、`scoring.test.ts`、`socket.test.ts`、`announcements/trickArea/actionBar/resultModal` 测试。
- 产品/前端评审：采纳结构化事件下发；采纳失败公告不暴露具体对手手牌；采纳墩区常驻标签和结算明细。

## 代码评审修复

- Important：结算弹窗在两队甩牌罚分相互抵消时隐藏账本。
  - 修复：`ResultModal` 只要任一队有甩牌罚分，就显示 `蓝队 X / 红队 Y，净 Z`。
  - 测试：`apps/web/test/resultModal.test.tsx` 增加净额为 0 的账本可见性测试。
- Important：上一墩回看缺少甩牌事件标签。
  - 修复：`TrickArea` 在“上一墩”折叠摘要和展开明细中展示甩牌成功/失败。
  - 测试：`apps/web/test/trickArea.test.tsx` 增加上一墩甩牌失败可见性测试。
- Minor：bot 通过拖拉机兜底路径跟 `throw-pairs`。
  - 修复：`packages/bot/src/play.ts` 新增显式 `throw-pairs` 跟牌分支。
  - 测试：`packages/bot/test/bot.test.ts` 增加甩牌领出时尽量跟对子测试。

## 未处理事项

- 本轮未实现混合单张、对子加拖拉机、跨花色甩牌等复杂地方变体。
- bot 暂不主动甩牌；`ITER-012` 会复用 `evaluateThrowLead` 做风险评估。bot 已能显式跟随 `throw-pairs`。
- 自动化浏览器 fixture 尚未接入仓库；仍由 `ITER-002` 处理。
