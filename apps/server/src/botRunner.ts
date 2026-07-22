import { countPoints } from '@shengji/game';
import { decideBid, decideBury, decidePlay } from '@shengji/bot';
import type { Room } from './rooms';
import { handleAction, type GameAction } from './gameFlow';

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
  if (round.phase === 'burying') return round.dealerSeat;
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
    if (round.biddingStage === 'post-dealer') {
      const cardIds = decideBid({
        hand: round.hands[seat],
        level: round.level,
        currentBid: round.currentBid,
        seat,
        biddingStage: round.biddingStage,
      });
      if (cardIds) return { type: 'reveal', cardIds };
    }
    return { type: 'bury', cardIds: decideBury(round.hands[seat], round.trump) };
  }
  const leadCombo = round.currentTrick.length > 0 ? round.currentTrick[0].combo : null;
  return {
    type: 'play',
    cardIds: decidePlay({
      hand: round.hands[seat],
      trump: round.trump,
      leadCombo,
      currentTrick: round.currentTrick,
      seat,
      trickPointsSoFar: countPoints(round.currentTrick.flatMap((p) => p.cards)),
    }),
  };
}

// 刚结完一墩：给所有客户端留出驻留看牌的时间，机器人领出下一墩前多等一会
const SETTLE_HOLD_MS = 3000;

export function defaultBotDelay(settling: boolean): number {
  return (settling ? SETTLE_HOLD_MS : 0) + 600 + Math.random() * 600;
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
): void {
  if (pending.has(room.code)) return;
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
    scheduleBots(room, broadcast, delayMs);
  }, delayMs(isSettling(room)));
  pending.set(room.code, timer);
}
