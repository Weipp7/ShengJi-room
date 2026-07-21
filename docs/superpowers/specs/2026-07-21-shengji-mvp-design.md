# Shengji MVP Design

Date: 2026-07-21

## Context

We are building a personal online Sheng Ji / Tractor site for playing with friends. The reference site, `https://www.shengji.org/`, is a React/Vite single page app with a dark card-table lobby, quick bot games, friend rooms, 4-player and 6-player modes, rankings, chat, spectators, replay tools, and Socket.IO real-time events. Its current Socket.IO endpoint returned Cloudflare 502 during exploration, so gameplay behavior was inferred from the shipped front-end bundle and visible UI rather than from a live game session.

This project starts from an empty local directory. The first release will be a focused, playable 4-player MVP rather than a full clone.

## Goals

- Let the owner create a room and invite friends by room code.
- Support nickname-based play without accounts.
- Support optional room passwords.
- Allow robots to fill empty seats so a game can start with fewer than four humans.
- Implement a complete 4-player two-deck Sheng Ji game using the house rule set documented below.
- Make the system runnable locally and deployable to a small cloud server.

## Non-Goals

- No account system.
- No 6-player mode.
- No ranking, leaderboard, or persistent player score.
- No spectator mode.
- No save/load replay feature.
- No undo/test-room tooling.
- No slam play / shuaipai in the first version.
- No database-backed room persistence in the first version.
- No multi-server horizontal scaling in the first version.

## Recommended Approach

Use a TypeScript full-stack monorepo.

- `apps/web`: React/Vite front end.
- `apps/server`: Node/Express + Socket.IO back end.
- `packages/game`: pure TypeScript rules engine.
- `packages/bot`: rule-based robot player.
- `packages/shared`: shared types, socket event schemas, and utilities.

The back end is the only game judge. The front end submits player intent, such as selected cards for a play, and the server validates it through `packages/game` before mutating or broadcasting state.

## Architecture

### `apps/web`

The web app owns presentation and input only:

- Lobby.
- Room waiting table.
- Game table.
- Card selection.
- Bidding controls.
- Kitty bury controls.
- Round result modal.
- Chat panel.
- Connection and error notices.

The client never computes authoritative game outcomes. It may use shared helpers for display sorting and client-side affordances, but server validation remains final.

### `apps/server`

The server owns:

- Express health endpoint and static production hosting.
- Socket.IO connection lifecycle.
- In-memory room registry.
- Player identity binding by `playerId`.
- Room code and optional password validation.
- Seat ownership.
- Game phase transitions.
- Private state fan-out per player.
- Robot action scheduling.
- Idle room cleanup.

Room state is kept in memory for the MVP. Server restart clears rooms.

### `packages/game`

This package is pure and deterministic. It depends only on TypeScript standard runtime APIs and accepts explicit inputs.

Responsibilities:

- Card model for two decks with jokers.
- Shuffling and dealing.
- Team and seat helpers.
- Trump and level-rank evaluation.
- Card sorting.
- Point-card scoring for 5, 10, and K.
- Play shape detection: single, pair, tractor.
- Effective suit and trump comparison.
- Follow-suit and follow-shape validation.
- Trick winner calculation.
- Kitty score and bottom-capture multiplier.
- Round result and next-round level/dealer calculation.

### `packages/bot`

This package chooses legal actions from a reduced game view:

- Reveal/pass during bidding.
- Bury kitty cards as dealer.
- Play cards during tricks.

The bot is rule-based, not search-based. It should always produce a legal action, even if the choice is strategically simple.

### `packages/shared`

This package contains:

- Shared DTOs.
- Socket event names and payload types.
- Public/private state types.
- Common constants such as seat count and rank order.

## MVP Rules

The first version implements one explicit house rule set.

- 4 players only.
- Seats `0` and `2` are one team; seats `1` and `3` are the other team.
- Two decks, including big and small jokers.
- Starting level is `2`.
- Each round has a dealer team and an attacking team.
- Point cards are 5, 10, and K.
- Supported play shapes are single, pair, and tractor.
- Slam play is not supported.

### Bidding

- Bidding happens during the deal.
- A player may reveal current-level cards to declare trump and become the tentative dealer.
- Another player may overcall with a stronger reveal.
- Stronger reveals are ordered as: one suited level card, two same-suit level cards, two small jokers for no-trump, two big jokers for no-trump.
- Single-joker no-trump reveals are not part of the MVP rule set.
- If nobody reveals in the first round, seat `0` is dealer and the round is no-trump.
- If nobody reveals in later rounds, the scheduled dealer from the previous scoring result remains dealer and the round is no-trump.
- Rebellion or contested dealer modes are out of scope.

### Kitty

- The dealer receives the kitty.
- The dealer must bury the fixed kitty count before play starts.
- Buried cards are hidden until scoring.
- If attackers win the last trick, kitty points are added with a multiplier based on the final trick shape.

### Trick Play

- The lead player may lead one supported shape: single, pair, or tractor.
- Followers must play the same card count.
- Followers must follow effective suit if possible.
- If holding a required pair in the led suit, the player must follow pair requirements where possible.
- If holding a same-length tractor in the led suit, the player must follow tractor requirements where possible.
- If unable to satisfy the led suit or led shape, the player may discard legal cards of the required count.
- Trick winner is determined by trump status, effective suit, play shape, and highest comparable rank.

### Round Scoring

The round result uses a fixed 80-point target house scoring table:

- Attackers score 0 points: dealer team advances 3 levels.
- Attackers from 5 to 35 points: dealer team advances 2 levels.
- Attackers from 40 to 75 points: dealer team advances 1 level.
- Attackers from 80 to 115 points: dealer changes to the attacking team with no level advance.
- Attackers from 120 to 155 points: attacking team advances 1 level.
- Attackers from 160 to 195 points: attacking team advances 2 levels.
- Attackers at 200 or more points: attacking team advances 3 levels.

The exact threshold table should live in `packages/game` as named constants so future variants are easy to add.

## Real-Time Flow

The client creates or loads a browser-local `playerId`. A room join request sends:

- `roomCode`.
- `nickname`.
- Optional password.
- `playerId`.

If the same `playerId` reconnects to an active room, the server binds it back to its seat and resends that player's private state.

### Socket Events

Client-to-server:

- `room:create`
- `room:join`
- `room:list`
- `seat:take`
- `seat:leave`
- `bot:add`
- `bot:remove`
- `game:start`
- `bid:reveal`
- `bid:pass`
- `kitty:bury`
- `trick:play`
- `round:next`
- `chat:send`
- `room:leave`
- `room:end`

Server-to-client:

- `room:state`
- `game:error`
- `chat:message`
- `connection:status`

All state broadcasts are player-specific. A player sees their own hand; opponents' hands are represented by card counts and public plays only.

## Front-End Design

The interface should take structural inspiration from the reference site without copying its code or exact visual treatment. The desired feel is a focused digital card table: dark green table surface, clear team colors, compact controls, and readable cards.

### Lobby

- Header with game title, nickname field, and connection status.
- Left panel for quick 4-player bot-filled games.
- Right panel for playing with friends: create room, optional password, join by room code.
- Small room list for currently joinable rooms.

### Room Waiting View

- Four seats arranged around a table.
- Team indicators for seats `0/2` and `1/3`.
- Player nickname or robot label per seat.
- Controls for taking/leaving seats.
- Room owner controls for adding/removing robots and starting.

### Game Table

- Center area shows the current trick and recent completed trick.
- Four player areas show nickname, seat, team, dealer marker, remaining card count, and disconnected status.
- Status strip shows room code, phase, level rank, trump suit, dealer, score, and turn.
- Bottom area shows the current player's sorted hand.
- Card interactions support click-to-select and a primary action button.
- Helpful controls include hint, clear selection, reveal trump, pass, and confirm bury.

### Mobile

The MVP supports mobile landscape play. Portrait mode shows a rotate-device notice. Desktop and tablet landscape are the primary targets.

## Robot Strategy

The first robot is a normal rule-based bot.

### Bidding

- Reveal when holding enough current-level cards or strong joker support.
- Prefer suits with more trump potential.
- Overcall only when the new reveal is stronger by the house bidding order.

### Burying

- Prefer burying low non-trump cards.
- Avoid burying point cards when reasonable.
- Preserve trump, pairs, and tractors.
- In difficult hands, prioritize legal completion over perfect strategy.

### Play

- Always ask `packages/game` for legal action constraints.
- Lead low-value cards when no clear opportunity exists.
- Lead pairs/tractors when they are strong and likely to pull points.
- When following, win the trick if it can capture meaningful points or prevent opponents from scoring.
- If a teammate is currently winning, feed points when safe.
- If an opponent is currently winning, avoid feeding points where possible.

Robot actions should be delayed by roughly 600-1200 ms so the game feels observable.

## Error Handling

The server rejects invalid actions without mutating state. Common errors include:

- Room not found.
- Wrong password.
- Seat occupied.
- Not seated.
- Not the player's turn.
- Wrong game phase.
- Invalid card IDs.
- Invalid reveal.
- Invalid bury count.
- Illegal play.

The client displays concise messages and then continues from the latest server state.

## Testing

### Game Engine

Unit tests should cover:

- Deck construction.
- Shuffle/deal invariants.
- Trump and effective suit behavior.
- Card sorting.
- Point scoring.
- Single, pair, and tractor detection.
- Required follow behavior.
- Illegal play rejection.
- Trick winner calculation.
- Kitty scoring.
- Round advancement thresholds.

### Bot

Tests should cover:

- Bot always returns legal bidding decisions.
- Bot always buries the required number of cards.
- Bot always returns a legal trick play.
- Fixed board states for teammate-winning and opponent-winning decisions.

### Server

Socket tests should cover:

- Create room.
- Join room.
- Optional password rejection.
- Seat take/leave.
- Add/remove bot.
- Start game with full seats.
- Reconnect by `playerId`.
- Reject illegal phase and turn actions.
- Broadcast private hands only to the owning player.

### Web

Playwright or component tests should cover:

- Create a room from the lobby.
- Join by room code.
- Sit at a seat.
- Add robots and start a game.
- Attempt an invalid play and see an error.
- Select cards and submit a valid action.

Manual acceptance should include:

- One human plus three robots completes a round.
- Two humans plus two robots complete a round.
- A player refreshes and recovers their seat.

## Deployment

Local development:

- `pnpm install`
- `pnpm dev`

Production:

- Build the web app.
- Serve static assets from the Node server.
- Run Socket.IO and Express in the same process.
- Package with Docker for simple VPS or hosted-platform deployment.

Environment variables:

- `PORT`
- `PUBLIC_URL`
- `CORS_ORIGIN`
- `ROOM_TTL_MINUTES`

The deployment target is a single small cloud server or a platform that supports long-lived WebSocket connections.

## Acceptance Criteria

- A user can create a 4-player room with nickname and optional password.
- Friends can join by room code.
- Empty seats can be filled with robots.
- The room can start once four seats are occupied.
- Players can bid, bury, play singles, pairs, and tractors.
- Invalid actions are rejected by the server.
- A full round reaches scoring and can advance to the next round.
- Refreshing the browser reconnects the same player to their seat.
- The app runs locally and has a documented production deployment path.

## Open Implementation Notes

- Use deterministic test fixtures for complex card comparisons.
- Keep `packages/game` independent from Socket.IO so it can be tested thoroughly.
- Keep the first scoring and bidding rules explicit as house rules.
- Prefer small state transition functions over one large game reducer.
