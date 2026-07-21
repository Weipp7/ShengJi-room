# 牌局体验系统迭代 — 总体计划

设计文档：`docs/superpowers/specs/2026-07-21-bid-announcements-design.md`
分支策略：直接在 `main` 上小步提交（dev 服务与浏览器验证依赖本工作区，worktree 会切断 vite/tsx watch 链路；每个任务独立 commit，回滚粒度等价）。

## 任务拆分

| # | 任务 | 产出 | 验收 |
| --- | --- | --- | --- |
| T1 | `deriveAnnouncements` 纯函数（TDD） | `apps/web/src/lib/announcements.ts` + 单测 | 首亮/反主/无人亮主/定庄/开打/无事件 全分支通过 |
| T2 | 公告 Banner + 常驻叫主状态卡 | `AnnouncementBanner.tsx`、TrickArea bidding 中央卡、styles | 浏览器可见「谁亮/反了什么」 |
| T3 | SeatRing 行动座位高亮 | SeatRing.tsx + styles | bidding/playing 都能看出轮到谁 |
| T4 | 浏览器完整牌局体验 + 截图 | /tmp 截图 + test-report 记录 | 验收标准 1–4 逐条截图/DOM 取证 |
| T5 | 多角色对抗评审（3× CodeReview 并行）+ 逐条核实 | review-notes.md | Critical 清零（或核实驳回有据） |
| T6 | 文档沉淀 + 回归 + 提交 | docs/game-iteration/ 五份文档 | 全量测试绿、tsc 绿 |

## 风险点

- 公告队列与 3s 收墩驻留同屏竞争注意力 → banner 放牌桌顶部、驻留在中央，视觉分区。
- prev-view 对比在 React StrictMode 双调用下重复入队 → 推导放 useEffect + ref 存 prev，用 bid 内容做幂等 key。
- 快速连续事件（亮主后 1s 内反主）→ 队列串行展示，不丢事件。

## 验收标准（来自 spec）

1. 亮主/反主公告：操作者 + 类型 + 牌面 + 主变化，所有客户端可见。
2. bidding 阶段常驻可见当前叫主归属与牌面。
3. 无人亮主有明确公告。
4. 座位环可看出当前行动者。
5. 全量测试 + tsc 通过；浏览器实测证据落 `docs/game-iteration/test-report.md`。
