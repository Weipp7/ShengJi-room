export const C2S = {
  RoomCreate: 'room:create',
  RoomJoin: 'room:join',
  RoomList: 'room:list',
  SeatTake: 'seat:take',
  SeatLeave: 'seat:leave',
  BotAdd: 'bot:add',
  BotRemove: 'bot:remove',
  GameStart: 'game:start',
  BidReveal: 'bid:reveal',
  BidPass: 'bid:pass',
  KittyBury: 'kitty:bury',
  TrickPlay: 'trick:play',
  RoundNext: 'round:next',
  ChatSend: 'chat:send',
  RoomLeave: 'room:leave',
  RoomEnd: 'room:end',
} as const;

export const S2C = {
  RoomState: 'room:state',
  GameError: 'game:error',
  ChatMessage: 'chat:message',
  ConnectionStatus: 'connection:status',
  RoomEnded: 'room:ended',
} as const;

export type RoomCreatePayload = {
  nickname: string;
  password?: string;
  playerId: string;
};

export type RoomJoinPayload = {
  roomCode: string;
  nickname: string;
  password?: string;
  playerId: string;
};

export type SeatTakePayload = { seat: number };
export type BotAddPayload = { seat: number };
export type BotRemovePayload = { seat: number };
export type BidRevealPayload = { cardIds: string[] };
export type KittyBuryPayload = { cardIds: string[] };
export type TrickPlayPayload = { cardIds: string[] };
export type ChatSendPayload = { text: string };

export type GameErrorPayload = { code: string; message: string };

export type ChatMessagePayload = {
  seat: number | null;
  nickname: string;
  text: string;
  ts: number;
};

export type RoomListItem = {
  code: string;
  playerCount: number;
  hasPassword: boolean;
  phase: string;
};
