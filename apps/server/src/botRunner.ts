import { advanceDeal, countPoints, type Rng } from '@shengji/game';
import { decideBid, decideBury, decidePlay } from '@shengji/bot';
import type { Room } from './rooms';
import { closeTimedBidWindow, handleAction, type GameAction } from './gameFlow';

// 每房间至多一个待触发的机器人定时器，避免重复调度
const pending = new Map<string, NodeJS.Timeout>();

export function cancelBots(roomCode: string): void {
  const timer = pending.get(roomCode);
  if (timer) clearTimeout(timer);
  pending.delete(roomCode);
}

// 当前需要行动的座位；scoring 阶段等真人 round:next
function actingSeat(room: Room): number | null {
  const round = room.round;
  if (!round) return null;
  if (round.phase === 'bidding') return round.biddingTurn;
  if (round.phase === 'burying') return round.buryingSeat;
  if (round.phase === 'playing') return round.turnSeat;
  return null;
}

function botAction(room: Room, seat: number): GameAction {
  const round = room.round!;
  if (round.phase === 'bidding') {
    const cardIds = decideBid({
      hand: round.hands[seat],
      level: round.level,
      currentBid: round.currentBid,
      seat,
      biddingStage: round.biddingStage,
    });
    return cardIds ? { type: 'reveal', cardIds } : { type: 'pass' };
  }
  if (round.phase === 'burying') {
    return {
      type: 'bury',
      cardIds: decideBury({
        hand: round.hands[seat],
        trump: round.trump,
        seat,
        dealerSeat: round.dealerSeat,
        currentBid: round.currentBid,
        bidHistory: round.bidHistory,
        postBuryCountersAllowed: round.chaodiEnabled && round.currentBid !== null,
      }),
    };
  }
  const leadCombo = round.currentTrick.length > 0 ? round.currentTrick[0].combo : null;
  const dealerTeam = round.dealerSeat % 2;
  const defenderTeam = (1 - dealerTeam) as 0 | 1;
  const effectiveDefenderPoints =
    round.defenderTrickPoints +
    round.throwPenaltyPoints[defenderTeam] -
    round.throwPenaltyPoints[dealerTeam as 0 | 1];
  return {
    type: 'play',
    cardIds: decidePlay({
      hand: round.hands[seat],
      trump: round.trump,
      leadCombo,
      currentTrick: round.currentTrick,
      seat,
      trickPointsSoFar: countPoints(round.currentTrick.flatMap((p) => p.cards)),
      trickHistory: round.trickHistory,
      handCounts: round.hands.map((hand) => hand.length),
      botSeats: room.seats.map((roomSeat) => roomSeat.bot !== null),
      dealerSeat: round.dealerSeat,
      defenderPoints: effectiveDefenderPoints,
      knownKitty: round.lastBuryingSeat === seat ? round.kitty : undefined,
    }),
  };
}

// 刚结完一墩：给所有客户端留出驻留看牌的时间，机器人领出下一墩前多等一会
const SETTLE_HOLD_MS = 3000;
// 四家每轮各摸一张，共 25 轮；350ms 一轮约 8.75 秒发完。
const DEAL_TICK_MS = 350;

export function defaultBotDelay(settling: boolean): number {
  return (settling ? SETTLE_HOLD_MS : 0) + 600 + Math.random() * 600;
}

export function defaultDealDelay(): number {
  return DEAL_TICK_MS;
}

function letBotsRevealDuringDeal(room: Room): void {
  for (let seat = 0; seat < room.seats.length; seat++) {
    const round = room.round;
    if (round?.phase !== 'bidding' || round.biddingStage !== 'dealing') return;
    if (room.seats[seat].bot === null) continue;
    const cardIds = decideBid({
      hand: round.hands[seat].slice(0, round.dealtCount),
      level: round.level,
      currentBid: round.currentBid,
      seat,
      biddingStage: round.biddingStage,
    });
    if (cardIds !== null) handleAction(room, seat, { type: 'reveal', cardIds });
  }
}

// 摸底前的 5 秒窗口不是轮流行动：所有机器人都可在规则允许时立即亮主/反主。
// 每次成功都会提高叫主强度，最多有限次后必然稳定。
function letBotsRevealDuringTimedWindow(room: Room): boolean {
  let changed = false;
  for (;;) {
    let revealed = false;
    for (let seat = 0; seat < room.seats.length; seat++) {
      const round = room.round;
      if (round?.phase !== 'bidding' || round.biddingStage !== 'pre-dealer') return changed;
      if (room.seats[seat].bot === null || round.currentBid?.seat === seat) continue;
      const cardIds = decideBid({
        hand: round.hands[seat],
        level: round.level,
        currentBid: round.currentBid,
        seat,
        biddingStage: round.biddingStage,
      });
      if (cardIds === null) continue;
      const result = handleAction(room, seat, { type: 'reveal', cardIds });
      if (!result.ok) continue;
      changed = true;
      revealed = true;
    }
    if (!revealed) return changed;
  }
}

// 机器人是否正要领出新一墩（上一墩刚收走），此时需要驻留停顿
function isSettling(room: Room): boolean {
  const round = room.round;
  return (
    round?.phase === 'playing' && round.currentTrick.length === 0 && round.lastTrick.length > 0
  );
}

// 轮到机器人时延迟行动 → 广播 → 递归调度下一手
export function scheduleBots(
  room: Room,
  broadcast: () => void,
  delayMs: (settling: boolean) => number = defaultBotDelay,
  dealDelayMs: () => number = defaultDealDelay,
  rng: Rng = Math.random,
): void {
  if (pending.has(room.code)) return;
  if (room.round?.phase === 'bidding' && room.round.biddingStage === 'dealing') {
    const timer = setTimeout(() => {
      pending.delete(room.code);
      const round = room.round;
      if (round?.phase !== 'bidding' || round.biddingStage !== 'dealing') return;
      room.round = advanceDeal(round);
      room.phase = room.round.phase;
      letBotsRevealDuringDeal(room);
      broadcast();
      scheduleBots(room, broadcast, delayMs, dealDelayMs, rng);
    }, dealDelayMs());
    pending.set(room.code, timer);
    return;
  }
  if (room.round?.phase === 'bidding' && room.round.biddingStage === 'pre-dealer') {
    const currentDeadline = room.round.bidWindowEndsAt;
    if (currentDeadline !== null && currentDeadline <= Date.now()) {
      const result = closeTimedBidWindow(room, rng);
      if (!result.ok) return;
      broadcast();
      scheduleBots(room, broadcast, delayMs, dealDelayMs, rng);
      return;
    }
    if (letBotsRevealDuringTimedWindow(room)) broadcast();
    const deadline = room.round?.bidWindowEndsAt;
    if (deadline === null || deadline === undefined) return;
    const timer = setTimeout(() => {
      pending.delete(room.code);
      const round = room.round;
      if (round?.phase !== 'bidding' || round.biddingStage !== 'pre-dealer') return;
      // 系统计时器可能略早唤醒；仍以状态中的绝对截止时间为准。
      if (round.bidWindowEndsAt !== null && round.bidWindowEndsAt > Date.now()) {
        scheduleBots(room, broadcast, delayMs, dealDelayMs, rng);
        return;
      }
      const result = closeTimedBidWindow(room, rng);
      if (!result.ok) return;
      broadcast();
      scheduleBots(room, broadcast, delayMs, dealDelayMs, rng);
    }, Math.max(0, deadline - Date.now()));
    pending.set(room.code, timer);
    return;
  }
  const seat = actingSeat(room);
  if (seat === null || room.seats[seat].bot === null) return;
  const timer = setTimeout(() => {
    pending.delete(room.code);
    // 定时器触发时重新校验：状态可能已被真人操作/换局改变
    const nowSeat = actingSeat(room);
    if (nowSeat === null || room.seats[nowSeat].bot === null) return;
    const result = handleAction(room, nowSeat, botAction(room, nowSeat));
    if (!result.ok) {
      console.error(`bot action failed in room ${room.code}: ${result.error.code}`);
      return;
    }
    broadcast();
    scheduleBots(room, broadcast, delayMs, dealDelayMs, rng);
  }, delayMs(isSettling(room)));
  pending.set(room.code, timer);
}
