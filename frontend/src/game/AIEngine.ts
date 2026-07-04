import { AIDifficulty, AI_MOVE_DELAY_MIN, AI_MOVE_DELAY_MAX } from '@shared/enums';
import type { Cell } from '@shared/events';
import { getEmptyCells, countPotentialSOS, cloneBoard, placeLetter, isBoardFull } from './SOSEngine';

export interface AIMove { row: number; col: number; letter: 'S' | 'O' }

export function getAIMoveDelay(): number {
  return Math.floor(Math.random() * (AI_MOVE_DELAY_MAX - AI_MOVE_DELAY_MIN) + AI_MOVE_DELAY_MIN);
}

export function getAIMove(board: Cell[][], difficulty: AIDifficulty, aiId: string, humanId: string): AIMove {
  switch (difficulty) {
    case AIDifficulty.EASY: return easyMove(board);
    case AIDifficulty.MEDIUM: return mediumMove(board);
    case AIDifficulty.HARD: return hardMove(board, aiId, humanId);
    default: return easyMove(board);
  }
}

function easyMove(board: Cell[][]): AIMove {
  const empty = getEmptyCells(board);
  const cell = empty[Math.floor(Math.random() * empty.length)];
  return { row: cell.row, col: cell.col, letter: Math.random() < 0.5 ? 'S' : 'O' };
}

function mediumMove(board: Cell[][]): AIMove {
  const empty = getEmptyCells(board);
  let best: AIMove | null = null;
  let bestScore = 0;
  for (const { row, col } of empty) {
    for (const letter of ['S', 'O'] as const) {
      const score = countPotentialSOS(board, row, col, letter);
      if (score > bestScore) { bestScore = score; best = { row, col, letter }; }
    }
  }
  if (best && bestScore > 0) return best;
  const cell = empty[Math.floor(Math.random() * empty.length)];
  return { row: cell.row, col: cell.col, letter: Math.random() < 0.5 ? 'S' : 'O' };
}

function hardMove(board: Cell[][], aiId: string, humanId: string): AIMove {
  const empty = getEmptyCells(board);
  if (empty.length > 30) return mediumMove(board);

  const maxDepth = board.length <= 5 ? 4 : 3;
  const result = minimax(board, maxDepth, true, -Infinity, Infinity, aiId, humanId);
  if (result.move) return result.move;
  return mediumMove(board);
}

function minimax(
  board: Cell[][], depth: number, isMax: boolean,
  alpha: number, beta: number, aiId: string, humanId: string
): { score: number; move: AIMove | null } {
  if (depth === 0 || isBoardFull(board)) {
    return { score: evaluate(board, aiId, humanId), move: null };
  }
  const currentId = isMax ? aiId : humanId;
  const empty = getEmptyCells(board);
  const moves: AIMove[] = [];
  for (const { row, col } of empty) {
    for (const letter of ['S', 'O'] as const) {
      if (countPotentialSOS(board, row, col, letter) > 0) moves.push({ row, col, letter });
    }
  }
  if (moves.length === 0) {
    for (const { row, col } of empty.slice(0, 15)) {
      for (const letter of ['S', 'O'] as const) moves.push({ row, col, letter });
    }
  }

  if (isMax) {
    let bestScore = -Infinity;
    let bestMove: AIMove | null = null;
    for (const move of moves) {
      const nb = cloneBoard(board);
      const r = placeLetter(nb, move.row, move.col, move.letter, currentId);
      const child = minimax(nb, depth - 1, !r.bonusTurn, alpha, beta, aiId, humanId);
      const score = child.score + r.scoreGained * 10;
      if (score > bestScore) { bestScore = score; bestMove = move; }
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  } else {
    let bestScore = Infinity;
    let bestMove: AIMove | null = null;
    for (const move of moves) {
      const nb = cloneBoard(board);
      const r = placeLetter(nb, move.row, move.col, move.letter, currentId);
      const child = minimax(nb, depth - 1, r.bonusTurn, alpha, beta, aiId, humanId);
      const score = child.score - r.scoreGained * 10;
      if (score < bestScore) { bestScore = score; bestMove = move; }
      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }
}

function evaluate(board: Cell[][], aiId: string, humanId: string): number {
  let score = 0;
  for (const { row, col } of getEmptyCells(board)) {
    for (const letter of ['S', 'O'] as const) {
      score += countPotentialSOS(board, row, col, letter);
    }
  }
  return score;
}
