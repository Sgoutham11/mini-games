/**
 * Hard AI — Minimax with alpha-beta pruning
 * Depth limit: 3–4 depending on board size
 */

import { Cell } from '../../../../shared/events';
import {
  getEmptyCells,
  cloneBoard,
  placeLetter,
  isBoardFull,
  countPotentialSOS,
} from '../../game-engine/SOSEngine';
import { AIMove } from '../AIEngine';

const MAX_DEPTH_SMALL = 4; // For boards <= 5x5
const MAX_DEPTH_LARGE = 3; // For boards > 5x5

interface MinimaxResult {
  score: number;
  move: AIMove | null;
}

export function hardMove(
  board: Cell[][],
  playerId: string,
  opponentIds: string[]
): AIMove {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) {
    throw new Error('No empty cells available');
  }

  // For very large boards with many empty cells, fall back to enhanced greedy
  if (emptyCells.length > 40) {
    return enhancedGreedy(board, playerId);
  }

  const maxDepth = board.length <= 5 ? MAX_DEPTH_SMALL : MAX_DEPTH_LARGE;
  const opponentId = opponentIds[0] || '__opponent__';

  const result = minimax(
    board,
    maxDepth,
    true,
    -Infinity,
    Infinity,
    playerId,
    opponentId
  );

  if (result.move) {
    return result.move;
  }

  // Fallback
  return enhancedGreedy(board, playerId);
}

function minimax(
  board: Cell[][],
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
  playerId: string,
  opponentId: string
): MinimaxResult {
  // Terminal conditions
  if (depth === 0 || isBoardFull(board)) {
    return { score: evaluateBoard(board, playerId, opponentId), move: null };
  }

  const emptyCells = getEmptyCells(board);
  const currentId = isMaximizing ? playerId : opponentId;

  // Move ordering: prioritize cells that can score
  const orderedMoves = orderMoves(board, emptyCells, currentId);

  if (isMaximizing) {
    let bestScore = -Infinity;
    let bestMove: AIMove | null = null;

    for (const move of orderedMoves) {
      const newBoard = cloneBoard(board);
      const result = placeLetter(newBoard, move.row, move.col, move.letter, currentId);

      // If this move scores, the same player gets another turn
      const nextIsMaximizing = result.bonusTurn ? true : false;

      const childResult = minimax(
        newBoard,
        depth - 1,
        nextIsMaximizing,
        alpha,
        beta,
        playerId,
        opponentId
      );

      const adjustedScore = childResult.score + (result.scoreGained * 10);

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }

      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break; // Alpha-beta pruning
    }

    return { score: bestScore, move: bestMove };
  } else {
    let bestScore = Infinity;
    let bestMove: AIMove | null = null;

    for (const move of orderedMoves) {
      const newBoard = cloneBoard(board);
      const result = placeLetter(newBoard, move.row, move.col, move.letter, currentId);

      const nextIsMaximizing = result.bonusTurn ? false : true;

      const childResult = minimax(
        newBoard,
        depth - 1,
        nextIsMaximizing,
        alpha,
        beta,
        playerId,
        opponentId
      );

      const adjustedScore = childResult.score - (result.scoreGained * 10);

      if (adjustedScore < bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }

      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break; // Alpha-beta pruning
    }

    return { score: bestScore, move: bestMove };
  }
}

/**
 * Order moves for better alpha-beta pruning
 * Moves that score are tried first
 */
function orderMoves(
  board: Cell[][],
  emptyCells: Array<{ row: number; col: number }>,
  playerId: string
): AIMove[] {
  const scoringMoves: AIMove[] = [];
  const nonScoringMoves: AIMove[] = [];

  for (const { row, col } of emptyCells) {
    for (const letter of ['S', 'O'] as const) {
      const potential = countPotentialSOS(board, row, col, letter);
      if (potential > 0) {
        scoringMoves.push({ row, col, letter });
      } else {
        nonScoringMoves.push({ row, col, letter });
      }
    }
  }

  // Limit non-scoring moves to reduce search space
  const limitedNonScoring = nonScoringMoves.slice(0, 20);

  return [...scoringMoves, ...limitedNonScoring];
}

/**
 * Board evaluation heuristic
 */
function evaluateBoard(
  board: Cell[][],
  playerId: string,
  opponentId: string
): number {
  let score = 0;
  const emptyCells = getEmptyCells(board);

  // Count future scoring opportunities
  for (const { row, col } of emptyCells) {
    for (const letter of ['S', 'O'] as const) {
      const playerSOS = countPotentialSOS(board, row, col, letter);
      score += playerSOS; // Each potential SOS is +1 for evaluation
    }
  }

  return score;
}

/**
 * Enhanced greedy for large boards where minimax is too slow
 */
function enhancedGreedy(board: Cell[][], playerId: string): AIMove {
  const emptyCells = getEmptyCells(board);

  // Priority 1: Score immediately
  let bestMove: AIMove | null = null;
  let bestScore = 0;

  for (const { row, col } of emptyCells) {
    for (const letter of ['S', 'O'] as const) {
      const score = countPotentialSOS(board, row, col, letter);
      if (score > bestScore) {
        bestScore = score;
        bestMove = { row, col, letter };
      }
    }
  }

  if (bestMove && bestScore > 0) return bestMove;

  // Priority 2: Set up future SOS while not giving opponent easy scores
  let bestFutureScore = -Infinity;
  let bestFutureMove: AIMove | null = null;

  for (const { row, col } of emptyCells) {
    for (const letter of ['S', 'O'] as const) {
      const tempBoard = cloneBoard(board);
      tempBoard[row][col].value = letter;
      tempBoard[row][col].ownerId = playerId;

      // Count opportunities this creates for us minus opportunities for opponent
      let futureScore = 0;
      const remaining = getEmptyCells(tempBoard);

      for (const { row: r2, col: c2 } of remaining.slice(0, 15)) {
        for (const l2 of ['S', 'O'] as const) {
          futureScore += countPotentialSOS(tempBoard, r2, c2, l2);
        }
      }

      // Penalize moves that let opponent score next
      const opponentImmediate = remaining.reduce((total, { row: r2, col: c2 }) => {
        return total + Math.max(
          countPotentialSOS(tempBoard, r2, c2, 'S'),
          countPotentialSOS(tempBoard, r2, c2, 'O')
        );
      }, 0);

      const netScore = futureScore - opponentImmediate * 2;

      if (netScore > bestFutureScore) {
        bestFutureScore = netScore;
        bestFutureMove = { row, col, letter };
      }
    }
  }

  if (bestFutureMove) return bestFutureMove;

  // Fallback: random
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  return { row: cell.row, col: cell.col, letter: Math.random() < 0.5 ? 'S' : 'O' };
}
