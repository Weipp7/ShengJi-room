# Shengji game iteration: product / first-time-player review

## Scope and method

Desk review of the MVP README, the bid-announcement design and iteration plan, React game-table components/CSS, announcement and bot-pacing logic, and available unit/integration tests. This is a code-and-test review only; no browser run was performed. References below use the current worktree.

## Findings

### P1 - Announcement order can misrepresent the live bidding state

`AnnouncementBanner` displays every derived event strictly FIFO for 2.4--3.5 seconds (`apps/web/src/components/AnnouncementBanner.tsx:10-37`). Bots act after only 0.6--1.2 seconds (`apps/server/src/botRunner.ts:53-58`), so a first bid, one or more counter-bids, dealer assignment, and play start can accumulate faster than the banner can drain. The player can therefore see "A 亮主" after B has already counter-bid, or see bidding announcements during play. The central current-bid card is a useful correction (`apps/web/src/components/TrickArea.tsx:41-64`), but it disappears at the bidding-to-burying transition, leaving the stale banner as the visible narrative.

Impact: a new player cannot reliably tell what just happened or which trump/dealer is actually current at the important phase transition.

Recommendation: treat the current bid and phase as authoritative, time-sensitive state. On a newer bid, replace/supersede an unshown older bid announcement; on phase transition, clear obsolete bid/counter items and immediately show the transition announcement. Preserve an optional event history only if it is explicitly labelled as history.

### P1 - Current trick lacks direct operator identity

Cards are placed in positional slots only (`apps/web/src/components/TrickArea.tsx:28-35`). The corresponding player names are spatially separate badges (`apps/web/src/pages/GameTable.tsx:97-115`). The only direct actor label in this area is for an already-settled trick winner (`apps/web/src/components/TrickArea.tsx:38-40`), and the previous-trick panel is opt-in (`apps/web/src/components/TrickArea.tsx:65-82`).

Impact: during a live trick, especially for a first-time player or when several cards form a tractor, it is unnecessarily difficult to answer "who played these cards?" and follow the required suit/shape. This also weakens comprehension of who leads and who is winning before the trick settles.

Recommendation: put the player name (or a consistent seat label such as "right / partner") immediately adjacent to each non-empty current-trick slot. Mark the leader and current winner while a trick is in progress; retain the winner label during the three-second settle state.

### P1 - Portrait mobile is a hard-blocked game surface; compact landscape has no adaptive layout

The app renders a full-screen portrait mask at every portrait size (`apps/web/src/App.tsx:8-18`, `apps/web/src/styles.css:365-382`). In landscape, the table uses fixed side insets of 110px (`apps/web/src/styles.css:499-511`), fixed-size cards, absolute seat badges, a 92px minimum hand area (`apps/web/src/styles.css:435-487`, `651-657`), and no width/height breakpoints. The status bar wraps (`apps/web/src/styles.css:393-402`) but no remaining region reflows to protect the trick area.

Impact: phone portrait is not usable at all, while narrow landscape and small desktop windows can overlap/obscure the table, shorten the central play area, or make the banner unreadable. This conflicts with a complete first-time flow even if "mobile full adaptation" was marked out of scope in the design.

Recommendation: support portrait with a compact vertical layout, or explicitly limit the release target to desktop/tablet landscape. For the latter, define a minimum supported viewport and enforce/test it. Add responsive rules for compact landscape so the status bar, seat badges, trick slots, banner, and action bar stay non-overlapping.

### P2 - Waiting states name the phase but not the accountable player or expected progression

The global status bar identifies the active player (`apps/web/src/components/StatusBar.tsx:40-44`) and the active badge says "思考中…" (`apps/web/src/pages/GameTable.tsx:100-114`), which is a good baseline. However, the action bar uses generic copy: "等待其他玩家叫主…", "等待庄家埋底…", and "等待其他玩家出牌…" (`apps/web/src/components/ActionBar.tsx:94-117`). It does not repeat who is being waited for, whether they are a bot, or distinguish the special three-second trick review pause from ordinary waiting (`apps/web/src/components/ActionBar.tsx:108-110`).

Impact: a new player who focuses on the bottom action area may assume the game is stalled, and cannot immediately tell whether they, a named person, or an AI needs to act.

Recommendation: use action-bar text such as "等待 小明 叫主" / "机器人 2 正在埋底". During a settle hold, show the winner and a visible short countdown or progress affordance, e.g. "小明收墩，下一墩将在 3 秒后开始".

### P2 - AI pace is technically delayed but does not communicate AI intent or preserve time to understand bidding

Normal bot actions wait 600--1200ms and post-settlement leads wait 3.6--4.2s (`apps/server/src/botRunner.ts:53-89`; range tests at `apps/server/test/botRunner.test.ts:4-22`). The current active-seat animation applies the same "思考中…" label to people and bots (`apps/web/src/pages/GameTable.tsx:100-114`), and queued bid announcements amplify the pace issue described above.

Impact: the player sees activity but receives little help distinguishing a bot turn from a human decision. In bot-heavy first games, bidding can feel automatic and unexplained.

Recommendation: identify bots in the in-game seat badge, use bot-specific copy such as "机器人正在叫主", and verify that a reveal/counter-bid remains understandable before the next state transition. Do not increase all delays blindly; prioritize superseding stale announcements and an immediate, authoritative status change.

### P2 - Trump visibility is strong during bidding but loses explanatory continuity after it ends

The bidding central card shows the bidder, exposed card(s), and suit/no-trump (`apps/web/src/components/TrickArea.tsx:41-64`); the status bar continuously shows trump and level when available (`apps/web/src/components/StatusBar.tsx:24-28`). On entering burying, the central card disappears and the phase announcement lasts only 2.4 seconds (`apps/web/src/components/AnnouncementBanner.tsx:10-15`).

Impact: the player can determine trump from the header, but the relationship between the winning bid, the dealer, and the resulting trump is not persistently visible across the handoff to burying/playing.

Recommendation: after bidding, retain a compact persistent contract summary near the table: dealer, trump/no-trump, level, and the winning bid. It should not depend on an animation or banner having been seen.

### P2 - Chat can cover critical table information in constrained windows

The chat panel is fixed from 80px below the top to 80px above the bottom (`apps/web/src/styles.css:312-337`) and opens a 260px panel over the right edge. It has no game-table responsive coordination, while the right player badge and right trick slot occupy that same area (`apps/web/src/styles.css:471-475`, `499-526`).

Impact: opening chat can hide the player currently acting or cards in the right slot, precisely while a new player is learning turn order.

Recommendation: on compact widths, make chat a modal/drawer that pauses or clearly de-emphasizes play, or reserve/reflow board space. Its opened state must not obscure current turn, cards, primary action, or status.

### P3 - The bid controls are symbol-led and only expose their instructional wording on hover

The actionable bid buttons show a suit symbol or "王" with optional pair tag; their meaning is available in `title` attributes (`apps/web/src/components/ActionBar.tsx:35-65`). Touch devices do not offer hover, and first-time players do not see whether selecting a button is a single, pair, or no-trump bid without inferring from the small tag.

Impact: the interface is compact but opaque for inexperienced players, particularly on touch devices.

Recommendation: visibly label the available action (for example, "亮 ♠ 单" / "亮 ♥ 对" / "大王对 无主") while retaining the compact suit-control shape. Clearly explain a disabled control only when the user asks for it, not as a permanent tutorial block.

### P3 - Test coverage validates event text and timing ranges, not the player-facing flow

`apps/web/test/announcements.test.ts` verifies `deriveAnnouncements`, including first reveal, counters, no-trump, dealer, and phase transitions. `apps/server/test/botRunner.test.ts` checks delay ranges. There are no component, browser, or responsive tests for the banner queue, status-card persistence, active-seat visibility, trick attribution, action states, or viewport overlap. The iteration plan calls for browser evidence but no `test-report.md` is present (`docs/game-iteration/plan.md:11-25`).

Impact: the key first-time-player requirements can regress while unit tests remain green.

Recommendation: add component coverage for announcement supersession and contract summary, then add browser tests for the scenarios below with screenshots/DOM assertions at the stated viewports.

## Recommended acceptance criteria

1. Every client immediately sees the current bid owner, exposed cards, bid type, trump/no-trump, and current turn throughout bidding. A counter-bid replaces the visible current-bid narrative within one render; no obsolete bid/counter banner appears after the state advances past bidding.
2. At bidding completion, every client sees a persistent contract summary with dealer, trump/no-trump, level, and winning bid. In the no-bid path it explicitly says that no one bid and identifies the fallback dealer. The summary persists through burying and into play, or remains available with one obvious tap/click.
3. During every live trick, each shown card group is labelled with its operator. The leader, current actor, and current winner are distinguishable without relying on spatial inference alone. After a complete trick, the winner and full trick remain understandable for the review interval.
4. When the local player cannot act, the primary waiting message names the actor and action. Bot turns are visibly identified as bot turns. A trick-review hold identifies its winner and has an understandable bounded duration.
5. A new player can determine at all times: their team/partner, dealer, trump/no-trump and level, whose turn it is, what action is expected, and the current defender score. This information remains visible at the minimum supported viewport.
6. The supported viewport policy is explicit. At minimum, desktop 1280x720 and compact landscape 844x390 have no overlap between status, announcement, seat labels, cards, action controls, and chat. Portrait is either supported with a playable layout or formally excluded before room entry with a tested, accessible redirect/instruction path.
7. Announcement ordering, current-bid supersession, current-trick attribution, compact contract visibility, and responsive layout are covered by automated component/browser tests. A browser evidence report records the full game flow.

## Browser scenarios that must be tested

1. Four-client human flow: first reveal, one suit-pair counter, joker-pair no-trump counter, passes to finalization. Verify every client has the same immediate current bid and no stale announcement after burying begins.
2. No-bid flow: all four players pass. Verify the explicit no-trump/fallback-dealer message, persistent contract summary, and transition to burying.
3. Bot-heavy flow: one human plus three bots. Observe normal bidding, counter-bidding, bot bury, a complete trick, and the next lead. Verify named actor/waiting feedback and that all announcements remain temporally truthful.
4. Human-led and bot-led trick flow: play a single, pair, and tractor where legal. Verify every card group identifies its player, leader/current winner visibility, forced-follow error feedback, and the three-second settle state.
5. Reconnect while bidding after a counter-bid, while burying, and during play. Verify the persistent state fully explains contract/trump/dealer/current actor even though transient announcements are intentionally not replayed (`apps/web/src/lib/announcements.ts:34-36`).
6. Narrow desktop 1280x720 and 1024x600: test bidding controls, banner, all four player labels, right-side trick cards, action bar, hand scrolling, and open chat without obscuring playable information.
7. Compact landscape mobile 844x390 and 667x375: repeat scenarios 1 and 4 with touch interactions; assert no clipped/overlapping UI and usable targets. Test portrait 390x844 against the declared support policy.
8. Long nicknames, Chinese/Latin mixed names, offline human, and bot seats: verify labels neither collide with central cards nor hide the active player, and that ownership/turn feedback remains unambiguous.
