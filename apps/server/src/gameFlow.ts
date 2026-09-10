import {
  applyBury,
  applyPass,
  applyPlay,
  applyReveal,
  closePreKittyBidWindow,
  createRound,
  PRE_KITTY_BID_WINDOW_MS,
  type StepResult,
} from '@shengji/game';
import type { Rng } from '@shengji/game';
import type { Room } from './rooms';

export type GameAction = {
  type: 'reveal' | 'pass' | 'bury' | 'play';
  cardIds?: string[];
};

// 开局：4 座全满（真人或机器人）才能发牌
export function startGame(
  room: Room,
  rng: Rng = Math.random,
  bidWindowDurationMs: number = PRE_KITTY_BID_WINDOW_MS,
): { ok: boolean; code?: 'seats-not-full' | 'wrong-phase' } {
  if (room.phase !== 'waiting') return { ok: false, code: 'wrong-phase' };
  const filled = room.seats.every((s) => s.player !== null || s.bot !== null);
  if (!filled) return { ok: false, code: 'seats-not-full' };
  room.round = createRound({
    plannedDealerSeat: room.plannedDealerSeat,
    teamLevels: room.teamLevels,
    rng,
    isFirstRound: room.roundNumber === 0,
    progressiveDeal: true,
    chaodiEnabled: room.chaodiEnabled,
    bidWindowDurationMs,
  });
  room.roundNumber += 1;
  room.phase = room.round.phase;
  return { ok: true };
}

export function closeTimedBidWindow(
  room: Room,
  rng: Rng = Math.random,
): { ok: boolean; code?: string; redealt?: boolean } {
  const round = room.round;
  if (!round) return { ok: false, code: 'wrong-phase' };
  const result = closePreKittyBidWindow(round);
  if (!result.ok) return { ok: false, code: result.error.code };

  if (result.action === 'redeal') {
    room.round = createRound({
      plannedDealerSeat: round.plannedDealerSeat,
      teamLevels: round.teamLevels,
      rng,
      isFirstRound: true,
      progressiveDeal: true,
      chaodiEnabled: room.chaodiEnabled,
      redealCount: round.redealCount + 1,
      bidWindowDurationMs: round.bidWindowDurationMs,
    });
    room.phase = room.round.phase;
    return { ok: true, redealt: true };
  }

  room.round = result.state;
  room.phase = result.state.phase;
  return { ok: true, redealt: false };
}

// 把 socket 意图接到 round 状态机；成功则落盘新状态
export function handleAction(room: Room, seat: number, action: GameAction): StepResult {
  const round = room.round;
  if (!round) return { ok: false, error: { code: 'wrong-phase', message: 'no active round' } };
  const cardIds = action.cardIds ?? [];
  const result =
    action.type === 'reveal'
      ? applyReveal(round, seat, cardIds)
      : action.type === 'pass'
        ? applyPass(round, seat)
        : action.type === 'bury'
          ? applyBury(round, seat, cardIds)
          : applyPlay(round, seat, cardIds);
  if (result.ok) {
    room.round = result.state;
    room.phase = result.state.phase;
  }
  return result;
}

// scoring → 用结算结果推进级牌/庄家，并发下一局
export function advanceToNextRound(
  room: Room,
  rng: Rng = Math.random,
  bidWindowDurationMs: number = PRE_KITTY_BID_WINDOW_MS,
): void {
  const result = room.round?.phase === 'scoring' ? room.round.result : null;
  if (!result) return;
  room.teamLevels = result.nextLevels;
  room.plannedDealerSeat = result.nextDealerSeat;
  room.round = createRound({
    plannedDealerSeat: result.nextDealerSeat,
    teamLevels: result.nextLevels,
    rng,
    isFirstRound: false,
    progressiveDeal: true,
    chaodiEnabled: room.chaodiEnabled,
    bidWindowDurationMs,
  });
  room.roundNumber += 1;
  room.phase = room.round.phase;
}
