# 回滚说明

## 关键改动点

- 状态扩展：
  - `packages/game/src/round.ts`: `bidHistory`
  - `packages/shared/src/state.ts`: `RoomStateView.bidHistory`、`lastTrickWinnerSeat`
  - `apps/server/src/app.ts`: 状态投影
- UI/文案：
  - `apps/web/src/lib/announcements.ts`
  - `apps/web/src/lib/announcementQueue.ts`
  - `apps/web/src/lib/contract.ts`
  - `apps/web/src/lib/waiting.ts`
  - `apps/web/src/components/ContractSummary.tsx`
  - `AnnouncementBanner`、`ActionBar`、`TrickArea`、`GameTable`
  - `apps/web/src/styles.css`
- 测试：
  - `apps/web/test/announcements.test.ts`
  - `apps/web/test/announcementQueue.test.ts`
  - `apps/web/test/contract.test.ts`
  - `apps/web/test/trickArea.test.tsx`
  - `apps/web/test/waiting.test.ts`
  - `apps/server/test/socket.test.ts`
  - `packages/game/test/round.test.ts`

## 分层回滚

1. 只回滚视觉样式：还原 `apps/web/src/styles.css` 中 contract summary、announcement、compact landscape、trick label 样式。
2. 只回滚持久契约 UI：移除 `ContractSummary.tsx`、`contract.ts`、GameTable 引用和 `contract.test.ts`。
3. 只回滚 bid history：移除 `bidHistory` 类型/round/app 投影，恢复 announcements/contract 的 currentBid-only 逻辑，同时移除相关测试。
4. 只回滚最后一墩赢家：移除 `lastTrickWinnerSeat` 类型/投影和 GameTable 使用点。
5. 完整回滚：回滚本分支相对 `main` 的所有提交。

## 风险说明

- `bidHistory` 是新增只读字段，不改变规则结果；旧客户端忽略即可。
- `lastTrickWinnerSeat` 是新增只读字段，修复 scoring 阶段最终收墩者不可见，并防止下一墩开始后上一墩赢家随 `turnSeat` 漂移。
- `AnnouncementBanner` 的 supersession 策略会少展示旧 bid banner，但 persistent contract 和 bid history 保留最终可解释状态。
- 如果需要严格保留完整事件时间线，建议下一步将 `bidHistory` 渲染成可展开历史，而不是恢复 FIFO banner。

## 回滚后必须验证

- `pnpm test`
- `pnpm typecheck`
- 至少手动验证一局：亮主/反主、埋底、出牌、结算。
