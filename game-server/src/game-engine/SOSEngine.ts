/**
 * SOS Game Engine — Core game logic
 * Runs on both server (authoritative) and client (local/single-player)
 */

import { Cell, ScoredLine, MoveInfo } from '../../../shared/events';
import { Direction } from '../../../shared/enums';

export interface PlacementResult {
  valid: boolean;
  scoredLines: ScoredLine[];
  scoreGained: number;
  bonusTurn: boolean;
  gameOver: boolean;
  error?: string;
}

/**
 * Create an empty board of given size
 */
export function createBoard(size: number): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    board[r] = [];
    for (let c = 0; c < size; c++) {
      board[r][c] = { row: r, col: c, value: '', ownerId: null };
    }
  }
  return board;
}

/**
 * Clone a board (deep copy)
 */
export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map(row =>
    row.map(cell => ({ ...cell }))
  );
}

/**
 * Place a letter on the board and detect SOS formations
 */
export function placeLetter(
  board: Cell[][],
  row: number,
  col: number,
  letter: 'S' | 'O',
  playerId: string
): PlacementResult {
  const size = board.length;

  // Validate bounds
  if (row < 0 || row >= size || col < 0 || col >= size) {
    return { valid: false, scoredLines: [], scoreGained: 0, bonusTurn: false, gameOver: false, error: 'Out of bounds' };
  }

  // Validate cell is empty
  if (board[row][col].value !== '') {
    return { valid: false, scoredLines: [], scoreGained: 0, bonusTurn: false, gameOver: false, error: 'Cell occupied' };
  }

  // Place the letter
  board[row][col].value = letter;
  board[row][col].ownerId = playerId;

  // Detect SOS formations
  const scoredLines = detectSOS(board, row, col, playerId);
  const scoreGained = scoredLines.length;
  const bonusTurn = scoreGained > 0;
  const gameOver = isBoardFull(board);

  return { valid: true, scoredLines, scoreGained, bonusTurn, gameOver };
}

/**
 * Detect all SOS formations involving the cell at (row, col).
 *
 * For each of 4 axes (horizontal, vertical, diag-left, diag-right):
 *   Check 3 positions: cell is START, MIDDLE, or END of "S-O-S"
 */
export function detectSOS(
  board: Cell[][],
  row: number,
  col: number,
  playerId: string
): ScoredLine[] {
  const scoredLines: ScoredLine[] = [];
  const size = board.length;

  // Direction vectors for the 4 axes
  const axes: Array<{ dr: number; dc: number; dir: Direction }> = [
    { dr: 0, dc: 1, dir: Direction.HORIZONTAL },
    { dr: 1, dc: 0, dir: Direction.VERTICAL },
    { dr: 1, dc: 1, dir: Direction.DIAGONAL_RIGHT },
    { dr: 1, dc: -1, dir: Direction.DIAGONAL_LEFT },
  ];

  const getVal = (r: number, c: number): string => {
    if (r < 0 || r >= size || c < 0 || c >= size) return '';
    return board[r][c].value;
  };

  for (const { dr, dc, dir } of axes) {
    // Case 1: Current cell is START of SOS (cell=S, +1=O, +2=S)
    if (
      getVal(row, col) === 'S' &&
      getVal(row + dr, col + dc) === 'O' &&
      getVal(row + 2 * dr, col + 2 * dc) === 'S'
    ) {
      scoredLines.push({
        cells: [
          { row, col },
          { row: row + dr, col: col + dc },
          { row: row + 2 * dr, col: col + 2 * dc },
        ],
        playerId,
        direction: dir,
      });
    }

    // Case 2: Current cell is MIDDLE of SOS (cell=O, -1=S, +1=S)
    if (
      getVal(row, col) === 'O' &&
      getVal(row - dr, col - dc) === 'S' &&
      getVal(row + dr, col + dc) === 'S'
    ) {
      scoredLines.push({
        cells: [
          { row: row - dr, col: col - dc },
          { row, col },
          { row: row + dr, col: col + dc },
        ],
        playerId,
        direction: dir,
      });
    }

    // Case 3: Current cell is END of SOS (-2=S, -1=O, cell=S)
    if (
      getVal(row, col) === 'S' &&
      getVal(row - dr, col - dc) === 'O' &&
      getVal(row - 2 * dr, col - 2 * dc) === 'S'
    ) {
      scoredLines.push({
        cells: [
          { row: row - 2 * dr, col: col - 2 * dc },
          { row: row - dr, col: col - dc },
          { row, col },
        ],
        playerId,
        direction: dir,
      });
    }
  }

  return scoredLines;
}

/**
 * Check if every cell on the board has a value
 */
export function isBoardFull(board: Cell[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell.value === '') return false;
    }
  }
  return true;
}

/**
 * Get list of empty cells
 */
export function getEmptyCells(board: Cell[][]): Array<{ row: number; col: number }> {
  const empty: Array<{ row: number; col: number }> = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell.value === '') {
        empty.push({ row: cell.row, col: cell.col });
      }
    }
  }
  return empty;
}

/**
 * Determine winner(s) from scores
 */
export function getWinner(scores: Record<string, number>): {
  winnerId: string | null;
  isDraw: boolean;
} {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { winnerId: null, isDraw: true };

  const maxScore = Math.max(...entries.map(([, s]) => s));
  const winners = entries.filter(([, s]) => s === maxScore);

  if (winners.length > 1) {
    return { winnerId: null, isDraw: true };
  }

  return { winnerId: winners[0][0], isDraw: false };
}

/**
 * Count how many SOS would be formed by placing `letter` at (row, col)
 * without mutating the board. Used by AI.
 */
export function countPotentialSOS(
  board: Cell[][],
  row: number,
  col: number,
  letter: 'S' | 'O'
): number {
  const tempBoard = cloneBoard(board);
  tempBoard[row][col].value = letter;
  return detectSOS(tempBoard, row, col, '__temp__').length;
}
