# ITER-008 Reconnect Offline Resilience

## 功能名称

重连、旁观、多标签与离线状态恢复验证。

## 优先级

P2。

## 当前状态

Backlog。

## 背景

客户端使用 `localStorage` 保存 `playerId` 和 `roomCode`，断线后在 `store.tsx` 中自动 `room:join`。服务端通过 per-player room 广播，已有 stale duplicate connection 测试，但缺少完整浏览器重连、旁观、离线、房间销毁后的体验验证。

## 需要解决的问题

- 重连时 transient banner 不重播，必须依赖持久 state 解释当前局面。
- 多标签同一 playerId 连接/断开可能影响 connected 标记。
- 旁观者看到的 UI 与入座玩家不同，需明确不能操作。
- 房间被销毁或服务重启时，客户端本地 `roomCode` 需要清理并给出解释。

## 用户可感知收益

刷新、断网、开多标签、旁观时不丢失关键牌局理解，也不会误以为自己能操作。

## 涉及模块 / 文件

- `apps/web/src/store.tsx`
- `apps/web/src/socket.ts`
- `apps/web/src/pages/Lobby.tsx`
- `apps/web/src/pages/Room.tsx`
- `apps/web/src/pages/GameTable.tsx`
- `apps/server/src/app.ts`
- `apps/server/src/rooms.ts`
- `apps/server/test/socket.test.ts`
- E2E 多 context tests。

## 实现思路

1. 先用 E2E 建立 reconnect checkpoints：bidding after counter、burying、playing、scoring。
2. 验证重连后 ContractSummary/StatusBar/ActionBar 足够解释当前状态。
3. 增加旁观者明确状态：可看不可操作。
4. 改善 disconnected/connecting/connected 文案，不只用 title dot。
5. 验证 room-ended 和 room-not-found 清理本地 room code。

## 验收标准

- 重连后不会重播历史 banner，但持久状态解释当前契约、庄家、主、当前行动者。
- 多标签关闭旧连接不导致新连接离线。
- 旁观者不显示可执行动作。
- 房间不存在时回到 lobby 并显示可理解提示。

## 测试方式

- `pnpm vitest run apps/server/test/socket.test.ts`
- E2E 多 context：刷新、断线模拟、旁观加入、房间销毁。
- `pnpm test && pnpm typecheck`

## 风险和回滚方式

- 风险：自动重连策略可能打扰用户主动离开。
- 风险：旁观 UI 改动可能影响 seated 玩家 ActionBar。
- 回滚：恢复 store reconnect 和 room reset 逻辑；保留 server duplicate tests。

## 依赖

ITER-002。

## 执行记录

未开始。
