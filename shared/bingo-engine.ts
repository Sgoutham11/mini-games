import {
  BingoBoardSize,
  BingoGameState,
  BingoHeader,
  BingoMoveInfo,
  BingoPlayerBoard,
  BingoPlayerInfo,
} from './bingo-events';

export interface BingoMoveResult {
  valid: boolean;
  error?: string;
  gameState: BingoGameState;
  selectedNumber?: number;
  selectedBy?: BingoPlayerInfo;
  changedPatterns: Record<string, string[]>;
  gameOver: boolean;
  winnerId: string | null;
  isDraw: boolean;
}

export function getBingoHeader(size: BingoBoardSize): BingoHeader {
  if (size === 5) return 'BINGO';
  if (size === 6) return 'BINGOS';
  if (size === 7) return 'BINGOES';
  return 'BINGOESS';
}

export function getPointsToWin(size: BingoBoardSize): number {
  return size;
}

export function generateBingoBoard(size: BingoBoardSize, random = Math.random): number[][] {
  const numbers = Array.from({ length: size * size }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  const board: number[][] = [];
  for (let row = 0; row < size; row++) {
    board.push(numbers.slice(row * size, row * size + size));
  }
  return board;
}

export function createEmptyMarked(size: BingoBoardSize): boolean[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => false));
}

export function createBingoBoards(
  players: BingoPlayerInfo[],
  size: BingoBoardSize,
  random = Math.random
): Record<string, BingoPlayerBoard> {
  return Object.fromEntries(players.map(player => [
    player.id,
    {
      playerId: player.id,
      board: generateBingoBoard(size, random),
      marked: createEmptyMarked(size),
      completedPatterns: [],
    },
  ]));
}

export function createBingoGameState(
  roomCode: string,
  boardSize: BingoBoardSize,
  players: BingoPlayerInfo[],
  random = Math.random
): BingoGameState {
  const gamePlayers = players.map(player => ({
    ...player,
    status: 'PLAYING' as const,
    score: 0,
    isReady: true,
    isConnected: true,
    finishRank: undefined,
  }));

  return {
    roomCode,
    boardSize,
    header: getBingoHeader(boardSize),
    pointsToWin: getPointsToWin(boardSize),
    players: gamePlayers,
    boards: createBingoBoards(gamePlayers, boardSize, random),
    selectedNumbers: [],
    moves: [],
    currentPlayerId: gamePlayers[0]?.id ?? '',
    turnNumber: 1,
    startedAt: Date.now(),
  };
}

export function getScores(gameState: BingoGameState): Record<string, number> {
  return Object.fromEntries(gameState.players.map(player => [player.id, player.score || 0]));
}

export function getAvailableNumbers(gameState: BingoGameState): number[] {
  const selected = new Set(gameState.selectedNumbers);
  const max = gameState.boardSize * gameState.boardSize;
  return Array.from({ length: max }, (_, i) => i + 1).filter(number => !selected.has(number));
}

export function isBingoPlayerActive(player?: BingoPlayerInfo): boolean {
  return !!player && player.status === 'PLAYING' && player.isConnected;
}

export function getActiveBingoPlayers(gameState: BingoGameState): BingoPlayerInfo[] {
  return gameState.players.filter(isBingoPlayerActive);
}

export function getNextBingoPlayerId(gameState: BingoGameState, currentPlayerId: string): string {
  const activePlayers = getActiveBingoPlayers(gameState);
  if (activePlayers.length === 0) return currentPlayerId;

  const startIndex = gameState.players.findIndex(player => player.id === currentPlayerId);
  for (let offset = 1; offset <= gameState.players.length; offset++) {
    const index = (startIndex + offset + gameState.players.length) % gameState.players.length;
    const candidate = gameState.players[index];
    if (isBingoPlayerActive(candidate)) return candidate.id;
  }

  return activePlayers[0].id;
}

export function markNumberOnBoard(playerBoard: BingoPlayerBoard, selectedNumber: number): void {
  for (let row = 0; row < playerBoard.board.length; row++) {
    for (let col = 0; col < playerBoard.board[row].length; col++) {
      if (playerBoard.board[row][col] === selectedNumber) {
        playerBoard.marked[row][col] = true;
        return;
      }
    }
  }
}

export function checkNewPatterns(playerBoard: BingoPlayerBoard): string[] {
  const size = playerBoard.marked.length;
  const completed = new Set(playerBoard.completedPatterns);
  const newPatterns: string[] = [];

  for (let row = 0; row < size; row++) {
    const pattern = `ROW_${row}`;
    if (!completed.has(pattern) && playerBoard.marked[row].every(Boolean)) {
      completed.add(pattern);
      newPatterns.push(pattern);
    }
  }

  for (let col = 0; col < size; col++) {
    const pattern = `COL_${col}`;
    if (!completed.has(pattern) && playerBoard.marked.every(row => row[col])) {
      completed.add(pattern);
      newPatterns.push(pattern);
    }
  }

  const diag1 = 'DIAG_1';
  if (!completed.has(diag1)) {
    let complete = true;
    for (let i = 0; i < size; i++) complete = complete && playerBoard.marked[i][i];
    if (complete) {
      completed.add(diag1);
      newPatterns.push(diag1);
    }
  }

  const diag2 = 'DIAG_2';
  if (!completed.has(diag2)) {
    let complete = true;
    for (let i = 0; i < size; i++) complete = complete && playerBoard.marked[i][size - 1 - i];
    if (complete) {
      completed.add(diag2);
      newPatterns.push(diag2);
    }
  }

  playerBoard.completedPatterns = Array.from(completed);
  return newPatterns;
}

export function selectBingoNumber(
  gameState: BingoGameState,
  playerId: string,
  selectedNumber: number,
  autoSelected = false
): BingoMoveResult {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !isBingoPlayerActive(player)) {
    return invalid(gameState, 'Player is not active');
  }
  if (gameState.currentPlayerId !== playerId) {
    return invalid(gameState, 'Not your turn');
  }
  if (selectedNumber < 1 || selectedNumber > gameState.boardSize * gameState.boardSize) {
    return invalid(gameState, 'Invalid number');
  }
  if (gameState.selectedNumbers.includes(selectedNumber)) {
    return invalid(gameState, 'Number already selected');
  }

  const changedPatterns: Record<string, string[]> = {};
  const move: BingoMoveInfo = {
    selectedNumber,
    playerId,
    moveOrder: gameState.moves.length + 1,
    autoSelected,
    timestamp: Date.now(),
  };

  gameState.moves.push(move);
  gameState.selectedNumbers.push(selectedNumber);

  const orderedPlayers = [
    player,
    ...gameState.players.filter(p => p.id !== playerId),
  ];
  let someoneJustWon = false;

  for (const boardPlayer of orderedPlayers) {
    const board = gameState.boards[boardPlayer.id];
    if (!board) continue;

    markNumberOnBoard(board, selectedNumber);
    const newPatterns = checkNewPatterns(board);
    if (newPatterns.length === 0) continue;

    changedPatterns[boardPlayer.id] = newPatterns;
    boardPlayer.score = (boardPlayer.score || 0) + newPatterns.length;

    if (!someoneJustWon && boardPlayer.status === 'PLAYING' && boardPlayer.score >= gameState.pointsToWin) {
      boardPlayer.status = 'WON';
      boardPlayer.finishRank = nextFinishRank(gameState);
      someoneJustWon = true;
    }
  }

  const activePlayers = getActiveBingoPlayers(gameState);
  let gameOver = false;
  let winnerId: string | null = null;
  let isDraw = false;

  if (activePlayers.length <= 1) {
    if (activePlayers.length === 1) {
      const lastPlayer = activePlayers[0];
      lastPlayer.status = 'LOST';
      lastPlayer.finishRank = gameState.players.length;
    }
    gameOver = true;
    winnerId = getTopRankedWinnerId(gameState);
    isDraw = winnerId === null;
  } else if (getAvailableNumbers(gameState).length === 0) {
    gameOver = true;
    winnerId = getTopRankedWinnerId(gameState);
    isDraw = winnerId === null;
  } else {
    gameState.currentPlayerId = getNextBingoPlayerId(gameState, playerId);
    gameState.turnNumber++;
  }

  return {
    valid: true,
    gameState,
    selectedNumber,
    selectedBy: player,
    changedPatterns,
    gameOver,
    winnerId,
    isDraw,
  };
}

export function autoSelectBingoNumber(
  gameState: BingoGameState,
  playerId: string,
  random = Math.random
): BingoMoveResult {
  const available = getAvailableNumbers(gameState);
  if (available.length === 0) return invalid(gameState, 'No numbers available');
  const selectedNumber = available[Math.floor(random() * available.length)];
  return selectBingoNumber(gameState, playerId, selectedNumber, true);
}

export function markBingoPlayerQuit(gameState: BingoGameState, playerId: string): void {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;
  player.status = 'QUIT';
  player.isConnected = false;
  player.isReady = false;
  player.isHost = false;
}

export function resolveBingoQuitOutcome(
  gameState: BingoGameState
): { gameOver: boolean; winnerId: string | null; isDraw: boolean } {
  const activePlayers = getActiveBingoPlayers(gameState);
  if (activePlayers.length > 1) return { gameOver: false, winnerId: null, isDraw: false };

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const alreadyHasWinner = gameState.players.some(p => p.status === 'WON');
    if (!alreadyHasWinner) {
      winner.status = 'WON';
      winner.finishRank = nextFinishRank(gameState);
    } else {
      winner.status = 'LOST';
      winner.finishRank = gameState.players.length;
    }
  }

  const winnerId = getTopRankedWinnerId(gameState);
  return { gameOver: true, winnerId, isDraw: winnerId === null };
}

function nextFinishRank(gameState: BingoGameState): number {
  return gameState.players.filter(player => player.status === 'WON' && player.finishRank).length + 1;
}

function getTopRankedWinnerId(gameState: BingoGameState): string | null {
  const winner = gameState.players
    .filter(player => player.status === 'WON')
    .sort((a, b) => (a.finishRank ?? Number.MAX_SAFE_INTEGER) - (b.finishRank ?? Number.MAX_SAFE_INTEGER))[0];
  return winner?.id ?? null;
}

function invalid(gameState: BingoGameState, error: string): BingoMoveResult {
  return {
    valid: false,
    error,
    gameState,
    changedPatterns: {},
    gameOver: false,
    winnerId: null,
    isDraw: false,
  };
}
