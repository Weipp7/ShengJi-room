# 功能实现日志

## 2026-07-22：亮牌/反主与完整牌局体验迭代

### 1. Durable bid history

背景：客户端原来只能从相邻 `RoomStateView` 快照推导亮牌/反主。如果 bot 连续行动或 React 合并渲染，中间反主事件可能被跳过，持久 UI 也无法判断 winning bid 是亮主还是反主。

实现：

- `packages/game/src/round.ts` 增加 `bidHistory: Bid[]`，每次 `applyReveal` 成功后追加。
- `packages/shared/src/state.ts` / `apps/server/src/app.ts` 将 `bidHistory` 投影给客户端。
- `apps/web/src/lib/announcements.ts` 优先根据 `bidHistory` 补齐所有未见过的亮牌/反主事件，避免快照跳过导致丢事件。

影响范围：只读状态扩展，不改变叫主强度、庄家、主花色或发牌逻辑。

### 2. 亮牌/反主公告文案增强

背景：原文案只说“主改为 X”，无法说明同主花色反主时主未变，也没有明确级牌是否变化。

实现：

- 首亮：`你 亮主 ♥2 单张，主从无主改为 ♥，级牌 2 不变`。
- 反主改主：`机器人4 反主！♦2 一对 压过 ♠2 单张，主从 ♠ 改为 ♦，级牌 2 不变`。
- 同花色更强反主：`主仍是 ♠，级牌 2 不变`。
- 王对无主：`主从 ♥ 改为无主，级牌 2 不变`。
- `AnnouncementBanner` 增加 `role="status"` / `aria-live="polite"`，并让 counter/phase 事件清掉过期 bid 队列。

### 3. Persistent contract summary

背景：banner 是瞬时反馈，bidding 结束后玩家仍需要知道本局契约。

实现：

- 新增 `apps/web/src/lib/contract.ts` 和 `ContractSummary.tsx`。
- bidding 阶段显示当前叫主/反主状态；burying/playing/scoring 仍显示本局契约。
- 有反主历史时持久展示“谁反主、反了什么、压过谁、当前主、级牌、庄家”。
- 无人亮主路径显示“无人亮主、本局无主、级牌、庄家”。

### 4. Waiting and turn feedback

背景：底部操作区原来只显示“等待其他玩家…”，新玩家无法快速知道卡在哪个动作。

实现：

- 新增 `apps/web/src/lib/waiting.ts`。
- ActionBar 等待文案命名行动者：`等待 机器人4 埋底…`、`等待 机器人2 出牌…`。
- 收墩驻留时显示：`机器人4 收墩，下一墩即将开始…`。

### 5. Trick identity and final winner

背景：出牌区只摆牌，玩家需要靠空间推断谁出了哪组牌；scoring 阶段最终一墩赢家会丢失。

实现：

- TrickArea 每个非空牌组直接标注出牌者，领出者标注“领出”。
- `RoomStateView.lastTrickWinnerSeat` 持久投影最后一墩赢家。
- GameTable settled display 优先使用 `lastTrickWinnerSeat`，scoring 阶段也能显示最终收墩者。

### 6. Responsive and portrait adjustments

背景：桌面/移动横屏容易因固定定位导致遮挡；portrait mask 影响 lobby。

实现：

- portrait mask 只在牌桌阶段显示，lobby/waiting room 竖屏可用。
- 增加 compact landscape 样式，缩小状态栏、契约条、牌面、按钮和座位徽章。
- 公告 banner 使用独立公告槽，占用稳定高度；提高背景不透明度、缩小 banner 内牌面，避免遮挡契约摘要和顶部座位。

### 7. Final review fixes

背景：最终代码评审发现两处 Important 风险：同一帧出现 `counter + phase` 时仍可能先展示过时反主 banner；公告绝对定位会压住常驻契约摘要。

实现：

- 新增 `apps/web/src/lib/announcementQueue.ts`，将 phase 事件设为同批最高优先级，丢弃同批及队列中的未展示 bid/counter，并打断当前 bid/counter。
- `AnnouncementBanner` 改为使用固定高度 `announcement-lane`，公告作为常规 flex 子项展示，不再绝对定位覆盖 contract summary。
- 新增 `announcementQueue.test.ts` 覆盖 phase/counter supersession。
- 新增 `trickArea.test.tsx` 用 React server render 验证 scoring/final settled trick 的赢家文案和 winner 标记可见。

### 8. Settled trick winner stability

背景：真实试玩发现每墩结束后会重复回放上一墩，并可能显示错误收墩者。根因是 server projection 用 `round.turnSeat` 临时推导 `lastTrickWinnerSeat`；刚结墩时 `turnSeat` 等于赢家，但下一墩开始后 `turnSeat` 会推进到下一个行动者，而 `lastTrick` 仍保留上一墩，导致“上一墩牌面 + 当前行动者当赢家”的错位，并触发前端重复驻留展示。

实现：

- `RoundState` 新增持久字段 `lastTrickWinnerSeat: number | null`。
- `createRound` 初始化为 `null`；每次第 4 家落牌结算时在 `applyPlay` 中写入真实 winner。
- `apps/server/src/app.ts` 直接投影 `round.lastTrickWinnerSeat`，不再从 `turnSeat` 推导。
- 新增 round 层测试，验证下一墩开始后 `turnSeat` 推进但 `lastTrickWinnerSeat` 仍保持上一墩赢家。
- 新增 server projection 测试，验证 `lastTrick` 未变而 `turnSeat` 变化时，客户端看到的上一墩赢家不漂移。
