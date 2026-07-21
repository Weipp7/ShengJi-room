# 叫主/反主可感知公告与牌局体验迭代 — 设计

日期：2026-07-21
状态：已批准（用户长期授权自主迭代）

## 背景

用户反馈：亮主/反主发生时，界面上看不出是谁、亮了什么、主是否变化——信息只存在于内部状态（`RoomStateView.currentBid`）与 StatusBar 的最终结果里，玩家无法感知过程。同时要求围绕完整牌局做一次系统性体验迭代。

## 现状结论（代码勘查）

- `currentBid: Bid | null`（seat / kind / suit / cards）已随每次 `S2C.RoomState` 广播到所有客户端 → 前端可自行推导事件，无需协议改动。
- 无人亮主时 `finishBidding` 回退 `plannedDealerSeat` 坐庄、打无主，UI 无任何表达。
- SeatRing 不高亮当前行动座位；阶段切换只有 ActionBar 文字跳变。
- 机器人节奏：普通动作 600–1200ms，收墩后领出 +3s（上轮已实现）。

## 方案选型

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| A. 客户端事件推导 + 公告系统 | GameTable 保存 prev view，对比推导事件，队列化 banner；bidding 中央常驻叫主状态卡 | ✅ 选定：零协议改动，重连后常驻卡仍正确 |
| B. 服务端 game:event 事件流 | 新增 S2C 事件与重放机制 | ❌ 协议扩展成本高，数据已有，YAGNI |
| C. 仅增强 StatusBar | 文字提示 | ❌ 不满足「玩家可感知」 |

## 设计

### 1. 事件推导（`apps/web/src/lib/announcements.ts`，纯函数可测）

`deriveAnnouncements(prev: RoomStateView | null, next: RoomStateView): Announcement[]`

| 触发条件 | 公告内容 |
| --- | --- |
| currentBid: null → bid | 「{昵称} 亮主 {♠2 单张/一对 \| 王对无主}」 |
| currentBid: bidA → bidB（不同） | 「{昵称} 反主！{描述}，主改为 {♠/无主}」 |
| phase: bidding → burying 且 currentBid ≠ null | 「{庄家} 坐庄，底牌归庄，埋底中…」 |
| phase: bidding → burying 且 currentBid = null | 「无人亮主，本局打无主，{庄家} 坐庄」 |
| phase: burying → playing | 「埋底完成，{庄家} 先出牌」 |

Announcement = `{ id, text, kind: 'bid' | 'counter' | 'phase' }`。反主(`counter`)视觉上更醒目（红金配色）。

### 2. 公告展示（`AnnouncementBanner` 组件）

- 位置：牌桌中央上方（trick-area 顶部悬浮），不遮手牌与操作栏。
- 队列：一次一条，每条 2.8s，先进先出；反主类 3.5s。
- 附带亮出的牌面缩略图（`CardFace small`）。

### 3. 常驻叫主状态卡（bidding 阶段，TrickArea 中央）

- 有叫主：「当前叫主：{昵称}」+ 亮出牌面 + 主花色符号；所有玩家可见。
- 无叫主：「还没有人亮主」。
- 兼顾重连场景（banner 错过也能看到当前状态）。

### 4. 行动座位高亮（SeatRing）

- bidding 用 `biddingTurn`、playing 用 `turnSeat`，对应座位徽章加发光边框 + 「思考中…」小字。

### 5. 范围外（记录不做）

- 服务端事件流 / 事件历史面板；
- 亮主音效动画；
- 移动端全面适配（仅验证不塌）。

## 测试

- 单测：`deriveAnnouncements` 全分支（首亮/反主/无人亮主/定庄/开打/无事件）。
- 既有 114 测试回归。
- 浏览器 E2E：完整牌局（叫主→反主观察→埋底→出牌→结算），截图取证。

## 验收标准

1. 任一玩家亮主/反主，所有客户端出现公告：操作者昵称 + 类型 + 牌面 + 主变化。
2. bidding 阶段任何时刻可看到当前叫主归属与牌面。
3. 无人亮主场景有明确公告。
4. 座位环能看出轮到谁。
5. 全量测试通过，浏览器实测有截图证据。
