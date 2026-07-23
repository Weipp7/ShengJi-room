# ITER-018 Bot Strategy Samples

更新时间：2026-07-22

## 目的

本文件把 `shengji.org` 可见机器人行为和本项目固定 bot 策略样本放在同一个证据池里。外站样本只记录页面可见事实，不推断其服务端内部策略；本项目样本用单元测试锁定可解释输出。

## 外站可见样本

### 2026-07-22 重采样：4 人快速开始

入口：

- 页面：`https://shengji.org/`
- 操作：点击 `快速开始 4人`

可见事实：

- 单击后直接进入房间，没有手动 `开始游戏` 步骤。
- 顶部信息常驻展示：`花色`、`级牌`、`亮牌`、`闲家`、`A队/B队`、`庄`。
- 样本局中机器人 C 亮 `♥2`，页面显示当前主花色 `♥`、级牌 `2`、庄家 `机器人 C`。
- 样本进入 `出牌中` 后，机器人领出 9 张大牌型，真人位置显示 `需要选9张牌`。
- 点击 `💡 提示` 后页面从 `0/9` 变为 `9/9`，按钮从 `需要选9张牌` 变为 `出牌(9)`，并提供 `取消选择`。

边界：

- 本次 in-app browser 全页/视口截图调用超时，但 DOM 快照和按钮状态采样成功。
- 既有截图证据仍保留在 `docs/iteration/artifacts/ITER-018/` 下，例如 `shengji-org-hint-state.png` 和 `shengji-org-quick-start-6p-after-wait.png`。
- 该样本说明外站机器人会主动领出多张组合；本项目当前仍把“bot 主动甩牌”列为后续独立小闭环，不混入本次解释接口改动。

## 本项目固定样本

覆盖文件：`packages/bot/test/bot.test.ts`

### 亮主 / 反主解释样本

| 场景 | 输入特征 | 期望输出 |
| --- | --- | --- |
| 强开局亮主 | 手牌同时有短黑桃级牌和大王对 | `cardIds = joker-big-0,joker-big-1`；`reason = open-strongest` |
| 低质量不亮 | 只有单张黑桃级牌且黑桃长度不足 5 | `cardIds = null`；`reason = pass-low-confidence` |
| 保护当前合约 | 自己或队友已有级牌对，自己只有同张数小王对可反 | `cardIds = null`；`reason = pass-protect-current-contract` |
| 反主 | 对手单小王，自己有单大王 | `cardIds = joker-big-0`；`reason = counter-stronger` |
| 无更强候选 | 当前合约已是大王对，手牌没有可压过候选 | `cardIds = null`；`reason = pass-no-legal-bid` |

实现接口：

- `explainBid(view)`：返回 `cardIds`、`reason`、`legalCandidateCount`、`eligibleCandidateCount`。其中候选计数来自 `availableBids()` 生成的每类最高张数候选，不枚举所有可组合排列。
- `decideBid(view)`：保持原 API，复用 `explainBid(view).cardIds`。

### 已有埋牌 / 出牌解释样本

- `explainBury` 已覆盖弱庄不强断、强庄安全断门、关键主控不埋、候选层不生成不安全断门奖励。
- `explainPlay` 已覆盖最小可赢抢分、断门杀分、队友送分、省控制牌、跟随 `throw-pairs`。
- 领牌固定样本已覆盖：
  - 有安全散单时先出散单并保留拖拉机，`reason = lead-preserve-shape-single`。
  - 没有安全散单时主动领拖拉机，`reason = lead-tractor`。
  - 没有安全散单和拖拉机时主动领强对子，`reason = lead-strong-pair`。
  - 自己手牌已成对持有所有更高主牌对子时主动甩牌，`reason = lead-safe-throw-pairs`。
  - 副牌多对子无法仅凭自己手牌证明安全时不主动甩牌。
  - 主花色级牌对 + 小王对 + 大王对是普通拖拉机，`reason = lead-tractor`，不能误判为甩牌。
  - 仅小王对 + 大王对不足以构成甩牌，保持普通拖拉机路径。

## 下一样本池候选

- 主动甩牌策略扩展：当前只启用可证明安全的 `throw-pairs`；概率性甩牌需要继续建立不偷看对手手牌的风险模型。
- 9 张或更大多张跟牌：当前 4 人两副牌模型无法自然复现外站 9 张样本；必须先评估外站 6 人/多副牌规则，不直接搬到 4 人规则。
