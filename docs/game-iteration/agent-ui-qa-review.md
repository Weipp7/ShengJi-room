# UI Interaction and Browser QA Review

Scope: source and test review only. No browser suite is currently configured; `apps/web/test/announcements.test.ts` is the only web test.

## UI gaps

1. **P0: portrait blocker also blocks the lobby and waiting room.** `App.tsx` always renders `.portrait-mask`, while the portrait media query makes it a full-screen `z-index:999` overlay. A phone user cannot create or join a room in portrait, even though only the table needs landscape. Keep lobby/room usable in portrait, and make the landscape requirement a table-only state with a visible, accessible explanation.
2. **P0: card selection is mouse-only.** `CardFace.tsx` uses clickable `div`s for cards without button semantics, keyboard support, focus state, or an accessible name. This prevents keyboard and assistive-technology play, and selected state is not announced. Use a native button or add role, `tabIndex`, key handling, `aria-pressed`, and a card label.
3. **P1: announcements are visually transient but not announced.** `AnnouncementBanner.tsx` has no `role="status"`/`aria-live`; screen-reader users miss bids, counters, dealer assignment, and play start. The 2.4-3.5 second FIFO queue can also make a phase announcement arrive after the UI has already advanced. Add polite live delivery, a fixed visual status region, and an explicit queue policy for stale messages.
4. **P1: the 3-second settled-trick hold gives no remaining-time or next-turn feedback.** `GameTable.tsx` disables play during the hold and `ActionBar.tsx` only says "看牌中…". The player sees the winner but not when control will return; on a short turn this feels like a frozen game. Show a countdown/progress cue and the next actor, allow the hold to end on an intentional user action, and verify the final-trick path reaches the result modal promptly.
5. **P1: responsive layout risks overlap and clipping at supported landscape sizes.** The table is fixed to `100vh` with non-wrapping announcement text, absolute seat badges, `trick-area: inset: 44px 110px`, and a 260px fixed chat drawer. At 667x375 / 844x390, the banner can collide with the top seat, the drawer removes table space, and card rows can overflow without a compact mode. The 340px-min-width result dialog is also tight on narrow phones. Define compact-landscape breakpoints and test with chat open, long names, pairs/tractors, and result cards.
6. **P1: color/motion signals have no nonvisual or reduced-motion fallback.** Active-turn state relies heavily on a green glow and blinking text; team membership relies on blue/red borders. Add an explicit current-turn label/icon, visible keyboard focus styles, and `prefers-reduced-motion` handling for announcement entry, card lift, hover lift, and thinking blink.
7. **P2: waiting and error states are not durable or actionable.** Socket errors disappear after three seconds, the connection indicator is a title-only dot, and waiting copy does not identify the acting player. Use a named connection status (`role=status`), retain action errors until acknowledged or superseded, and name the player/dealer being awaited.
8. **P2: controls lack test and accessibility hooks.** There are no stable `data-testid` values, and visual control state is inferred from Chinese text/classes. Prefer accessible names and roles for browser assertions; add stable test IDs only for repeated cards, seat positions, and timing-sensitive regions.

## Proposed browser test matrix

| Flow | Desktop 1440x900 | Landscape mobile 844x390 | Assertions |
| --- | --- | --- | --- |
| Lobby / room creation | Required | Required in portrait too | nickname validation, connection state, room code, focus order, no overlay blocks lobby |
| Seat / waiting state | Required | Required | host and bot controls, disabled start reason, offline indication, long nickname containment |
| Bid and counter-bid | Required, 2 clients | Required | all clients receive one announcement; actor, card, and trump change visible; current bid stays visible after banner expires |
| No-bid fallback | Required | Required | explicit no-trump/dealer message and burying action handoff |
| Burying | Required | Required | 0/8 to 8/8 selection, confirm enables only at 8, keyboard card selection and selection announcement |
| Trick / settled hold | Required, 2 clients | Required | four plays render in correct seats, winner label/outline, controls locked only during hold, next turn resumes at expected time |
| Scoring / next round | Required | Required | modal readable and scrollable, focus contained, dismiss/next controls, no final-hold delay regression |
| Chat and reconnect | Required | Required | drawer does not cover active controls, received messages scroll, disconnect/reconnect status is announced and state recovers |
| Accessibility regression | Required | Required | axe scan, tab traversal, visible focus, button/card names, live-region events, reduced-motion screenshot |

Automation recommendation: add Playwright with a test-only server seed or Socket.IO fixture that can deterministically emit `RoomStateView` sequences. Run two isolated browser contexts for cross-client broadcast checks. Use fake timers only for component tests; browser tests should assert the 3-second hold using tolerant bounds (for example, 2.7-3.5 seconds) and avoid fixed sleeps except the checkpoint captures.

## Screenshot checkpoints

1. `01-lobby-portrait-390x844.png`: lobby remains operable in portrait; no game-only blocker.
2. `02-room-landscape-844x390.png`: four seats, bot/host controls, long nickname containment.
3. `03-bid-all-clients-desktop.png`: first reveal banner plus persistent bid status and active-seat cue in both contexts.
4. `04-counter-bid-mobile-chat-open.png`: counter banner, changed trump, no collision with top seat or chat drawer.
5. `05-no-bid-fallback.png`: explicit no-trump/dealer transition.
6. `06-bury-8-selected.png`: selected cards, 8/8 count, enabled confirmation, visible focus.
7. `07-trick-settled.png`: four-card trick, winner label, locked action state and progress/next-turn cue.
8. `08-scoring-narrow-landscape.png`: complete readable result modal, bottom cards and actions unobscured.
9. `09-reduced-motion-focus.png`: active turn and keyboard focus remain legible with animations reduced.

Capture each at 1440x900 and 844x390 unless the filename specifies another viewport. Archive screenshots with DOM assertions for event text, active-seat identity, button enabled state, and overflow checks (`documentElement.scrollWidth <= innerWidth` where scrolling is not intentional).
