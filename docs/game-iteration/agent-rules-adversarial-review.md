# Shengji Rules / State-Machine Adversarial Review

Scope reviewed: `packages/game`, `packages/bot`, server flow/socket tests, and web announcement tests. No code was changed.

## Root Risks

1. **[P1] Bid level is fixed to the planned dealer, even after an opposing team takes the deal.** `createRound` fixes `level` from `plannedDealerSeat` (`packages/game/src/round.ts:39`), while `applyReveal` can change `dealerSeat` (`:106-108`) without changing that level. Because `teamLevels` are independent, a cross-team counter-bid is evaluated against the outgoing dealer's rank. This is either a rules defect or an unresolved rule choice; it must be made explicit before relying on the current implementation.

2. **[P1] The UI derives durable bid/counter events from replaceable snapshots, not an ordered server event stream.** The store keeps only the newest `RoomStateView` (`apps/web/src/store.tsx:30-34`) and `GameTable` derives announcements in a render effect (`apps/web/src/pages/GameTable.tsx:35-44`). Batched React updates, reconnects, or zero-delay bots can skip intermediate reveal/counter/bury states. A skipped counter also loses the correct prior bid text. Snapshot state remains authoritative, but the audit/announcement history is not.

3. **[P1] “Last-trick winner” is lost to the final client state.** After settlement, `applyPlay` sets `turnSeat` to the winner (`packages/game/src/round.ts:171-182`), but the scoring projection exposes `turnSeat: null` (`apps/server/src/app.ts:49`). The settled display therefore receives `winnerSeat: null` for the final trick (`apps/web/src/pages/GameTable.tsx:65-74`). This makes the decisive trick and kitty multiplier unauditable in the client.

4. **[P2] Rapid duplicate commands are correctly rejected but surface as player errors.** Server actions are atomic in the single Node event loop, so a second pass/play sees the new turn and returns `wrong-turn` (`apps/server/src/app.ts:145-155`). The UI has no in-flight action lock for Pass, bid, bury, play, or next-round (`ActionBar.tsx:88-123`). Double-clicks and retransmits produce a misleading visible failure rather than idempotent/ignored duplicates.

5. **[P2] Delayed bot execution has only unit coverage for the numeric delay, not for timer/state behavior.** `scheduleBots` has a per-room pending timer and re-resolves the acting seat on fire (`apps/server/src/botRunner.ts:69-90`), but tests only assert the delay range. There is no fake-timer test for one pending action, cancellation, transition while delayed, the 3-second post-settlement hold, or “no bot action after room destruction.”

6. **[P2] Rule coverage treats the bidding model as turn-based and strength-only without testing the rule boundary.** `bidBeats` permits only strictly stronger kinds (`packages/game/src/bidding.ts:35-38`); equal-strength suit changes cannot counter. `applyReveal` also permits only the current bidding seat (`round.ts:95-105`). These may be intended house rules, but they are material Shengji variants and must be explicitly locked by integration tests, especially for card exposure and pass-streak reset.

7. **[P2] Trick legality is covered mainly at validator level, not through settlement.** `validateFollow` enforces count, effective-suit follow, and available pair/tractor obligations (`packages/game/src/follow.ts:36-78`), while `trickWinner` then compares only complete matching combos (`packages/game/src/trick.ts:7-35`). Missing end-to-end cases leave risk that a legal broken/void follow is scored incorrectly, particularly under no-trump and level-card effective-suit transitions.

## State Invariants To Lock

- Every accepted action changes exactly the permitted state fields; every rejected/duplicate action leaves the complete `RoundState` byte-for-byte equivalent.
- Bidding: `currentBid` is monotonic by configured bid strength; successful reveal resets `passStreak`; pass never changes trump/dealer; bidding ends after exactly three passes after the latest bid or four passes with no bid.
- Dealer/trump consistency: during bidding, `dealerSeat === currentBid.seat` when a bid exists; at burying/playing, `trump.trumpSuit === trumpSuitOfBid(currentBid)` (or `null` for no bid / joker pair); the rule for `level` after a cross-team takeover is specified and tested.
- Card conservation: all 108 unique IDs appear exactly once across hands, kitty, current trick, and completed-trick accounting; a failed reveal/bury/play cannot remove, duplicate, or reveal cards.
- Play: each follower supplies exactly lead-card count, all possible lead effective-suit cards, then the maximum required pair/tractor structure. A non-combo follow may never win.
- Settlement: exactly four consecutive seats occupy a trick; winner leads next; defender points change only when the defender side wins; final kitty bonus uses the final trick's per-player card count; scoring has no playable cards left.
- Async/UI: each accepted server transition has a monotonic revision/event identity; a client can reconstruct every reveal/counter and final winner even if snapshot renders are coalesced or the client reconnects.

## Exact Candidate Tests

1. **Cross-team counter level decision** (`packages/game/test/round.test.ts`): create with `teamLevels: [2, 7]`, planned dealer seat 0; give seat 1 only a 7-level pair and assert the desired result explicitly (accepted with level switch, or rejected because this implementation deliberately bids the round's initial 2). Then give seat 1 a 2-level pair and assert the opposite. This forces the missing rule decision.

2. **Bid lifecycle with counters**: scripted hands: seat 0 reveals `S2` single; seat 1 passes; seat 2 reveals `H2` pair; seats 3, 0, 1 pass. Assert after each transition: bid, dealer, trump, `passStreak`, `biddingTurn`; final state is burying with dealer 2 and a 33-card hand. Repeat with small-joker then big-joker pairs, asserting no-trump and dealer replacement.

3. **Equal/invalid/repeated bid non-mutation**: after seat 0 reveals `S2`, have seat 1 attempt `D2` single, malformed two cards, duplicate card IDs, and seat 0 repeat the original reveal after turn advances. Assert error code and deep equality to the pre-action state for each.

4. **Rapid socket command test** (`apps/server/test/gameFlow.test.ts`): emit two `bid:pass` messages synchronously from the current human seat; expect one next `room:state`, one `wrong-turn`, and exactly one increment in bidding progress. Repeat for a legal play and `round:next`.

5. **No-trump effective-suit settlement** (`packages/game/test/round.test.ts` or `trick.test.ts`): level 2/no trump; lead non-trump `S5`; follower with an off-suit level 2 must follow it as trump only when void in spades; assert it wins. Also lead a level 2 and assert every level card/joker is treated as trump for follow obligations and winner selection.

6. **Void / broken-structure end-to-end**: lead a 2-pair tractor; give a follower fewer than four lead-suit cards including all cards they hold in that suit, verify accepted play uses all of them plus discards and cannot win as a mixed `combo: null`. Then settle four plays and assert expected winner and points.

7. **Final multi-card kitty multiplier**: engineer final hands containing exactly a pair per player, defenders win the pair trick, kitty contains 5/10/K points. Assert scoring, `lastTrickCardsPerPlayer === 2`, and `kittyBonus === kittyPoints * 4`; repeat dealer win yields zero bonus.

8. **Bot scheduler with fake timers** (`apps/server/test/botRunner.test.ts`): schedule twice for a bot turn and assert one action/broadcast; advance a normal delay and assert no early action; settle a trick with a bot winner and assert no lead before 3,600 ms; call `cancelBots`/remove the room before expiry and assert no action/broadcast afterward.

9. **Announcement transition fidelity** (`apps/web/test/announcements.test.ts` plus an integration-style hook/store test): feed states for single bid -> pair counter -> joker counter -> burying in one batched update cycle. Assert all three bid events and the dealer event remain in order. Reconnect from the final snapshot and assert the persistent status still identifies bid/dealer/trump without inventing historical banners.

10. **Final winner projection** (`apps/server/test/socket.test.ts`): drive or inject a scoring state whose `lastTrick` is complete; assert the room view includes an explicit `lastTrickWinnerSeat` (new contract) and the web settled display uses it when `turnSeat` is null.

## Existing Test Gaps

The game unit tests cover individual bid ranking, combo/follow branches, and ordinary full rounds. Server flow tests prove one happy-path bot game and a small set of invalid phases. Web announcement tests prove pure two-snapshot formatting. None tests the cross-team level transition, burst/retry commands, timer cancellation/state races, snapshot coalescing, or final-trick winner visibility.
