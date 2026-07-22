# Final Code Review

## Strengths

- `bidHistory` is recorded by the authoritative round state and projected through the shared room view, which gives reconnecting clients a durable basis for explaining the winning bid rather than relying solely on transient UI events. See `packages/game/src/round.ts:107-115`, `packages/shared/src/state.ts:29-39`, and `apps/server/src/app.ts:45-53`.
- Announcement copy now identifies the actor, distinguishes `亮主` from `反主`, includes the exposed cards, and describes both suit and stable level effects. The history-aware derivation also handles skipped intermediate snapshots. See `apps/web/src/lib/announcements.ts:47-88` and `apps/web/test/announcements.test.ts:117-136`.
- The final-trick winner is preserved in the server projection during scoring, and the settled-trick display consumes the explicit field before falling back to `turnSeat`. See `apps/server/src/app.ts:51-53` and `apps/web/src/pages/GameTable.tsx:66-79`.
- Named waiting copy and per-slot trick operator labels address the primary gameplay comprehension gaps. See `apps/web/src/lib/waiting.ts:10-17`, `apps/web/src/components/ActionBar.tsx:95-117`, and `apps/web/src/components/TrickArea.tsx:28-45`.

## Critical

None.

## Important

1. **A coalesced snapshot that includes both counter-bid history and the bidding-to-burying transition still queues the counter before the phase event.** `deriveAnnouncements` emits the newly discovered bid/counter events and then the dealer phase event for exactly this state change (`apps/web/src/lib/announcements.ts:82-107`). `AnnouncementBanner` detects `hasPhase`, but only removes old queued events; when the same `fresh` list also has a counter, it re-adds that counter with `fresh.filter((a) => a.kind !== 'bid')` (`apps/web/src/components/AnnouncementBanner.tsx:28-37`). The result is a 3.5-second obsolete `反主` banner during burying before the dealer/"埋底中" transition appears. This violates the documented requirement to clear unshown bid/counter events on phase entry and can leave the player with a stale narrative. Make a phase event supersede all fresh and queued bid/counter events, and add a component test that feeds `counter + phase` in one update and asserts the phase is shown first.

2. **The transient banner obscures the durable contract summary at the moment it is most needed.** `ContractSummary` is a normal flex child directly below the status bar (`apps/web/src/pages/GameTable.tsx:95-100`), while `.announcement` is absolutely positioned at `top: 48px` with `z-index: 30` (`apps/web/src/styles.css:906-923`). This puts the banner directly on top of the approximately 48px-high contract strip (`apps/web/src/styles.css:435-445`). The supplied desktop screenshot `docs/game-iteration/screenshots/05-real-bid-announcement-desktop.png` visibly shows the contract text/cards behind the bid banner; the compact counter screenshot shows the same collision. It defeats the intended simultaneous persistent reference and is a responsive regression. Reserve vertical space below the contract strip (or render the announcement within a non-overlapping table region) and add a browser assertion for non-overlapping bounding boxes.

## Minor

1. **No rendered test covers final-trick winner visibility.** The server test only verifies the projected number (`apps/server/test/socket.test.ts:196-241`); it does not prove that `GameTable` passes it to `TrickArea`, that the winner outline/caption appears in scoring, or that the result modal still opens after the hold (`apps/web/src/pages/GameTable.tsx:70-80`, `apps/web/src/components/TrickArea.tsx:48-50`). The task specifically calls for the final winner projection to be player-visible.

2. **The responsive evidence does not test the new overlap-prone states with long text or an open chat panel.** The compact CSS adjusts table dimensions (`apps/web/src/styles.css:1034-1141`), but there is no automated browser test in the repository and the documented path only records overflow checks. This leaves no regression guard for the phase banner/contract collision above, long nicknames, multi-card plays, or the fixed chat drawer.

3. `git diff --check` reports trailing whitespace in `docs/game-iteration/plan.md:3-4`.

## Recommendations

1. Change the banner supersession policy so any fresh phase event drops all bid/counter entries, including entries from the same batch, and preempts a currently displayed bid/counter.
2. Move the banner below the contract summary or reserve a dedicated announcement lane; verify its rectangle does not intersect the contract, active player badges, or action bar at 1440x900, 1280x720, and 844x390.
3. Add a focused `AnnouncementBanner` component test for `counter + phase` coalescing, plus a GameTable/TrickArea render test for the scoring final-trick winner.
4. Add browser automation for long nicknames, multi-card trick labels, and open chat at the supported compact landscape viewport.

## Assessment

The state-model and copy improvements substantially address the requested visibility features, and the durable history/final-winner projection is directionally sound. The two important UI/event-order defects mean the current diff does not yet reliably provide a current, simultaneously visible contract and phase narrative under the snapshot-coalescing and responsive cases it explicitly targets. I would address those before merge. Tests/build were reported as passing in the task context; this review inspected them but did not rerun them, per the read-only review request.
