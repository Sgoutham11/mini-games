/**
 * Easy AI — Random valid move
 */

import { Cell } from '../../../../shared/events';
import { getEmptyCells } from '../../game-engine/SOSEngine';
import { AIMove } from '../AIEngine';

export function easyMove(board: Cell[][]): AIMove {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) {
    throw new Error('No empty cells available');
  }

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const letter: 'S' | 'O' = Math.random() < 0.5 ? 'S' : 'O';

  return {
    row: randomCell.row,
    col: randomCell.col,
    letter,
  };
}
