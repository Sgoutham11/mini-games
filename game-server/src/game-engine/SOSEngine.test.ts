import { describe, it, expect } from '@jest/globals';
import {
  createBoard, placeLetter, detectSOS, isBoardFull, getWinner, countPotentialSOS,
} from './SOSEngine';

describe('SOSEngine', () => {
  describe('createBoard', () => {
    it('creates empty board of given size', () => {
      const board = createBoard(5);
      expect(board.length).toBe(5);
      expect(board[0].length).toBe(5);
      expect(board[0][0].value).toBe('');
    });
  });

  describe('detectSOS', () => {
    it('detects horizontal SOS', () => {
      const board = createBoard(5);
      board[0][0].value = 'S'; board[0][0].ownerId = 'p1';
      board[0][1].value = 'O'; board[0][1].ownerId = 'p1';
      placeLetter(board, 0, 2, 'S', 'p1');
      const lines = detectSOS(board, 0, 2, 'p1');
      expect(lines.length).toBe(1);
      expect(lines[0].direction).toBe('horizontal');
    });

    it('detects vertical SOS', () => {
      const board = createBoard(5);
      board[0][0].value = 'S'; board[0][0].ownerId = 'p1';
      board[1][0].value = 'O'; board[1][0].ownerId = 'p1';
      placeLetter(board, 2, 0, 'S', 'p1');
      const lines = detectSOS(board, 2, 0, 'p1');
      expect(lines.length).toBe(1);
      expect(lines[0].direction).toBe('vertical');
    });

    it('detects overlapping SOS patterns', () => {
      const board = createBoard(5);
      // S O S O S — placing final S should score multiple
      board[0][0].value = 'S'; board[0][0].ownerId = 'p1';
      board[0][1].value = 'O'; board[0][1].ownerId = 'p1';
      board[0][2].value = 'S'; board[0][2].ownerId = 'p1';
      board[0][3].value = 'O'; board[0][3].ownerId = 'p1';
      const result = placeLetter(board, 0, 4, 'S', 'p1');
      expect(result.scoreGained).toBeGreaterThanOrEqual(1);
      expect(result.bonusTurn).toBe(true);
    });

    it('detects diagonal SOS', () => {
      const board = createBoard(5);
      board[0][0].value = 'S'; board[0][0].ownerId = 'p1';
      board[1][1].value = 'O'; board[1][1].ownerId = 'p1';
      placeLetter(board, 2, 2, 'S', 'p1');
      const lines = detectSOS(board, 2, 2, 'p1');
      expect(lines.some((l: { direction: string }) => l.direction === 'diagonal-right')).toBe(true);
    });
  });

  describe('placeLetter', () => {
    it('rejects occupied cells', () => {
      const board = createBoard(3);
      placeLetter(board, 0, 0, 'S', 'p1');
      const result = placeLetter(board, 0, 0, 'O', 'p2');
      expect(result.valid).toBe(false);
    });

    it('grants bonus turn on scoring', () => {
      const board = createBoard(3);
      board[0][0].value = 'S'; board[0][0].ownerId = 'p1';
      board[0][1].value = 'O'; board[0][1].ownerId = 'p1';
      const result = placeLetter(board, 0, 2, 'S', 'p1');
      expect(result.valid).toBe(true);
      expect(result.bonusTurn).toBe(true);
      expect(result.scoreGained).toBe(1);
    });

    it('detects game over when board is full', () => {
      const board = createBoard(2);
      placeLetter(board, 0, 0, 'S', 'p1');
      placeLetter(board, 0, 1, 'O', 'p2');
      placeLetter(board, 1, 0, 'O', 'p1');
      const result = placeLetter(board, 1, 1, 'S', 'p2');
      expect(result.gameOver).toBe(true);
    });
  });

  describe('getWinner', () => {
    it('returns winner with highest score', () => {
      const result = getWinner({ p1: 3, p2: 1 });
      expect(result.winnerId).toBe('p1');
      expect(result.isDraw).toBe(false);
    });

    it('returns draw on tie', () => {
      const result = getWinner({ p1: 2, p2: 2 });
      expect(result.isDraw).toBe(true);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('countPotentialSOS', () => {
    it('counts potential SOS without mutating board', () => {
      const board = createBoard(3);
      board[0][0].value = 'S';
      board[0][1].value = 'O';
      const count = countPotentialSOS(board, 0, 2, 'S');
      expect(count).toBe(1);
      expect(board[0][2].value).toBe('');
    });
  });
});
