import type { GameErrorPayload } from '@shengji/shared';

export type FormattedGameError = {
  code: string;
  title: string;
  hint: string | null;
  text: string;
};

const ERROR_TEXT: Record<string, string> = {
  'room-not-found': '房间不存在',
  'wrong-password': '房间密码错误',
  'seat-taken': '该座位已被占用',
  'seats-not-full': '4 个座位坐满后才能开始',
  'not-host': '只有房主可以进行此操作',
  'wrong-phase': '当前阶段不能进行此操作',
  'wrong-turn': '还没轮到你',
  'invalid-bid': '亮主不合法',
  'cards-not-in-hand': '所选牌不在手牌中',
  'invalid-combo': '所选牌不构成合法牌型（单张/对子/拖拉机）',
  'invalid-throw': '甩牌必须是同一花色的两个以上非连续对子',
  'wrong-count': '出牌张数必须与领出相同',
  'must-follow-suit': '必须跟随领出花色',
  'must-play-pair': '有对子时必须出对子',
  'must-play-tractor': '有拖拉机时必须出拖拉机',
  'not-dealer': '只有庄家可以埋底',
  'bad-bury-count': '必须埋 8 张底牌',
  'not-seated': '请先入座',
  'not-in-room': '请先加入房间',
  'bad-payload': '请求内容不完整',
};

const ERROR_HINT: Partial<Record<string, string>> = {
  'wrong-turn': '动作可能已经提交或当前轮次已变化，请以桌面当前提示为准。',
  'wrong-phase': '动作可能已经提交或牌局阶段已变化，请以桌面当前提示为准。',
};

export function formatGameError(e: GameErrorPayload): FormattedGameError {
  const title = ERROR_TEXT[e.code] ?? `操作失败（${e.code}）`;
  const hint = ERROR_HINT[e.code] ?? null;
  const serverMessage = e.message?.trim();
  const detail = hint ?? (serverMessage && serverMessage !== title ? serverMessage : null);

  return {
    code: e.code,
    title,
    hint,
    text: detail ? `${title}：${detail}` : title,
  };
}
