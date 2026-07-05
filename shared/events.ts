/**
 * Socket.IO Event Constants and Payload Types
 * Shared between frontend and game-server
 */

// ============================================================
// Client → Server Events
// ============================================================
export const ClientEvents = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  START_GAME: 'start_game',
  MAKE_MOVE: 'make_move',
  PLAYER_READY: 'player_ready',
  LEAVE_ROOM: 'leave_room',
  RECONNECT: 'reconnect_game',
} as const;

// ============================================================
// Server → Client Events
// ============================================================
export const ServerEvents = {
  ROOM_CREATED: 'room_created',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_STARTED: 'game_started',
  BOARD_UPDATED: 'board_updated',
  TURN_CHANGED: 'turn_changed',
  SCORE_UPDATED: 'score_updated',
  GAME_ENDED: 'game_ended',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
  TIMER_UPDATED: 'timer_updated',
  ROOM_UPDATE: 'room_update',
  ERROR: 'error_event',
} as const;

// ============================================================
// Client → Server Payloads
// ============================================================
export interface CreateRoomPayload {
  playerName: string;
  gridSize: number;
  playerCount: number;
  telegramId?: number;
}

export interface JoinRoomPayload {
  playerName: string;
  roomCode: string;
  telegramId?: number;
}

export interface MakeMovePayload {
  roomCode: string;
  row: number;
  col: number;
  letter: 'S' | 'O';
}

export interface PlayerReadyPayload {
  roomCode: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
}

export interface ReconnectPayload {
  roomCode: string;
  playerId: string;
}

// ============================================================
// Server → Client Payloads
// ============================================================
export interface RoomCreatedPayload {
  roomCode: string;
  room: RoomState;
}

export interface PlayerJoinedPayload {
  player: PlayerInfo;
  room: RoomState;
}

export interface PlayerLeftPayload {
  playerId: string;
  room: RoomState;
  gameState?: GameState;
}

export interface GameStartedPayload {
  gameState: GameState;
}

export interface BoardUpdatedPayload {
  board: Cell[][];
  lastMove: MoveInfo;
  scoredLines: ScoredLine[];
}

export interface TurnChangedPayload {
  currentPlayerId: string;
  turnNumber: number;
}

export interface ScoreUpdatedPayload {
  scores: Record<string, number>;
}

export interface GameEndedPayload {
  winnerId: string | null;
  scores: Record<string, number>;
  reason: 'board_full' | 'player_left' | 'timeout';
  isDraw: boolean;
  players?: PlayerInfo[];
}

export interface PlayerDisconnectedPayload {
  playerId: string;
  playerName: string;
}

export interface PlayerReconnectedPayload {
  playerId: string;
  playerName: string;
}

export interface TimerUpdatedPayload {
  remaining: number;
  playerId: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ============================================================
// Shared State Types
// ============================================================
export interface Cell {
  row: number;
  col: number;
  value: '' | 'S' | 'O';
  ownerId: string | null;
}

export interface ScoredLine {
  cells: Array<{ row: number; col: number }>;
  playerId: string;
  direction: 'horizontal' | 'vertical' | 'diagonal-left' | 'diagonal-right';
}

export interface MoveInfo {
  row: number;
  col: number;
  letter: 'S' | 'O';
  playerId: string;
  timestamp: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  telegramId?: number;
  color: string;
  status?: 'ACTIVE' | 'QUIT';
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
}

export interface RoomState {
  roomCode: string;
  status: 'waiting' | 'playing' | 'finished';
  gridSize: number;
  maxPlayers: number;
  players: PlayerInfo[];
  hostId: string;
  createdAt: number;
}

export interface GameState {
  roomCode: string;
  board: Cell[][];
  players: PlayerInfo[];
  scores: Record<string, number>;
  currentPlayerId: string;
  turnNumber: number;
  scoredLines: ScoredLine[];
  moveHistory: MoveInfo[];
  startedAt: number;
  gridSize: number;
}
