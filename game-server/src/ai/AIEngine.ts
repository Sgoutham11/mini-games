/**
 * AI Engine — Manages AI difficulty strategies
 */

import { Cell } from '../../../shared/events';
import { AIDifficulty, AI_MOVE_DELAY_MIN, AI_MOVE_DELAY_MAX } from '../../../shared/enums';
import { easyMove } from './strategies/EasyAI';
import { mediumMove } from './strategies/MediumAI';
import { hardMove } from './strategies/HardAI';

export interface AIMove {
  row: number;
  col: number;
  letter: 'S' | 'O';
}

/**
 * Get an AI move based on difficulty
 */
export function getAIMove(
  board: Cell[][],
  playerId: string,
  opponentIds: string[],
  difficulty: AIDifficulty
): AIMove {
  switch (difficulty) {
    case AIDifficulty.EASY:
      return easyMove(board);
    case AIDifficulty.MEDIUM:
      return mediumMove(board, playerId);
    case AIDifficulty.HARD:
      return hardMove(board, playerId, opponentIds);
    default:
      return easyMove(board);
  }
}

/**
 * Returns a random delay for AI moves to feel natural
 */
export function getAIMoveDelay(): number {
  return Math.floor(
    Math.random() * (AI_MOVE_DELAY_MAX - AI_MOVE_DELAY_MIN) + AI_MOVE_DELAY_MIN
  );
}
