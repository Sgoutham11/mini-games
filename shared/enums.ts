/**
 * Shared Enums for SOS Game
 */

export enum GameMode {
  SINGLE_PLAYER = 'single_player',
  LOCAL_MULTIPLAYER = 'local_multiplayer',
  ONLINE_MULTIPLAYER = 'online_multiplayer',
}

export enum AIDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum RoomStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export enum Letter {
  S = 'S',
  O = 'O',
  EMPTY = '',
}

export enum Direction {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
  DIAGONAL_LEFT = 'diagonal-left',
  DIAGONAL_RIGHT = 'diagonal-right',
}

/** Grid sizes: 3×3 through 10×10 */
export const GRID_SIZES = [3, 4, 5, 6, 7, 8, 9, 10] as const;
export type GridSize = (typeof GRID_SIZES)[number];
export const DEFAULT_GRID_SIZE: GridSize = 6;

/** Player colors for up to 4 players */
export const PLAYER_COLORS = [
  '#00f0ff', // Cyan
  '#ffaa00', // Orange
  '#00ff88', // Green
  '#b44aff', // Purple
] as const;

/** Turn timer in seconds */
export const TURN_TIMER_SECONDS = 60;

/** Reconnection window in milliseconds */
export const RECONNECT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/** Room TTL in seconds */
export const ROOM_TTL_SECONDS = 30 * 60; // 30 minutes

/** AI move delay range in milliseconds */
export const AI_MOVE_DELAY_MIN = 500;
export const AI_MOVE_DELAY_MAX = 1500;
