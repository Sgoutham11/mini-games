import { describe, it, expect } from 'vitest';
import { createBoard, placeLetter, detectSOS, getWinner } from './SOSEngine';

describe('Client SOSEngine', () => {
  it('creates and plays a basic game', () => {
    const board = createBoard(3);
    const r1 = placeLetter(board, 0, 0, 'S', 'p1');
    expect(r1.valid).toBe(true);

    board[0][1].value = 'O';
    board[0][1].ownerId = 'p1';
    const r2 = placeLetter(board, 0, 2, 'S', 'p1');
    expect(r2.scoreGained).toBe(1);
    expect(r2.bonusTurn).toBe(true);
  });

  it('detects multiple overlapping SOS', () => {
    const board = createBoard(5);
    board[2][0].value = 'S'; board[2][0].ownerId = 'p1';
    board[2][1].value = 'O'; board[2][1].ownerId = 'p1';
    board[2][2].value = 'S'; board[2][2].ownerId = 'p1';
    board[2][3].value = 'O'; board[2][3].ownerId = 'p1';
    const result = placeLetter(board, 2, 4, 'S', 'p1');
    expect(result.scoreGained).toBeGreaterThanOrEqual(1);
  });

  it('determines winner correctly', () => {
    const { winnerId, isDraw } = getWinner({ p1: 5, p2: 3 });
    expect(winnerId).toBe('p1');
    expect(isDraw).toBe(false);
  });
});
