export const BingoClientEvents = {
  CREATE_ROOM: 'bingo_create_room',
  JOIN_ROOM: 'bingo_join_room',
  ADD_BOT: 'bingo_add_bot',
  START_GAME: 'bingo_start_game',
  SELECT_NUMBER: 'bingo_select_number',
  LEAVE_ROOM: 'bingo_leave_room',
  RECONNECT: 'bingo_reconnect_game',
} as const;

export const BingoServerEvents = {
  ROOM_CREATED: 'bingo_room_created',
  PLAYER_JOINED: 'bingo_player_joined',
  ROOM_UPDATE: 'bingo_room_update',
  PLAYER_LEFT: 'bingo_player_left',
  GAME_STARTED: 'bingo_game_started',
  BOARD_UPDATED: 'bingo_board_updated',
  TURN_CHANGED: 'bingo_turn_changed',
  SCORE_UPDATED: 'bingo_score_updated',
  GAME_ENDED: 'bingo_game_ended',
  TIMER_UPDATED: 'bingo_timer_updated',
  ERROR: 'bingo_error',
} as const;

export type BingoBoardSize = 5 | 6 | 7 | 8;
export type BingoHeader = 'BINGO' | 'BINGOS' | 'BINGOES' | 'BINGOESS';
export type BingoPlayerStatus = 'WAITING' | 'PLAYING' | 'WON' | 'LOST' | 'QUIT';

export interface BingoPlayerInfo {
  id: string;
  name: string;
  telegramId?: number;
  color: string;
  status: BingoPlayerStatus;
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
  score: number;
  finishRank?: number;
}

export interface BingoPlayerBoard {
  playerId: string;
  board: number[][];
  marked: boolean[][];
  completedPatterns: string[];
}

export interface BingoMoveInfo {
  selectedNumber: number;
  playerId: string;
  moveOrder: number;
  autoSelected: boolean;
  timestamp: number;
}

export interface BingoRoomState {
  roomCode: string;
  gameKind: 'bingo';
  status: 'waiting' | 'playing' | 'finished';
  boardSize: BingoBoardSize;
  maxPlayers: number;
  players: BingoPlayerInfo[];
  hostId: string;
  createdAt: number;
}

export interface BingoGameState {
  roomCode: string;
  boardSize: BingoBoardSize;
  header: BingoHeader;
  pointsToWin: number;
  players: BingoPlayerInfo[];
  boards: Record<string, BingoPlayerBoard>;
  selectedNumbers: number[];
  moves: BingoMoveInfo[];
  currentPlayerId: string;
  turnNumber: number;
  startedAt: number;
}

export interface BingoCreateRoomPayload {
  playerName: string;
  boardSize: BingoBoardSize;
  playerCount: number;
  telegramId?: number;
}

export interface BingoJoinRoomPayload {
  playerName: string;
  roomCode: string;
  telegramId?: number;
}

export interface BingoAddBotPayload {
  roomCode: string;
}

export interface BingoStartGamePayload {
  roomCode: string;
}

export interface BingoSelectNumberPayload {
  roomCode: string;
  selectedNumber: number;
}

export interface BingoLeaveRoomPayload {
  roomCode: string;
}

export interface BingoReconnectPayload {
  roomCode: string;
  playerId: string;
}

export interface BingoRoomCreatedPayload {
  roomCode: string;
  room: BingoRoomState;
}

export interface BingoPlayerJoinedPayload {
  player: BingoPlayerInfo;
  room: BingoRoomState;
}

export interface BingoRoomUpdatePayload {
  room: BingoRoomState;
}

export interface BingoPlayerLeftPayload {
  playerId: string;
  room: BingoRoomState;
  gameState?: BingoGameState;
}

export interface BingoGameStartedPayload {
  gameState: BingoGameState;
}

export interface BingoBoardUpdatedPayload {
  gameState: BingoGameState;
  selectedNumber: number;
  selectedBy: string;
  changedPatterns: Record<string, string[]>;
  autoSelected: boolean;
}

export interface BingoTurnChangedPayload {
  currentPlayerId: string;
  turnNumber: number;
}

export interface BingoScoreUpdatedPayload {
  scores: Record<string, number>;
  players: BingoPlayerInfo[];
}

export interface BingoGameEndedPayload {
  winnerId: string | null;
  players: BingoPlayerInfo[];
  scores: Record<string, number>;
  reason: 'completed' | 'player_left' | 'timeout';
  isDraw: boolean;
  gameState: BingoGameState;
}

export interface BingoTimerUpdatedPayload {
  remaining: number;
  playerId: string;
}

export interface BingoErrorPayload {
  code: string;
  message: string;
}
