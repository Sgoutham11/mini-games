import {
  createBingoGameState,
  getAvailableNumbers,
  getNextBingoPlayerId,
  selectBingoNumber,
} from '../../../shared/bingo-engine';
import { BingoPlayerInfo } from '../../../shared/bingo-events';

function players(count = 2): BingoPlayerInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: ['#00f0ff', '#ffaa00', '#00ff88', '#b44aff'][i] ?? '#ffffff',
    status: 'WAITING',
    isBot: false,
    isReady: true,
    isConnected: true,
    isHost: i === 0,
    score: 0,
  }));
}

describe('Bingo engine', () => {
  test('creates shuffled boards with expected size and number range', () => {
    const state = createBingoGameState('ROOM01', 5, players(2), () => 0.4);
    const board = state.boards.p1.board.flat();

    expect(state.header).toBe('BINGO');
    expect(state.pointsToWin).toBe(5);
    expect(board).toHaveLength(25);
    expect(new Set(board).size).toBe(25);
    expect(Math.min(...board)).toBe(1);
    expect(Math.max(...board)).toBe(25);
  });

  test('selected number is global and marks all boards', () => {
    const state = createBingoGameState('ROOM01', 5, players(2));
    state.boards.p1.board[0][0] = 7;
    state.boards.p2.board = [
      [1, 2, 3, 4, 5],
      [6, 8, 9, 10, 11],
      [12, 13, 14, 7, 15],
      [16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25],
    ];
    state.boards.p2.board[2][3] = 7;

    const result = selectBingoNumber(state, 'p1', 7);

    expect(result.valid).toBe(true);
    expect(state.selectedNumbers).toEqual([7]);
    expect(state.boards.p1.marked[0][0]).toBe(true);
    expect(state.boards.p2.marked[2][3]).toBe(true);
  });

  test('completed row adds one point once', () => {
    const state = createBingoGameState('ROOM01', 5, players(2));
    state.currentPlayerId = 'p1';
    state.boards.p1.board[0] = [1, 2, 3, 4, 5];
    state.boards.p1.marked[0] = [true, true, true, true, false];

    const first = selectBingoNumber(state, 'p1', 5);
    expect(first.valid).toBe(true);
    expect(state.players.find(p => p.id === 'p1')?.score).toBe(1);
    expect(state.boards.p1.completedPatterns).toContain('ROW_0');

    state.currentPlayerId = 'p1';
    const second = selectBingoNumber(state, 'p1', 6);
    expect(second.valid).toBe(true);
    expect(state.players.find(p => p.id === 'p1')?.score).toBe(1);
  });

  test('rejects already selected numbers and out-of-turn moves', () => {
    const state = createBingoGameState('ROOM01', 5, players(2));

    expect(selectBingoNumber(state, 'p2', 1).valid).toBe(false);
    expect(selectBingoNumber(state, 'p1', 1).valid).toBe(true);
    state.currentPlayerId = 'p2';

    const duplicate = selectBingoNumber(state, 'p2', 1);
    expect(duplicate.valid).toBe(false);
    expect(duplicate.error).toBe('Number already selected');
  });

  test('turn order skips players who are no longer playing', () => {
    const state = createBingoGameState('ROOM01', 5, players(4));
    state.players[1].status = 'WON';
    state.players[2].status = 'QUIT';
    state.players[2].isConnected = false;

    expect(getNextBingoPlayerId(state, 'p1')).toBe('p4');
  });

  test('available numbers excludes selected numbers', () => {
    const state = createBingoGameState('ROOM01', 5, players(2));
    state.selectedNumbers = [1, 2, 3];

    const available = getAvailableNumbers(state);
    expect(available).not.toContain(1);
    expect(available).not.toContain(2);
    expect(available).not.toContain(3);
    expect(available).toHaveLength(22);
  });
});
