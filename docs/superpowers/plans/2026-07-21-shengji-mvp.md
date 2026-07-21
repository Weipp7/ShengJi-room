# 升级 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个可本地运行、可部署的 4 人两副牌升级在线游戏（房间码邀请 + 机器人补位 + 完整一局规则闭环）。

**Architecture:** pnpm monorepo：`packages/shared`（类型/常量/事件）→ `packages/game`（纯规则引擎，小状态转换函数）→ `packages/bot`（规则型机器人）→ `apps/server`（Express + Socket.IO 唯一裁判）→ `apps/web`（React/Vite 展示与输入）。后端权威，前端只提交意图。

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest, Express, Socket.IO, React 18, Vite, socket.io-client, Docker。

## Global Constraints

- 规格文档：`docs/superpowers/specs/2026-07-21-shengji-mvp-design.md`，规则以其为准，外加下述用户确认项。
- 4 人、两副牌（108 张，含大小王各 2）；**每人发 25 张，底牌 8 张**（庄家拿底后手牌 33 张，埋回 8 张）。
- **扣底倍数 = 2^(最后一墩每人出牌张数)**：单张 ×2、对子 ×4、两连对拖拉机 ×16。
- **级牌从 2 开始，打过 A 后循环回 2**；每队各自维护级牌，本局级牌 = 庄家队级牌。
- 亮牌强度：单张同花色级牌 < 一对同花色级牌 < 一对小王(无主) < 一对大王(无主)。不支持单王无主。
- 计分表（闲家分 → 结果）：0→庄升3；5-35→庄升2；40-75→庄升1；80-115→换庄不升；120-155→闲升1；160-195→闲升2；≥200→闲升3。命名常量 `ROUND_SCORE_TABLE` 放在 `packages/game`。
- 分牌：5=5 分、10=10 分、K=10 分，全场共 200 分。
- 队伍：座位 0/2 一队（team 0），1/3 一队（team 1）。
- 不做：甩牌、6 人、账号、排行榜、旁观、悔牌、持久化、横向扩展。
- 庄家轮转：庄家队守庄成功 → 下一局庄家 = (dealer+2)%4；闲家上台 → 下一局庄家 = (dealer+1)%4。
- 无人亮主：第一局座位 0 为庄家、本局无主（trumpSuit=null）；后续局沿用计划庄家、无主。
- MVP 简化（记录为文档偏差）：发牌一次性完成，叫主为发牌后的回合制阶段——按座位顺序轮流「亮/反主 或 过」，自最后一次亮牌起连续 4 人过（或首轮全过）即结束。
- 所有包 TypeScript strict 模式；`packages/game` 不依赖 React/Socket.IO；随机数通过可注入 rng 保证测试确定性。
- 环境变量：`PORT`、`PUBLIC_URL`、`CORS_ORIGIN`、`ROOM_TTL_MINUTES`。
- 提交规范：conventional commits（feat/test/chore），每个任务至少一次提交。

---

### Task 1: Monorepo 脚手架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.npmrc`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `packages/game/package.json`, `packages/game/tsconfig.json`, `packages/game/src/index.ts`
- Create: `packages/bot/package.json`, `packages/bot/tsconfig.json`, `packages/bot/src/index.ts`
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/index.ts`
- Create: `vitest.workspace.ts`

**Interfaces:**
- Produces: 包名 `@shengji/shared`、`@shengji/game`、`@shengji/bot`、`@shengji/server`、`@shengji/web`；根脚本 `pnpm dev`、`pnpm test`、`pnpm build`。

- [ ] **Step 1: 根配置**

`package.json`：
```json
{
  "name": "shengji",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter @shengji/server --filter @shengji/web dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "typecheck": "pnpm -r exec tsc --noEmit"
  },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
```

`pnpm-workspace.yaml`：
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "declaration": true, "sourceMap": true
  }
}
```

`.gitignore`：`node_modules/`、`dist/`、`.DS_Store`、`*.local`。

- [ ] **Step 2: 三个 packages 子包骨架**

每个 `packages/*/package.json` 形如（以 shared 为例，game/bot 同构，game 依赖 shared，bot 依赖 shared+game）：
```json
{
  "name": "@shengji/shared",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "build": "tsc -p tsconfig.json" }
}
```
子包 `tsconfig.json` extends `../../tsconfig.base.json`，`outDir: "dist"`, `rootDir: "src"`。
`src/index.ts` 暂时 `export {};`。
workspace 依赖用 `"@shengji/shared": "workspace:*"`。

- [ ] **Step 3: 验证**

Run: `pnpm install && pnpm typecheck`
Expected: 全部通过，无错误。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm monorepo with shared/game/bot packages"
```

---

### Task 2: shared — 牌型类型、常量、Socket 事件契约

**Files:**
- Create: `packages/shared/src/cards.ts`, `packages/shared/src/constants.ts`, `packages/shared/src/events.ts`, `packages/shared/src/state.ts`
- Modify: `packages/shared/src/index.ts`（re-export 全部）

**Interfaces:**
- Produces（后续所有任务依赖，签名必须一致）：

```ts
// cards.ts
export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J 12=Q 13=K 14=A
export type Card =
  | { id: string; kind: 'suit'; suit: Suit; rank: Rank }
  | { id: string; kind: 'joker'; joker: 'small' | 'big' };
export type TrumpContext = { trumpSuit: Suit | null; level: Rank };
export type EffectiveSuit = Suit | 'trump';
export type ComboType = 'single' | 'pair' | 'tractor';
export type Combo = { type: ComboType; cards: Card[]; suit: EffectiveSuit; strength: number };
export type BidKind = 'suit-single' | 'suit-pair' | 'small-joker-pair' | 'big-joker-pair';
export type Bid = { seat: number; kind: BidKind; suit: Suit | null; cards: Card[] };
```

```ts
// constants.ts
export const SEAT_COUNT = 4;
export const HAND_SIZE = 25;
export const KITTY_SIZE = 8;
export const DECK_COUNT = 2;
export const TOTAL_POINTS = 200;
export const teamOfSeat = (seat: number): 0 | 1 => (seat % 2) as 0 | 1;
export const nextLevel = (level: Rank, delta: number): Rank; // 2..14 循环，14(A) 之后回 2
```

```ts
// state.ts —— 服务端广播给客户端的按玩家定制状态
export type Phase = 'waiting' | 'bidding' | 'burying' | 'playing' | 'scoring';
export type SeatView = {
  seat: number; nickname: string | null; isBot: boolean;
  connected: boolean; isHost: boolean; handCount: number;
};
export type TrickPlayView = { seat: number; cards: Card[] };
export type RoomStateView = {
  roomCode: string; phase: Phase; seats: SeatView[]; hostSeat: number | null;
  yourSeat: number | null; yourHand: Card[];       // 只含本人手牌
  trump: TrumpContext | null; dealerSeat: number | null;
  currentBid: Bid | null; biddingTurn: number | null;
  turnSeat: number | null; currentTrick: TrickPlayView[]; lastTrick: TrickPlayView[];
  defenderPoints: number; teamLevels: [Rank, Rank];
  roundResult: RoundResultView | null;
};
export type RoundResultView = {
  defenderPoints: number; kittyCards: Card[]; kittyBonus: number;
  winnerTeam: 0 | 1; levelDelta: number; nextDealerSeat: number; nextLevels: [Rank, Rank];
};
```

```ts
// events.ts —— 事件名常量 + 载荷类型（与规格一致）
export const C2S = {
  RoomCreate: 'room:create', RoomJoin: 'room:join', RoomList: 'room:list',
  SeatTake: 'seat:take', SeatLeave: 'seat:leave',
  BotAdd: 'bot:add', BotRemove: 'bot:remove',
  GameStart: 'game:start', BidReveal: 'bid:reveal', BidPass: 'bid:pass',
  KittyBury: 'kitty:bury', TrickPlay: 'trick:play', RoundNext: 'round:next',
  ChatSend: 'chat:send', RoomLeave: 'room:leave', RoomEnd: 'room:end',
} as const;
export const S2C = {
  RoomState: 'room:state', GameError: 'game:error',
  ChatMessage: 'chat:message', ConnectionStatus: 'connection:status',
} as const;
// 载荷：RoomJoinPayload { roomCode; nickname; password?; playerId }
// BidRevealPayload { cardIds: string[] } / KittyBuryPayload { cardIds: string[] }
// TrickPlayPayload { cardIds: string[] } / ChatSendPayload { text: string }
// GameErrorPayload { code: string; message: string }
```

- [ ] **Step 1: 写失败测试** `packages/shared/test/constants.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { nextLevel, teamOfSeat } from '../src/constants';
describe('nextLevel', () => {
  it('normal up', () => expect(nextLevel(2, 1)).toBe(3));
  it('skip over', () => expect(nextLevel(13, 3)).toBe(3)); // K+3 → A(14)→2→3
  it('A wraps to 2', () => expect(nextLevel(14, 1)).toBe(2));
  it('zero delta', () => expect(nextLevel(5, 0)).toBe(5));
});
describe('teamOfSeat', () => {
  it('0/2 team0, 1/3 team1', () => {
    expect(teamOfSeat(0)).toBe(0); expect(teamOfSeat(2)).toBe(0);
    expect(teamOfSeat(1)).toBe(1); expect(teamOfSeat(3)).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — Run: `pnpm vitest run packages/shared` Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**（nextLevel 核心）

```ts
const LEVEL_SEQ: Rank[] = [2,3,4,5,6,7,8,9,10,11,12,13,14];
export const nextLevel = (level: Rank, delta: number): Rank => {
  const i = LEVEL_SEQ.indexOf(level);
  return LEVEL_SEQ[(i + delta) % LEVEL_SEQ.length];
};
```
其余按 Interfaces 块原样落地，`index.ts` re-export。

- [ ] **Step 4: 跑测试通过** — Run: `pnpm vitest run packages/shared` Expected: PASS。

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(shared): card types, constants, socket event contract"`

---

### Task 3: game — 牌堆、发牌、分牌计分

**Files:**
- Create: `packages/game/src/deck.ts`, `packages/game/src/points.ts`
- Test: `packages/game/test/deck.test.ts`, `packages/game/test/points.test.ts`

**Interfaces:**
- Produces:
```ts
export function buildDeck(): Card[];                       // 108 张，id 形如 'S-5-0'/'joker-big-1'
export type Rng = () => number;                            // [0,1)
export function shuffle<T>(items: T[], rng: Rng): T[];     // Fisher–Yates，纯函数返回新数组
export function deal(deck: Card[]): { hands: Card[][]; kitty: Card[] }; // 4×25 + 8
export function cardPoints(card: Card): number;            // 5→5, 10/K→10, 其他 0
export function countPoints(cards: Card[]): number;
```

- [ ] **Step 1: 写失败测试**

```ts
// deck.test.ts
it('deck has 108 cards, 4 jokers, unique ids', () => {
  const deck = buildDeck();
  expect(deck).toHaveLength(108);
  expect(deck.filter(c => c.kind === 'joker')).toHaveLength(4);
  expect(new Set(deck.map(c => c.id)).size).toBe(108);
});
it('every suit-rank appears exactly twice', () => {
  const deck = buildDeck();
  const key = (c: Card) => c.kind === 'suit' ? `${c.suit}${c.rank}` : c.joker;
  const counts = new Map<string, number>();
  for (const c of deck) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
  expect([...counts.values()].every(n => n === 2)).toBe(true);
});
it('deal: 4 hands of 25 and kitty of 8, no overlap', () => {
  const { hands, kitty } = deal(buildDeck());
  expect(hands.map(h => h.length)).toEqual([25, 25, 25, 25]);
  expect(kitty).toHaveLength(8);
});
it('shuffle is deterministic with seeded rng and keeps all cards', () => {
  const rng = mulberry32(42); // 测试内定义的种子 rng
  const a = shuffle(buildDeck(), mulberry32(42));
  const b = shuffle(buildDeck(), mulberry32(42));
  expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  expect(new Set(a.map(c => c.id)).size).toBe(108);
});
// points.test.ts
it('total deck points = 200', () => expect(countPoints(buildDeck())).toBe(200));
it('5/10/K values', () => { /* 分别断言 5,10,10,0(A),0(joker) */ });
```
测试文件顶部内联 `mulberry32` 种子 rng：
```ts
const mulberry32 = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
```

- [ ] **Step 2: 确认失败** — `pnpm vitest run packages/game` → FAIL。
- [ ] **Step 3: 实现** buildDeck 双层循环（deckIndex 0/1 × 花色×13 + 两王）；deal 顺序切片。
- [ ] **Step 4: 通过** — `pnpm vitest run packages/game` → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): deck build, shuffle, deal, point counting"`

---

### Task 4: game — 主牌判断、有效花色、牌力排序

**Files:**
- Create: `packages/game/src/trump.ts`
- Test: `packages/game/test/trump.test.ts`

**Interfaces:**
- Produces:
```ts
export function isTrump(card: Card, trump: TrumpContext): boolean;
export function effectiveSuit(card: Card, trump: TrumpContext): EffectiveSuit;
// 同一有效花色内的牌力序数，越大越强；跨花色不可比（由 trick.ts 处理）
// 主牌序（高→低）：大王 > 小王 > 主花色级牌 > 副花色级牌(彼此同级) > 主花色 A..2(去掉级牌)
// 副牌序：A..2 去掉级牌
export function cardStrength(card: Card, trump: TrumpContext): number;
export function sortHand(cards: Card[], trump: TrumpContext): Card[]; // 展示排序：主牌区在前，其余按花色分组
```
- 关键设计：两张副花色级牌 `cardStrength` 返回相同值（后出压不过先出）。

- [ ] **Step 1: 失败测试**（无主局 trumpSuit=null 也要覆盖）

```ts
const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
const c = (suit: Suit, rank: Rank): Card => ({ id: `${suit}-${rank}-0`, kind: 'suit', suit, rank });
const bigJ: Card = { id: 'joker-big-0', kind: 'joker', joker: 'big' };
const smallJ: Card = { id: 'joker-small-0', kind: 'joker', joker: 'small' };

it('jokers, level cards and trump suit are trump', () => {
  expect(isTrump(bigJ, trump)).toBe(true);
  expect(isTrump(c('S', 2), trump)).toBe(true);   // 副花色级牌
  expect(isTrump(c('H', 7), trump)).toBe(true);   // 主花色
  expect(isTrump(c('S', 7), trump)).toBe(false);
});
it('effectiveSuit maps trump group to "trump"', () => {
  expect(effectiveSuit(c('S', 2), trump)).toBe('trump');
  expect(effectiveSuit(c('S', 7), trump)).toBe('S');
});
it('trump strength order', () => {
  const order = [bigJ, smallJ, c('H', 2), c('S', 2), c('H', 14), c('H', 3)];
  for (let i = 0; i < order.length - 1; i++)
    expect(cardStrength(order[i], trump)).toBeGreaterThanOrEqual(cardStrength(order[i + 1], trump));
  // 两张不同副花色级牌等价
  expect(cardStrength(c('S', 2), trump)).toBe(cardStrength(c('D', 2), trump));
  // 主花色级牌严格高于副花色级牌
  expect(cardStrength(c('H', 2), trump)).toBeGreaterThan(cardStrength(c('S', 2), trump));
});
it('no-trump round: only jokers and level cards are trump', () => {
  const nt: TrumpContext = { trumpSuit: null, level: 5 };
  expect(isTrump(c('S', 5), nt)).toBe(true);
  expect(isTrump(c('S', 14), nt)).toBe(false);
  // 无主局所有级牌等价
  expect(cardStrength(c('S', 5), nt)).toBe(cardStrength(c('H', 5), nt));
});
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现** — cardStrength 建议数值区间：副牌 rank 原值(2..14，级牌被移出该花色)；主牌 100+序数（主花色2..A→100..112 跳过级牌、副级牌 120、主级牌 121、小王 130、大王 131）。sortHand 按 (有效花色分组, cardStrength desc) 排序，主牌组排最前，花色组按 S,H,C,D 固定顺序。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): trump detection, effective suit, card strength ordering"`

---

### Task 5: game — 牌型识别（单张/对子/拖拉机）

**Files:**
- Create: `packages/game/src/combo.ts`
- Test: `packages/game/test/combo.test.ts`

**Interfaces:**
- Produces:
```ts
// 识别一手出牌是否为合法牌型；非法返回 null
export function detectCombo(cards: Card[], trump: TrumpContext): Combo | null;
// 辅助：同牌面判断（两张 suit+rank 相同，或同级王）
export function isSameFace(a: Card, b: Card): boolean;
// 在给定牌集合(hand 的某有效花色子集)中枚举所有对子/定长拖拉机，供跟牌校验与机器人使用
export function findPairs(cards: Card[], trump: TrumpContext): Card[][];
export function findTractors(cards: Card[], trump: TrumpContext, pairLen: number): Card[][];
```
- 拖拉机定义：同一有效花色内、`cardStrength` 相邻的 ≥2 个对子（副花色级牌对不与主花色 A 相邻——用 strength 序自然实现：副级牌 120 与主 A 112 不相邻，需在实现中按“同有效花色内 strength 去重后的排名相邻”判断，即把该花色实际存在的强度档排序后索引相邻）。
- **拖拉机相邻判定采用“强度档位表”**：对每个有效花色预生成完整档位序列（如 trump: [...100..112,120,121,130,131]），对子强度在档位表中索引差 1 才算相邻。这样主 A 对 + 副级牌对 **不是** 拖拉机（档位 112 与 120 在表中相邻→注意：要把 120 档从拖拉机链中排除，因为副级牌跨花色成对但不同花色的两对不可连。简化规则：**副花色级牌对不参与拖拉机**，档位表中跳过 120）。

- [ ] **Step 1: 失败测试**

```ts
const trump: TrumpContext = { trumpSuit: 'H', level: 2 };
// 工具：c(suit,rank,copy) 生成指定副本的牌
it('single & pair', () => {
  expect(detectCombo([c('S',5,0)], trump)?.type).toBe('single');
  expect(detectCombo([c('S',5,0), c('S',5,1)], trump)?.type).toBe('pair');
  expect(detectCombo([c('S',5,0), c('D',5,0)], trump)).toBeNull(); // 不同花色非对
});
it('tractor of two adjacent pairs', () => {
  const combo = detectCombo([c('S',5,0),c('S',5,1),c('S',6,0),c('S',6,1)], trump);
  expect(combo?.type).toBe('tractor');
});
it('level gap makes pairs adjacent', () => {
  // 级牌 2 被抽走后 S 花色 3 与 4 相邻正常；测 A 与 K：
  const t5: TrumpContext = { trumpSuit: 'H', level: 4 };
  // S3+S3 + S5+S5 在 level=4 时相邻（4 被抽走）
  expect(detectCombo([c('S',3,0),c('S',3,1),c('S',5,0),c('S',5,1)], t5)?.type).toBe('tractor');
});
it('non-adjacent pairs are not tractor', () => {
  expect(detectCombo([c('S',5,0),c('S',5,1),c('S',8,0),c('S',8,1)], trump)).toBeNull();
});
it('jokers: big pair + small pair form trump tractor', () => {
  const cards = [bigJ0, bigJ1, smallJ0, smallJ1];
  expect(detectCombo(cards, trump)?.type).toBe('tractor');
});
it('off-suit level pair does NOT chain into tractor', () => {
  // 主花色 A 对 + 副花色级牌对 → null
  expect(detectCombo([c('H',14,0),c('H',14,1),c('S',2,0),c('S',2,1)], trump)).toBeNull();
});
it('mixed suits rejected', () => {
  expect(detectCombo([c('S',5,0),c('D',6,0)], trump)).toBeNull();
});
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现** — detectCombo：全部牌同有效花色 → 按张数分支；strength 取牌型内最大 cardStrength。findTractors 用档位表滑窗。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): combo detection for single/pair/tractor"`

---

### Task 6: game — 跟牌合法性校验

**Files:**
- Create: `packages/game/src/follow.ts`
- Test: `packages/game/test/follow.test.ts`

**Interfaces:**
- Produces:
```ts
export type PlayCheck = { ok: true; combo: Combo | null } | { ok: false; code: string };
// 领牌校验：cards 必须构成合法牌型
export function validateLead(cards: Card[], hand: Card[], trump: TrumpContext): PlayCheck;
// 跟牌校验：张数一致 + 跟花色 + 尽量跟牌型（对子/拖拉机强制）
export function validateFollow(lead: Combo, cards: Card[], hand: Card[], trump: TrumpContext): PlayCheck;
```
- 错误码：`'cards-not-in-hand' | 'invalid-combo' | 'wrong-count' | 'must-follow-suit' | 'must-play-pair' | 'must-play-tractor'`。
- 规则细节：
  - 手牌中该有效花色张数 ≥ 领牌张数 → 出牌必须全部来自该花色；不足 → 该花色现有牌必须全出，剩余任意垫。
  - 领对子且该花色内存在对子 → 出牌中必须包含至少一个该花色对子（能凑几对凑几对，MVP 校验“包含对子数 = min(手上该花色对子数, 领牌对子数)”）。
  - 领拖拉机且该花色内存在同长度拖拉机 → 必须出之；否则退化为对子强制，再退化为任意同花色牌。

- [ ] **Step 1: 失败测试**（核心场景各一条断言）

```ts
// 场景：lead = S 对5；hand 含 S6,S6,S9 → 必须出 S6 对
it('must play pair when holding one', () => {
  const lead = detectCombo([c('S',5,0),c('S',5,1)], trump)!;
  const hand = [c('S',6,0),c('S',6,1),c('S',9,0),c('D',3,0)];
  expect(validateFollow(lead, [c('S',6,0),c('S',9,0)], hand, trump))
    .toMatchObject({ ok: false, code: 'must-play-pair' });
  expect(validateFollow(lead, [c('S',6,0),c('S',6,1)], hand, trump).ok).toBe(true);
});
it('void in suit: may discard anything of same count', () => {
  const lead = detectCombo([c('S',5,0)], trump)!;
  const hand = [c('D',3,0), c('H',4,0)];
  expect(validateFollow(lead, [c('D',3,0)], hand, trump).ok).toBe(true);
});
it('partial suit: must exhaust suit first', () => {
  const lead = detectCombo([c('S',5,0),c('S',5,1)], trump)!;
  const hand = [c('S',9,0), c('D',3,0), c('D',4,0)];
  expect(validateFollow(lead, [c('D',3,0),c('D',4,0)], hand, trump))
    .toMatchObject({ ok: false, code: 'must-follow-suit' });
  expect(validateFollow(lead, [c('S',9,0),c('D',3,0)], hand, trump).ok).toBe(true);
});
it('tractor lead forces same-length tractor', () => { /* 同上模式 */ });
it('wrong count rejected', () => { /* 1 张跟对子 → wrong-count */ });
it('cards not in hand rejected', () => { /* → cards-not-in-hand */ });
it('lead must be a valid combo', () => {
  expect(validateLead([c('S',5,0),c('D',6,0)], hand, trump)).toMatchObject({ ok: false, code: 'invalid-combo' });
});
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现** — 按上述规则细节逐条实现；跟牌构成合法整体牌型时 `combo` 返回识别结果（用于比大小），否则 `combo: null`（杂牌垫牌不参与争墩）。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): follow validation with forced suit/pair/tractor rules"`

---

### Task 7: game — 每墩胜负

**Files:**
- Create: `packages/game/src/trick.ts`
- Test: `packages/game/test/trick.test.ts`

**Interfaces:**
- Produces:
```ts
export type TrickPlay = { seat: number; cards: Card[]; combo: Combo | null };
// plays[0] 为领牌（combo 必非 null）；返回赢家 seat
export function trickWinner(plays: TrickPlay[], trump: TrumpContext): number;
```
- 判定：只有「与领牌同型且（同有效花色 或 全主）」的 combo 参与比较；主吃副；同为主/同花色比 strength；strength 相等先出者胜（副级牌对拼）。

- [ ] **Step 1: 失败测试**

```ts
it('highest same-suit single wins', () => { /* S5 lead, S9 wins */ });
it('trump beats off-suit', () => { /* S5 lead, H3(trump) 压过 SA */ });
it('discard (null combo) never wins', () => { /* 垫牌不参赛 */ });
it('pair lead: single-card-pair-broken follow cannot win', () => { /* 跟两张散牌 combo=null */ });
it('tractor trump-over: trump tractor beats lead tractor', () => { /* 全主同长度拖拉机 */ });
it('equal strength: earlier play wins', () => { /* 两家各出一张不同副花色级牌（无主局），先出者赢 */ });
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现** — 逐家比较持有“当前最强”指针；用 `combo.strength` + effectiveSuit 判定。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): trick winner resolution"`

---

### Task 8: game — 叫主强度比较

**Files:**
- Create: `packages/game/src/bidding.ts`
- Test: `packages/game/test/bidding.test.ts`

**Interfaces:**
- Produces:
```ts
// 从玩家提交的 cardIds 对应牌组识别亮牌类型；非法返回 null
export function detectBid(cards: Card[], level: Rank, seat: number): Bid | null;
export function bidBeats(candidate: Bid, current: Bid | null): boolean;
export function trumpSuitOfBid(bid: Bid): Suit | null; // 王对 → null（无主）
```
- 强度序：`suit-single(1) < suit-pair(2) < small-joker-pair(3) < big-joker-pair(4)`；同强度不可反（包括不能用另一花色单张级牌反单张级牌）。

- [ ] **Step 1: 失败测试**

```ts
it('single level card is a valid bid', () => { /* [S2] level=2 → suit-single, suit S */ });
it('pair of level cards beats single', () => { /* bidBeats */ });
it('joker pairs beat suit pairs; big beats small', () => {});
it('single joker is not a bid', () => { /* detectBid → null */ });
it('non-level card is not a bid', () => {});
it('same-strength different suit cannot overcall', () => {});
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): bid detection and overcall comparison"`

---

### Task 9: game — 本局结算（扣底 + 升级表 + 下局庄家/级牌）

**Files:**
- Create: `packages/game/src/scoring.ts`
- Test: `packages/game/test/scoring.test.ts`

**Interfaces:**
- Produces:
```ts
export const ROUND_SCORE_TABLE: ReadonlyArray<{ min: number; max: number; winnerTeam: 'dealer' | 'defender'; levelDelta: number }>;
// = [ {0,0,dealer,3}, {5,35,dealer,2}, {40,75,dealer,1}, {80,115,defender,0},
//     {120,155,defender,1}, {160,195,defender,2}, {200,Inf,defender,3} ]
export function kittyBonus(kitty: Card[], lastTrickCardsPerPlayer: number, lastTrickWonByDefender: boolean): number;
// = lastTrickWonByDefender ? countPoints(kitty) * 2 ** lastTrickCardsPerPlayer : 0
export type RoundInput = {
  dealerSeat: number; defenderTrickPoints: number; kitty: Card[];
  lastTrickWinnerSeat: number; lastTrickCardsPerPlayer: number;
  teamLevels: [Rank, Rank];
};
export function settleRound(input: RoundInput): RoundResultView;
```
- settleRound：defenderPoints = defenderTrickPoints + kittyBonus；查表得 winnerTeam/levelDelta；升级作用于获胜队 `nextLevel`；下局庄家按 Global Constraints 轮转规则。

- [ ] **Step 1: 失败测试**

```ts
it.each([
  [0, 'dealer', 3], [5, 'dealer', 2], [35, 'dealer', 2], [40, 'dealer', 1],
  [75, 'dealer', 1], [80, 'defender', 0], [115, 'defender', 0],
  [120, 'defender', 1], [200, 'defender', 3], [235, 'defender', 3],
])('defender %i pts → %s +%i', (pts, winner, delta) => { /* 查表断言 */ });
it('kitty bonus doubles by 2^cards', () => {
  const kitty = [c('S',5,0), c('S',10,0)]; // 15 分
  expect(kittyBonus(kitty, 1, true)).toBe(30);
  expect(kittyBonus(kitty, 2, true)).toBe(60);
  expect(kittyBonus(kitty, 4, true)).toBe(240); // 两连对拖拉机
  expect(kittyBonus(kitty, 2, false)).toBe(0);
});
it('dealer holds → next dealer is partner; defenders win → next seat', () => {
  // dealerSeat=0，庄胜 → next=2；闲胜 → next=1
});
it('level wraps past A', () => { /* teamLevels [14,2] 庄升1 → [2,2] */ });
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): round settlement with kitty bonus and score table"`

---

### Task 10: game — 一局状态机（RoundState + 小转换函数）

**Files:**
- Create: `packages/game/src/round.ts`
- Modify: `packages/game/src/index.ts`（re-export 全部公开 API）
- Test: `packages/game/test/round.test.ts`

**Interfaces:**
- Produces:
```ts
export type RoundPhase = 'bidding' | 'burying' | 'playing' | 'scoring';
export type RoundState = {
  phase: RoundPhase; level: Rank; teamLevels: [Rank, Rank];
  dealerSeat: number;              // bidding 期间为“计划庄家”，亮主可改变
  plannedDealerSeat: number;       // 无人亮主时的兜底庄家
  trump: TrumpContext;             // trumpSuit 随亮主更新
  hands: Card[][]; kitty: Card[];
  currentBid: Bid | null; biddingTurn: number; passStreak: number;
  turnSeat: number; currentTrick: TrickPlay[]; lastTrick: TrickPlay[];
  defenderTrickPoints: number; tricksPlayed: number;
  result: RoundResultView | null;
};
export type RoundError = { code: string; message: string };
export type StepResult = { ok: true; state: RoundState } | { ok: false; error: RoundError };

export function createRound(opts: { plannedDealerSeat: number; teamLevels: [Rank, Rank]; rng: Rng }): RoundState;
export function applyReveal(s: RoundState, seat: number, cardIds: string[]): StepResult;
export function applyPass(s: RoundState, seat: number): StepResult;      // 4 连过或全过 → 进入 burying/playing
export function applyBury(s: RoundState, seat: number, cardIds: string[]): StepResult; // 必须恰 8 张、来自手牌
export function applyPlay(s: RoundState, seat: number, cardIds: string[]): StepResult;
```
- 状态转换要点：
  - createRound：洗牌发牌，phase='bidding'，biddingTurn=plannedDealerSeat。
  - applyReveal：detectBid + bidBeats 校验；成功 → currentBid 更新、dealerSeat=seat、trumpSuit 更新、passStreak=0、biddingTurn 移到下家。
  - applyPass：passStreak+1；若 (currentBid && passStreak>=3 非庄家全过) 或 (无 bid && passStreak>=4) → 结束叫主：无 bid 时 dealerSeat=plannedDealerSeat、trumpSuit=null。庄家手牌并入 kitty 8 张 → phase='burying'。
  - applyBury：校验 8 张且在庄家手中；扣下后 phase='playing'，turnSeat=dealerSeat。
  - applyPlay：领牌 validateLead / 跟牌 validateFollow；第 4 家落牌后 trickWinner 结算，闲家赢则累加 countPoints；tricksPlayed==25 时调 settleRound（含扣底）→ phase='scoring'。
  - 全部为纯函数，返回新 state（浅拷贝+替换字段即可）。

- [ ] **Step 1: 失败测试**（用 seeded rng 全流程集成测试）

```ts
it('full round with scripted actions reaches scoring', () => {
  let s = createRound({ plannedDealerSeat: 0, teamLevels: [2, 2], rng: mulberry32(7) });
  // 全员 pass → 无主局，庄=0，进入 burying
  for (const seat of [0, 1, 2, 3]) s = expectOk(applyPass(s, seat));
  expect(s.phase).toBe('burying');
  expect(s.hands[0]).toHaveLength(33);
  // 庄家埋 8 张（取手牌前 8 张即可——合法性只要求在手牌中）
  s = expectOk(applyBury(s, 0, s.hands[0].slice(0, 8).map(c => c.id)));
  expect(s.phase).toBe('playing');
  // 循环：每次当前 turnSeat 出手牌第一张合法单张（借助 validateLead/Follow 暴力找一张合法牌）
  while (s.phase === 'playing') s = expectOk(applyPlay(s, s.turnSeat, [pickAnyLegalSingle(s)]));
  expect(s.phase).toBe('scoring');
  expect(s.result).not.toBeNull();
  expect(s.result!.defenderPoints).toBeGreaterThanOrEqual(0);
});
it('reveal makes revealer the dealer and sets trump', () => { /* 构造手牌后 applyReveal */ });
it('wrong turn / wrong phase / bad bury count rejected', () => { /* 三个错误码断言 */ });
it('all cards conserved: hands+kitty+played = 108 at all times', () => { /* 不变量 */ });
```
`pickAnyLegalSingle` 为测试助手：遍历 turnSeat 手牌，返回第一张通过校验的牌 id。

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现**（按状态转换要点，小函数组合，避免巨型 reducer）。
- [ ] **Step 4: 通过** → PASS，且 `pnpm vitest run packages/game` 全绿。
- [ ] **Step 5: Commit** — `git commit -m "feat(game): round state machine with bidding/burying/playing/scoring"`

---

### Task 11: bot — 规则型机器人

**Files:**
- Create: `packages/bot/src/index.ts`, `packages/bot/src/bid.ts`, `packages/bot/src/bury.ts`, `packages/bot/src/play.ts`
- Test: `packages/bot/test/bot.test.ts`

**Interfaces:**
- Consumes: `@shengji/game` 全部校验函数（机器人只通过它们保证合法）。
- Produces:
```ts
export type BotBidView = { hand: Card[]; level: Rank; currentBid: Bid | null; seat: number };
export function decideBid(view: BotBidView): string[] | null;        // 亮牌 cardIds 或 null(过)
export function decideBury(hand: Card[], trump: TrumpContext): string[]; // 恰 8 张
export type BotPlayView = {
  hand: Card[]; trump: TrumpContext; leadCombo: Combo | null;
  currentTrick: TrickPlay[]; seat: number; trickPointsSoFar: number;
};
export function decidePlay(view: BotPlayView): string[];             // 必然合法
```
- 策略（按规格）：
  - decideBid：手中该花色 ≥5 张且持级牌 → 亮；有王对无主 → 亮；仅当 `bidBeats` 通过才返回。
  - decideBury：候选 = 非主牌按 (非分牌优先, 非对子成员优先, strength 低优先) 排序取 8 张；不足则从主牌低位补足（保证恰 8 张合法）。
  - decidePlay：领牌 → 出最低价值合法单张/有强对子或拖拉机时领出；跟牌 → 枚举合法候选（对子/拖拉机优先满足强制），若能赢且墩内有分则压最大，队友最大则垫分牌，对手最大则垫最小非分牌。**最终兜底**：暴力枚举手牌组合，第一个通过 validateFollow/validateLead 的即返回。

- [ ] **Step 1: 失败测试**

```ts
it('bot bid is always null or a legal overcall (1000 random hands)', () => {
  // seeded rng 生成 1000 局随机 25 张手牌，decideBid 结果非 null 时必须 detectBid+bidBeats 通过
});
it('bot bury returns exactly 8 cards from hand', () => { /* 随机 33 张手牌 ×200 */ });
it('bot play is always legal across full random rounds', () => {
  // 用 Task 10 状态机跑 20 个完整随机局（4 个机器人互打），每步 applyPlay 必须 ok
});
it('follows teammate-winning: dumps points', () => { /* 固定局面断言出分牌 */ });
it('opponent winning: avoids giving points', () => { /* 固定局面断言不出分牌 */ });
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现**。
- [ ] **Step 4: 通过** → PASS（随机局测试是引擎+机器人的联合模糊测试，必须全绿）。
- [ ] **Step 5: Commit** — `git commit -m "feat(bot): rule-based bidding, burying and playing"`

---

### Task 12: server — 房间注册表与 Socket 生命周期

**Files:**
- Create: `apps/server/src/rooms.ts`, `apps/server/src/app.ts`, `apps/server/src/index.ts`, `apps/server/src/config.ts`
- Test: `apps/server/test/rooms.test.ts`, `apps/server/test/socket.test.ts`
- Modify: `apps/server/package.json`（deps: express, socket.io; devDeps: socket.io-client, tsx; scripts: `dev: tsx watch src/index.ts`, `build: tsc`, `start: node dist/index.js`）

**Interfaces:**
- Produces:
```ts
// rooms.ts —— 纯内存注册表，不含 socket 逻辑，可单测
export type PlayerSlot = { playerId: string; nickname: string; socketId: string | null; connected: boolean };
export type Seat = { player: PlayerSlot | null; bot: { name: string } | null };
export type Room = {
  code: string; password: string | null; hostPlayerId: string;
  seats: [Seat, Seat, Seat, Seat]; phase: Phase;
  round: RoundState | null; plannedDealerSeat: number; teamLevels: [Rank, Rank];
  createdAt: number; lastActiveAt: number;
};
export class RoomManager {
  createRoom(hostPlayerId: string, nickname: string, password: string | null): Room; // code = 5 位大写字母数字，唯一
  joinRoom(code: string, playerId: string, nickname: string, password: string | null):
    { ok: true; room: Room } | { ok: false; code: 'room-not-found' | 'wrong-password' };
  takeSeat(room: Room, playerId: string, seat: number): { ok: boolean; code?: 'seat-taken' };
  leaveSeat(room: Room, playerId: string): void;
  addBot(room: Room, seat: number): { ok: boolean; code?: string };   // 仅房主经 handler 调用
  removeBot(room: Room, seat: number): void;
  findByPlayerId(playerId: string): { room: Room; seat: number } | null; // 重连绑定
  listOpenRooms(): Array<{ code: string; playerCount: number; hasPassword: boolean; phase: Phase }>;
  sweepIdle(ttlMinutes: number): void; // 定时回收
}
// app.ts
export function createApp(): { app: Express; httpServer: http.Server; io: Server };
// GET /healthz → { ok: true }；生产环境 express.static 托管 web dist
```
- Socket 处理（app.ts 内注册）：连接后客户端所有 C2S 事件都带 `playerId`；handler 统一模式 = 校验 → 调 RoomManager/round 转换函数 → 失败发 `game:error` 且不改状态，成功广播 `room:state`。
- **按玩家定制投影** `projectRoomState(room, playerId): RoomStateView` — 只放本人 `yourHand`，其他座位仅 `handCount`；scoring 阶段才放 `kittyCards`。
- 重连：`room:join` 时若 `findByPlayerId` 命中 → 更新 socketId、connected=true、重发私有状态。断线 → connected=false 并广播（不腾座位）。

- [ ] **Step 1: 失败测试**

```ts
// rooms.test.ts（纯单测）
it('create/join/password/seat/bot/reconnect lifecycle', () => { /* 逐 API 断言，含 wrong-password、seat-taken */ });
it('sweepIdle removes stale rooms', () => { /* 伪造 lastActiveAt */ });
// socket.test.ts（socket.io-client 连真实 httpServer，随机端口）
it('room:create → room:state received with yourSeat', async () => {});
it('join with wrong password → game:error', async () => {});
it('private hands: player A never receives player B cards', async () => {
  // 4 客户端满座开局，断言每个客户端 room:state.yourHand 只含自己的牌且 seats[*].handCount === 25
});
it('reconnect with same playerId restores seat and hand', async () => {});
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现**（config.ts 读环境变量给默认值：PORT=3001、ROOM_TTL_MINUTES=60、CORS_ORIGIN='*'）。
- [ ] **Step 4: 通过** → `pnpm vitest run apps/server` PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(server): room registry, socket lifecycle, per-player state projection"`

---

### Task 13: server — 对局编排与机器人调度

**Files:**
- Create: `apps/server/src/gameFlow.ts`, `apps/server/src/botRunner.ts`
- Modify: `apps/server/src/app.ts`（注册 game:start / bid:* / kitty:bury / trick:play / round:next / chat:send / room:leave / room:end）
- Test: `apps/server/test/gameFlow.test.ts`

**Interfaces:**
- Consumes: Task 10 状态机、Task 11 机器人、Task 12 RoomManager。
- Produces:
```ts
// gameFlow.ts —— 把 socket 意图接到 round 转换函数
export function startGame(room: Room): { ok: boolean; code?: 'not-full' | 'wrong-phase' };
export function handleAction(room: Room, seat: number,
  action: { type: 'reveal' | 'pass' | 'bury' | 'play'; cardIds?: string[] }): StepResult;
export function advanceToNextRound(room: Room): void; // scoring → 用 result 写回 teamLevels/plannedDealer，createRound
// botRunner.ts
export function scheduleBots(room: Room, broadcast: () => void, delayMs?: () => number): void;
// 当前行动座位是机器人时，延迟 600–1200ms 调 decideBid/decideBury/decidePlay → handleAction → broadcast → 递归调度
```
- game:start 前置：4 座全满（真人或机器人）、请求者为房主、phase='waiting'。
- 机器人叫主简化：机器人在 biddingTurn 轮到时调用 decideBid，null 则 pass。
- round:next：任意入座玩家在 scoring 阶段可触发 advanceToNextRound。
- chat:send：广播 `chat:message { seat, nickname, text, ts }`，text 截断 200 字符。

- [ ] **Step 1: 失败测试**

```ts
it('1 human + 3 bots plays a full round to scoring automatically', async () => {
  // socket 客户端建房、加 3 bot、start；bot 延迟注入为 () => 0
  // 人类玩家每次收到 room:state 时若 turnSeat === yourSeat 就用暴力找合法牌回发
  // 断言最终收到 phase === 'scoring' 且 roundResult 非空；round:next 后回到 bidding 且级牌已更新
}, 30_000);
it('wrong-turn and wrong-phase actions rejected without state change', async () => {});
it('start rejected when seats not full or requester not host', async () => {});
```

- [ ] **Step 2: 确认失败** → FAIL。
- [ ] **Step 3: 实现**（botRunner 用注入的 delayMs 便于测试，生产默认 600+Math.random()*600）。
- [ ] **Step 4: 通过** → PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(server): game orchestration and bot scheduling"`

---

### Task 14: web — Vite 工程、Socket hook、大厅与等待室

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/tsconfig.json`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/socket.ts`, `apps/web/src/store.ts`
- Create: `apps/web/src/pages/Lobby.tsx`, `apps/web/src/pages/Room.tsx`, `apps/web/src/components/SeatRing.tsx`, `apps/web/src/components/ChatPanel.tsx`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `@shengji/shared` 的 C2S/S2C 事件与 `RoomStateView`。
- Produces:
```ts
// socket.ts
export function getPlayerId(): string;   // localStorage 'shengji:playerId'，无则 crypto.randomUUID()
export function useSocket(): { socket: Socket; status: 'connecting' | 'connected' | 'disconnected' };
// store.ts —— 单一 useReducer/Context：{ view: RoomStateView | null; error: string | null; chat: ChatMsg[] }
// 收到 room:state 全量替换 view；game:error 显示 3 秒后清除
```
- 交互与视觉（规格前端章节）：
  - Vite dev 代理：`server.proxy['/socket.io'] → http://localhost:3001`（ws: true）；`VITE_SERVER_URL` 生产同源。
  - App：无 view → Lobby；有 view 且 phase='waiting' → Room（等待室）；其余 phase → GameTable（Task 15）。
  - Lobby：顶部游戏名+昵称输入（localStorage 记忆）+连接状态点；左卡片「快速机器人局」= room:create 后自动 bot:add×3；右卡片创建房间（可选密码）/房间码加入；下方 room:list 轮询 5s 列表。
  - Room 等待室：SeatRing 四座位环绕深绿桌面（CSS grid 上/右/下/左），显示昵称/机器人标签/队伍色（0/2 蓝、1/3 红）/房主星标；空位「入座」按钮；房主对空位显示「+机器人」、对机器人显示「移除」；满座后房主见「开始游戏」。
  - styles.css：深绿 `#1a5c3a` 桌面、暗色背景 `#0d2318`、白色牌面圆角卡片；竖屏 `@media (orientation: portrait)` 显示「请旋转设备」遮罩。

- [ ] **Step 1: 搭工程** — `apps/web/package.json`（deps: react, react-dom, socket.io-client；devDeps: vite, @vitejs/plugin-react, typescript）；`pnpm install`。
- [ ] **Step 2: 实现 socket.ts + store.ts + App 路由骨架**。
- [ ] **Step 3: 实现 Lobby 与 Room 等待室 + ChatPanel（chat:send / chat:message，右侧折叠面板）**。
- [ ] **Step 4: 手动验证** — Run: `pnpm dev`；浏览器两个标签页：A 创建房间 → B 用房间码加入 → 双双入座 → A 加 2 机器人 → 「开始游戏」可点击（点击后进入 GameTable 占位页即可）。刷新 A 标签页 → 自动回到原座位。
- [ ] **Step 5: Commit** — `git commit -m "feat(web): lobby, waiting room, socket store with reconnect"`

---

### Task 15: web — 对局牌桌

**Files:**
- Create: `apps/web/src/pages/GameTable.tsx`, `apps/web/src/components/HandFan.tsx`, `apps/web/src/components/CardFace.tsx`, `apps/web/src/components/TrickArea.tsx`, `apps/web/src/components/StatusBar.tsx`, `apps/web/src/components/ActionBar.tsx`, `apps/web/src/components/ResultModal.tsx`
- Create: `apps/web/src/lib/handSort.ts`（调用 `@shengji/game` 的 `sortHand` 做展示排序——仅展示，不做权威校验）

**Interfaces:**
- Consumes: `RoomStateView`（view 驱动一切渲染）、C2S 事件。
- 组件职责：
  - `CardFace`：牌面（花色符号+点数，红黑色，王用 ★/☆），selected 时上移 12px。
  - `HandFan`：底部手牌横向扇形；点击切换选中 `Set<cardId>`；受 `disabled` 控制。
  - `TrickArea`：中央十字布局显示 currentTrick 四家出牌；左上角小字显示 lastTrick。
  - `StatusBar`：房间码、阶段、级牌、主花色（♠♥♦♣/无主）、庄家昵称、闲家得分/80、当前回合玩家高亮。
  - `ActionBar`：按 phase+turn 切换主按钮 — bidding: 「亮主」(bid:reveal 选中牌)+「过」(bid:pass)；burying(庄家): 「确认埋牌」(选中 8 张才可点)；playing: 「出牌」(trick:play)；辅助按钮「清空选择」始终可用；scoring: 「下一局」(round:next)。
  - `ResultModal`：scoring 阶段弹出 — 闲家总分、底牌明细与扣底倍数、升级结果、下局庄家。
  - 四周座位区（复用 SeatRing 扩展）：昵称、队伍色、庄家 👑、剩余张数、断线灰显。
  - `game:error` 顶部红条提示 3 秒；提交后不做乐观更新，一切等 room:state。
- [ ] **Step 1: 实现 CardFace + HandFan（静态假数据渲染确认样式）**。
- [ ] **Step 2: 实现 GameTable 组装全部组件，接通事件**。
- [ ] **Step 3: 手动验证（验收核心路径）** — `pnpm dev`：1 真人+3 机器人完整打完一局：叫主/过 → （若为庄）埋 8 张 → 出单张/对子/拖拉机 → 故意出非法牌看到错误提示且状态不变 → 结算弹窗数字与规则一致 → 下一局级牌推进。对局中刷新页面 → 恢复手牌与回合。
- [ ] **Step 4: Commit** — `git commit -m "feat(web): game table with hand, trick area, bidding/bury/play controls"`

---

### Task 16: 生产构建与 Docker

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`
- Modify: `apps/server/src/app.ts`（生产 `express.static(webDist)` + SPA fallback）、`apps/web/vite.config.ts`（`build.outDir` 保持默认，server 用相对路径定位）

**Interfaces:**
- Produces：`docker build -t shengji . && docker run -p 3001:3001 shengji` 单容器起全站。

- [ ] **Step 1: Dockerfile**（多阶段：node:20-alpine + corepack enable pnpm → install → `pnpm build` → 运行层只带 server dist + web dist + 生产依赖；ENV PORT=3001）。
- [ ] **Step 2: server 静态托管** — `NODE_ENV==='production'` 时托管 `apps/web/dist`，非 `/socket.io`、`/healthz` 路径 fallback 到 index.html；CORS 用 `CORS_ORIGIN`。
- [ ] **Step 3: 验证** — Run: `pnpm build && docker build -t shengji . && docker run --rm -p 3001:3001 shengji`；浏览器 `http://localhost:3001` 完整跑通快速机器人局；`curl localhost:3001/healthz` → `{"ok":true}`。
- [ ] **Step 4: README** — 本地开发（pnpm install / pnpm dev / pnpm test）、环境变量表（PORT/PUBLIC_URL/CORS_ORIGIN/ROOM_TTL_MINUTES）、Docker 部署、第一版限制（内存房间、重启清空）。
- [ ] **Step 5: Commit** — `git commit -m "chore: production build, docker packaging and readme"`

---

## 验收清单（对照规格）

- [ ] 昵称+可选密码创建 4 人房间；房间码加入；机器人补位；满座开局。
- [ ] 叫主（含反主）、埋 8 张、出单张/对子/拖拉机；非法动作被拒且状态不变。
- [ ] 一局完整进入结算（含扣底 2^n）并推进下一局（级牌、庄家正确，过 A 回 2）。
- [ ] 刷新浏览器同 playerId 恢复原座位与手牌。
- [ ] `pnpm dev` 本地运行；Docker 单容器生产部署可用。
- [ ] 人工验收：1 真人+3 机器人一局、2 真人+2 机器人一局。
