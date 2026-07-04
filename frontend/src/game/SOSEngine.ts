/**
 * SOS Game Engine — Client-side (mirrors server SOSEngine)
 */
import type { Cell, ScoredLine } from '@shared/events';
import { Direction } from '@shared/enums';

export interface PlacementResult {
  valid: boolean;
  scoredLines: ScoredLine[];
  scoreGained: number;
  bonusTurn: boolean;
  gameOver: boolean;
  error?: string;
}

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

export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map(row => row.map(cell => ({ ...cell })));
}

export function placeLetter(
  board: Cell[][],
  row: number,
  col: number,
  letter: 'S' | 'O',
  playerId: string
): PlacementResult {
  const size = board.length;
  if (row < 0 || row >= size || col < 0 || col >= size) {
    return { valid: false, scoredLines: [], scoreGained: 0, bonusTurn: false, gameOver: false, error: 'Out of bounds' };
  }
  if (board[row][col].value !== '') {
    return { valid: false, scoredLines: [], scoreGained: 0, bonusTurn: false, gameOver: false, error: 'Cell occupied' };
  }

  board[row][col].value = letter;
  board[row][col].ownerId = playerId;

  const scoredLines = detectSOS(board, row, col, playerId);
  const scoreGained = scoredLines.length;
  const bonusTurn = scoreGained > 0;
  const gameOver = isBoardFull(board);

  return { valid: true, scoredLines, scoreGained, bonusTurn, gameOver };
}

export function detectSOS(board: Cell[][], row: number, col: number, playerId: string): ScoredLine[] {
  const scoredLines: ScoredLine[] = [];
  const size = board.length;

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
    if (getVal(row, col) === 'S' && getVal(row + dr, col + dc) === 'O' && getVal(row + 2 * dr, col + 2 * dc) === 'S') {
      scoredLines.push({
        cells: [{ row, col }, { row: row + dr, col: col + dc }, { row: row + 2 * dr, col: col + 2 * dc }],
        playerId,
        direction: dir,
      });
    }
    if (getVal(row, col) === 'O' && getVal(row - dr, col - dc) === 'S' && getVal(row + dr, col + dc) === 'S') {
      scoredLines.push({
        cells: [{ row: row - dr, col: col - dc }, { row, col }, { row: row + dr, col: col + dc }],
        playerId,
        direction: dir,
      });
    }
    if (getVal(row, col) === 'S' && getVal(row - dr, col - dc) === 'O' && getVal(row - 2 * dr, col - 2 * dc) === 'S') {
      scoredLines.push({
        cells: [{ row: row - 2 * dr, col: col - 2 * dc }, { row: row - dr, col: col - dc }, { row, col }],
        playerId,
        direction: dir,
      });
    }
  }

  return scoredLines;
}

export function isBoardFull(board: Cell[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell.value === '') return false;
    }
  }
  return true;
}

export function getEmptyCells(board: Cell[][]): Array<{ row: number; col: number }> {
  const empty: Array<{ row: number; col: number }> = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell.value === '') empty.push({ row: cell.row, col: cell.col });
    }
  }
  return empty;
}

export function getWinner(scores: Record<string, number>): { winnerId: string | null; isDraw: boolean } {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { winnerId: null, isDraw: true };
  const maxScore = Math.max(...entries.map(([, s]) => s));
  const winners = entries.filter(([, s]) => s === maxScore);
  if (winners.length > 1) return { winnerId: null, isDraw: true };
  return { winnerId: winners[0][0], isDraw: false };
}

export function countPotentialSOS(board: Cell[][], row: number, col: number, letter: 'S' | 'O'): number {
  const tempBoard = cloneBoard(board);
  tempBoard[row][col].value = letter;
  return detectSOS(tempBoard, row, col, '__temp__').length;
}
