/**
 * Medium AI — Greedy strategy
 * Priority: 1. Score SOS  2. Block opponent SOS  3. Random
 */

import { Cell } from '../../../../shared/events';
import { getEmptyCells, countPotentialSOS } from '../../game-engine/SOSEngine';
import { AIMove } from '../AIEngine';

export function mediumMove(board: Cell[][], playerId: string): AIMove {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) {
    throw new Error('No empty cells available');
  }

  // 1. Try to score: find any cell+letter that creates an SOS
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

  if (bestMove && bestScore > 0) {
    return bestMove;
  }

  // 2. Try to block: find cells where opponent could score next turn
  //    Avoid placing letters that create SOS opportunities for opponent
  const safeMoves: AIMove[] = [];

  for (const { row, col } of emptyCells) {
    for (const letter of ['S', 'O'] as const) {
      // Check if this move leaves opponent with easy SOS
      const opponentScoreAfter = evaluateOpponentOpportunities(board, row, col, letter);
      if (opponentScoreAfter === 0) {
        safeMoves.push({ row, col, letter });
      }
    }
  }

  if (safeMoves.length > 0) {
    return safeMoves[Math.floor(Math.random() * safeMoves.length)];
  }

  // 3. Fallback: pick move that gives opponent fewest opportunities
  let minOpponentScore = Infinity;
  let leastBadMove: AIMove = { row: emptyCells[0].row, col: emptyCells[0].col, letter: 'S' };

  for (const { row, col } of emptyCells) {
    for (const letter of ['S', 'O'] as const) {
      const oppScore = evaluateOpponentOpportunities(board, row, col, letter);
      if (oppScore < minOpponentScore) {
        minOpponentScore = oppScore;
        leastBadMove = { row, col, letter };
      }
    }
  }

  return leastBadMove;
}

/**
 * Evaluate how many SOS opportunities exist for opponents after a hypothetical move
 */
function evaluateOpponentOpportunities(
  board: Cell[][],
  row: number,
  col: number,
  letter: 'S' | 'O'
): number {
  const size = board.length;
  // Create temp board with the move
  const tempBoard = board.map(r => r.map(c => ({ ...c })));
  tempBoard[row][col] = { row, col, value: letter, ownerId: '__temp__' };

  let totalOpportunities = 0;

  // Check all empty cells on the temp board for potential opponent SOS
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (tempBoard[r][c].value !== '') continue;
      for (const l of ['S', 'O'] as const) {
        totalOpportunities += countPotentialSOS(tempBoard, r, c, l);
      }
    }
  }

  return totalOpportunities;
}
