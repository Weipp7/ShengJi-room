# 多角色评审记录

## 输入报告

- 产品经理 / 首次玩家体验：`docs/game-iteration/agent-product-player-review.md`
- 规则专家 / 对抗评审：`docs/game-iteration/agent-rules-adversarial-review.md`
- 前端交互 / QA：`docs/game-iteration/agent-ui-qa-review.md`
- 最终代码评审：`docs/game-iteration/agent-final-code-review.md`

## 采纳情况

| 发现 | 严重度 | 决策 | 处理 |
| --- | --- | --- | --- |
| FIFO 公告可能展示过时叫主信息 | P1 | 采纳 | counter / phase 到达时清理 bid 队列并可打断当前 bid banner |
| 快照推导可能漏掉中间反主 | P1 | 采纳 | 新增 `bidHistory`，web 从 history 补齐多个事件 |
| bidding 后缺少持久契约摘要 | P1 | 采纳 | 新增 ContractSummary，贯穿 bidding/burying/playing/scoring |
| 持久 UI 无法说明 winning bid 是反主 | P1 | 采纳 | ContractSummary 用 `bidHistory` 显示“反主”和“压过谁” |
| 当前 trick 缺出牌方身份 | P1 | 采纳 | 每个非空 trick slot 标注操作者，领出者标注“领出” |
| scoring 阶段最后一墩赢家丢失 | P1 | 采纳 | 新增 `lastTrickWinnerSeat` 服务端投影 |
| 等待文案不命名行动者 | P2 | 采纳 | ActionBar 使用 `describeWaiting` 命名叫主/埋底/出牌方 |
| 移动端/窄屏可能重叠 | P1/P2 | 部分采纳 | 增加 compact landscape 样式并做 844x390 截图；完整移动专项延期 |
| portrait mask 阻塞 lobby | P0 | 采纳 | mask 只在牌桌阶段渲染；portrait lobby 截图验证 |
| CardFace 非 button / 键盘无障碍 | P0 | 延期 | 改动面大，需卡牌选择专项；本轮先补 live region 和可见反馈 |
| 跨队反主是否切换级牌不明确 | P1 | 文档化现状 | 测试锁定现有 MVP 规则：本局级牌来自 planned dealer 队伍，反主不切换级牌 |
| Bot timer fake-timer 覆盖不足 | P2 | 延期 | 本轮未改调度核心；现有 bot delay 测试保留，后续补 timer/cancel 场景 |
| 多客户端 E2E 缺失 | P3 | 延期 | 本轮用真实浏览器单客户端 + server integration；后续加 Playwright 多 context |
| 同一快照包含反主和进入埋底时，旧 counter banner 可能先显示 | Important | 采纳 | 新增 `mergeAnnouncementQueue`，phase 清理同批/队列 bid/counter 并打断当前 bid/counter；补 `announcementQueue.test.ts` |
| 公告绝对定位遮挡常驻契约摘要 | Important | 采纳 | 改为固定高度 `announcement-lane`，浏览器重新断言 announcement 与 contract 不相交 |
| final-trick winner 只有 server 投影测试，缺 UI 可见性测试 | Minor | 采纳 | 新增 `trickArea.test.tsx` 服务端渲染测试 |
| 长昵称、聊天抽屉、多客户端自动 E2E 未覆盖 | Minor | 延期 | 本轮保留浏览器手工/脚本截图证据；后续建议引入 Playwright + seeded fixture |
| 试玩发现每墩结束后上一墩重复回放且赢家显示错误 | Critical | 采纳 | 根因为 `lastTrickWinnerSeat` 从 `turnSeat` 推导导致下一墩进行时漂移；已改为 RoundState 持久字段并补 round/server/browser 状态流验证 |

## Release Reviewer 检查

- [x] 文档齐全：plan / feature-log / test-report / review-notes / rollback。
- [x] 全量 `pnpm test` 通过。
- [x] `pnpm typecheck` 通过。
- [x] `pnpm build` 通过。
- [x] 浏览器截图和交互路径已记录。
- [x] 未处理问题均有原因和后续建议。
