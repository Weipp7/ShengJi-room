# 测试与验证报告

## Baseline

时间：2026-07-22 10:05  
工作区：`/Users/weipanyue/shengji/.worktrees/codex-game-iteration-visibility`

| 命令 | 结果 |
| --- | --- |
| `pnpm install` | 成功，lockfile 未变化 |
| `pnpm test` | 16 个测试文件、124 个测试全部通过 |
| `pnpm typecheck` | 成功，退出码 0 |

## Red / Green 记录

| 场景 | Red 结果 | Green 结果 |
| --- | --- | --- |
| 公告主变化文案 | `announcements.test.ts` 4 个断言失败：缺少“主从 X 改为 Y / 主仍是 X / 级牌不变” | 新文案通过 |
| Contract summary | `contract.test.ts` 初始失败：`../src/lib/contract` 不存在 | 新增 `describeContract` 和组件后通过 |
| Waiting copy | `waiting.test.ts` 初始失败：`../src/lib/waiting` 不存在 | 新增 `describeWaiting` 并接入 ActionBar 后通过 |
| Final trick winner | `socket.test.ts` 失败：`lastTrickWinnerSeat` 为 `undefined` | 服务端投影后通过 |
| Bid history | `round.test.ts` / `announcements.test.ts` / `contract.test.ts` 失败：无 `bidHistory`、coalesced counter 丢失、contract 无法持久显示反主 | 新增 durable `bidHistory` 后通过 |
| Final review: counter + phase coalescing | 代码评审指出 `AnnouncementBanner` 同批 `counter + phase` 仍会排 counter | 新增 `announcementQueue.test.ts`，phase supersession 通过 |
| Final review: final trick winner UI | 代码评审指出缺少 UI 可见性测试 | 新增 `trickArea.test.tsx`，server render 验证赢家文案和 winner class 通过 |
| Settled trick winner drift | `socket.test.ts` 新增回归测试失败：上一墩真实赢家 seat 1，下一墩已轮到 seat 2 时 projection 返回 2 | `RoundState.lastTrickWinnerSeat` 持久化后通过 |

## 最终自动化验证

时间：2026-07-22 13:02

| 命令 | 结果 |
| --- | --- |
| `pnpm test` | 20 个测试文件、145 个测试全部通过 |
| `pnpm typecheck` | 成功，退出码 0 |
| `pnpm build` | 成功；web 和 server 均完成生产构建 |

## 浏览器验证

运行方式：

- Server：`PORT=3101 pnpm --filter @shengji/server dev`
- Web：`VITE_SERVER_URL=http://localhost:3101 pnpm --filter @shengji/web exec vite --host 127.0.0.1 --port 5174`
- Browser URL：`http://127.0.0.1:5174/`
- 视口：1440x900、1280x720、844x390、390x844

关键路径：

1. 1440x900 打开 lobby，创建“快速机器人局”。
2. 开始游戏，真人可操作 bidding。
3. 真人点击可用亮主按钮，截图验证 banner：`05-real-bid-announcement-desktop.png`。
4. bot 反主，截图验证 banner 和 persistent summary：`19-counter-banner-compact-final.png`。
5. 真人过，进入 burying，截图验证 contract 持久保留、等待文案命名庄家：`07-after-pass-transition-desktop.png`。
6. bot 埋底后进入 playing，截图验证契约、当前 turn、领出标签：`08-playing-start-desktop.png`。
7. 真人通过 UI 跟一对，截图验证四家出牌均有操作者标签、收墩等待有边界文案：`09-two-labelled-plays-desktop.png`。
8. DOM autoplayer 继续整局，最终到 scoring，截图验证最终状态和下一局按钮：`11-scoring-desktop.png`。
9. 1280x720 / 844x390 scoring 视口截图，DOM 验证 `scrollWidth === innerWidth`：`12-scoring-1280x720.png`、`13-scoring-844x390.png`。
10. `http://localhost:5174/` fresh origin 390x844 portrait lobby，验证 mask 不出现、lobby 可用、`scrollWidth === 390`：`14-lobby-portrait-390x844.png`。
11. 最终评审修复后，1280x720 phase banner 截图并断言 announcement 与 contract / top seat / action bar 不重叠：`21-final-phase-announcement-lane-1280x720.png`。
12. 最终评审修复后，844x390 重新开局，bot 亮主 banner 截图并断言 announcement 与 contract / top seat / action bar 不重叠，且 `scrollWidth === innerWidth`：`22-final-announcement-lane-844x390.png`。

截图目录：`docs/game-iteration/screenshots/`

## 浏览器 DOM 断言摘录

- Real bid：`你 亮主 ♥2 单张，主从无主改为 ♥，级牌 2 不变`。
- Real counter：`机器人4 反主！♦2 一对 压过 ♠2 单张，主从 ♠ 改为 ♦，级牌 2 不变`。
- Persistent counter：`机器人4 反主 ♦2 一对（压过 你 ♠2 单张），主 ♦，级牌 2，庄家 机器人4`。
- Burying wait：`等待 机器人4 埋底…`。
- Playing trick labels：`你`、`机器人2`、`机器人3`、`机器人4 领出`。
- Settle wait：`机器人4 收墩，下一墩即将开始…`。
- Scoring：status 包含 `结算`，ActionBar 包含 `下一局`。
- Final layout 1280x720：`机器人2 坐庄，底牌归庄，埋底中…`；`overlapsContract=false`、`overlapsTopSeat=false`、`overlapsActionBar=false`。
- Final layout 844x390：`机器人2 亮主 ♥2 单张，主从无主改为 ♥，级牌 2 不变`；`overlapsContract=false`、`overlapsTopSeat=false`、`overlapsActionBar=false`、`scrollWidth=844`。
- Settled trick drift：Socket 状态流连续观察 3 个 completed tricks、6 次同一 `lastTrick` 后续状态，`lastTrickWinnerSeat` 未漂移。
- Browser spectator sampling：真实 UI 中第一墩稳定显示 `机器人2 收下这一墩`，消失后进入下一墩；下一墩结束显示 `机器人3 收下这一墩`，未重复把上一墩改成当前行动者。

## 已知测试限制

- 浏览器中的多客户端同步只通过单浏览器主客户端观察；多真实浏览器上下文同步仍建议后续加入 Playwright 项目级 E2E。
- 浏览器 DOM autoplayer 是验证脚本，不纳入仓库；完整自动 E2E 需要测试 seed / fixture 支持。
