import Phaser from 'phaser';
import { AIDifficulty, PLAYER_COLORS, TURN_TIMER_SECONDS } from '@shared/enums';
import type { Cell, ScoredLine, PlayerInfo, GameState } from '@shared/events';
import { Theme, GameConfig } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { GridBoard, LetterSelector, PlayerCard } from '../components/GridBoard';
import { createBoard, placeLetter, getWinner } from '../game/SOSEngine';
import { getAIMove, getAIMoveDelay } from '../game/AIEngine';
import {
  socketService, ServerEvents,
  type BoardUpdatedPayload, type TurnChangedPayload,
  type ScoreUpdatedPayload, type GameEndedPayload, type TimerUpdatedPayload,
} from '../sockets/SocketService';
import { telegram } from '../telegram/TelegramService';

export class GameScene extends Phaser.Scene {
  private board!: GridBoard;
  private letterSelector!: LetterSelector;
  private playerCards: PlayerCard[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private pendingCell: { row: number; col: number } | null = null;

  // Local game state
  private localBoard: Cell[][] = [];
  private localPlayers: PlayerInfo[] = [];
  private localScores: Record<string, number> = {};
  private currentPlayerId = '';
  private allScoredLines: ScoredLine[] = [];
  private timerRemaining = TURN_TIMER_SECONDS;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private aiThinking = false;
  private onlineHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);
    this.playerCards = [];
    this.pendingCell = null;
    this.aiThinking = false;
    this.cleanupOnlineHandlers();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());

    this.initGameState();
    this.buildUI(width, height);
    this.setupModeHandlers();

    if (gameData.mode !== 'online') {
      this.startLocalTimer();
    }

    if (gameData.mode === 'single' && this.currentPlayerId !== gameData.playerId) {
      this.scheduleAIMove();
    }
  }

  private initGameState(): void {
    if (gameData.mode === 'online' && gameData.gameState) {
      const gs = gameData.gameState;
      this.localBoard = gs.board;
      this.localPlayers = gs.players;
      this.localScores = { ...gs.scores };
      this.currentPlayerId = gs.currentPlayerId;
      this.allScoredLines = [...gs.scoredLines];
      gameData.roomCode = gs.roomCode;
      if (!gs.players.some(p => p.id === gameData.playerId)) {
        gameData.playerId = gs.players.find(p => p.name === gameData.playerName)?.id ?? gameData.playerId;
      }
      return;
    }

    const gridSize = gameData.gridSize || GameConfig.defaultGridSize;
    this.localBoard = createBoard(gridSize);

    if (gameData.mode === 'single') {
      this.localPlayers = [
        { id: gameData.playerId, name: gameData.playerName, color: PLAYER_COLORS[0], isReady: true, isConnected: true, isHost: true },
        { id: 'ai_bot', name: 'AI', color: PLAYER_COLORS[1], isReady: true, isConnected: true, isHost: false },
      ];
    } else {
      this.localPlayers = (gameData.localPlayers ?? []).map((p, i) => ({
        id: p.id, name: p.name, color: p.color, isReady: true, isConnected: true, isHost: i === 0,
      }));
    }

    this.localScores = {};
    this.localPlayers.forEach(p => { this.localScores[p.id] = 0; });
    this.currentPlayerId = this.localPlayers[0].id;
    this.allScoredLines = [];
  }

  private buildUI(width: number, height: number): void {
    // Top bar controls
    const homeBtn = NeonUI.createIconButton(this, width - 140, 30, 'home');
    homeBtn.on('pointerdown', () => this.goHome());

    const resetBtn = NeonUI.createIconButton(this, width - 100, 30, 'refresh');
    resetBtn.on('pointerdown', () => this.scene.restart());

    // Player cards
    const cardColumns = Math.min(this.localPlayers.length, 2);
    const cardW = (width - 60) / cardColumns;
    this.localPlayers.forEach((p, i) => {
      const col = i % cardColumns;
      const row = Math.floor(i / cardColumns);
      const card = new PlayerCard(this, 20 + col * (cardW + 10), 55 + row * 76, cardW, 70);
      this.playerCards.push(card);
    });

    this.updatePlayerCards();

    // Timer
    const timerY = this.localPlayers.length > 2 ? 210 : 140;
    this.timerText = this.add.text(width / 2, timerY, `${this.timerRemaining}s`, {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#888899',
    }).setOrigin(0.5);

    // Grid board
    const gridSize = this.localBoard.length;
    const boardY = height / 2 + (this.localPlayers.length > 2 ? 60 : 20);
    this.board = new GridBoard(this, width / 2, boardY, gridSize, width - 40);
    this.board.updateFromBoard(this.localBoard, this.localPlayers);
    this.board.setAllScoredLines(this.allScoredLines, this.localPlayers);

    this.board.setCellClickHandler((row, col) => {
      if (this.localBoard[row][col].value !== '') return;
      if (this.aiThinking) return;

      const canPlay =
        gameData.mode === 'local' ||
        (gameData.mode === 'single' && this.currentPlayerId === gameData.playerId) ||
        (gameData.mode === 'online' && this.currentPlayerId === gameData.playerId);

      if (!canPlay) return;

      this.pendingCell = { row, col };
      const selectorPosition = this.board.getCellWorldPosition(row, col);
      this.letterSelector.showAt(
        this.getSafeLetterSelectorX(selectorPosition.x, width),
        selectorPosition.y,
        this.getCurrentPlayerColor()
      );
    });

    // Letter selector (centered on board)
    this.letterSelector = new LetterSelector(this, width / 2 + 60, height / 2);
    this.letterSelector.hide();
    this.letterSelector.setSelectHandler((letter) => {
      if (!this.pendingCell) return;
      this.makeLocalMove(this.pendingCell.row, this.pendingCell.col, letter);
      this.pendingCell = null;
    });
  }

  private setupModeHandlers(): void {
    if (gameData.mode !== 'online') return;

    this.addOnlineHandler(ServerEvents.BOARD_UPDATED, (payload: unknown) => {
      const data = payload as BoardUpdatedPayload;
      this.localBoard = data.board;
      this.allScoredLines.push(...data.scoredLines);
      this.board.updateFromBoard(data.board, this.localPlayers);
      this.board.addScoredLines(data.scoredLines, this.localPlayers);
      this.board.animatePlacement(data.lastMove.row, data.lastMove.col);
      this.syncOnlineSnapshot();
      telegram.haptic('medium');
    });

    this.addOnlineHandler(ServerEvents.SCORE_UPDATED, (payload: unknown) => {
      const data = payload as ScoreUpdatedPayload;
      this.localScores = data.scores;
      this.updatePlayerCards();
      this.syncOnlineSnapshot();
    });

    this.addOnlineHandler(ServerEvents.TURN_CHANGED, (payload: unknown) => {
      const data = payload as TurnChangedPayload;
      this.currentPlayerId = data.currentPlayerId;
      this.updatePlayerCards();
      this.syncOnlineSnapshot(data.turnNumber);
    });

    this.addOnlineHandler(ServerEvents.TIMER_UPDATED, (payload: unknown) => {
      const data = payload as TimerUpdatedPayload;
      this.timerRemaining = data.remaining;
      this.timerText.setText(`${data.remaining}s`);
      if (data.remaining <= 10) this.timerText.setColor('#ff4466');
      else this.timerText.setColor('#888899');
    });

    this.addOnlineHandler(ServerEvents.GAME_ENDED, (payload: unknown) => {
      const data = payload as GameEndedPayload;
      this.goToResult(data.scores, data.winnerId, data.isDraw);
    });
  }

  private addOnlineHandler(event: string, handler: (...args: unknown[]) => void): void {
    this.onlineHandlers.push({ event, handler });
    socketService.on(event, handler);
  }

  private cleanupOnlineHandlers(): void {
    this.onlineHandlers.forEach(({ event, handler }) => socketService.off(event, handler));
    this.onlineHandlers = [];
  }

  private syncOnlineSnapshot(turnNumber = gameData.gameState?.turnNumber ?? 1): void {
    if (gameData.mode !== 'online') return;

    gameData.gameState = {
      roomCode: gameData.roomCode ?? gameData.gameState?.roomCode ?? '',
      board: this.localBoard,
      players: this.localPlayers,
      scores: this.localScores,
      currentPlayerId: this.currentPlayerId,
      turnNumber,
      scoredLines: this.allScoredLines,
      moveHistory: gameData.gameState?.moveHistory ?? [],
      startedAt: gameData.gameState?.startedAt ?? Date.now(),
      gridSize: this.localBoard.length,
    };
  }

  private makeLocalMove(row: number, col: number, letter: 'S' | 'O'): void {
    if (gameData.mode === 'online') {
      if (this.currentPlayerId !== gameData.playerId) return;
      const roomCode = gameData.roomCode ?? gameData.gameState?.roomCode;
      if (!roomCode) return;
      socketService.makeMove({ roomCode, row, col, letter });
      return;
    }

    const playerId = gameData.mode === 'local' || gameData.mode === 'single'
      ? this.currentPlayerId
      : gameData.playerId;
    const result = placeLetter(this.localBoard, row, col, letter, playerId);
    if (!result.valid) return;

    this.localScores[playerId] = (this.localScores[playerId] || 0) + result.scoreGained;
    this.allScoredLines.push(...result.scoredLines);

    this.board.updateFromBoard(this.localBoard, this.localPlayers);
    this.board.addScoredLines(result.scoredLines, this.localPlayers);
    this.board.animatePlacement(row, col);
    this.updatePlayerCards();
    telegram.haptic('medium');

    if (result.gameOver) {
      const { winnerId, isDraw } = getWinner(this.localScores);
      this.time.delayedCall(800, () => this.goToResult(this.localScores, winnerId, isDraw));
      return;
    }

    if (!result.bonusTurn) {
      this.advanceTurn();
    }

    this.resetLocalTimer();

    if (gameData.mode === 'single' && this.currentPlayerId === 'ai_bot') {
      this.scheduleAIMove();
    }
  }

  private advanceTurn(): void {
    const idx = this.localPlayers.findIndex(p => p.id === this.currentPlayerId);
    this.currentPlayerId = this.localPlayers[(idx + 1) % this.localPlayers.length].id;
    this.updatePlayerCards();
  }

  private scheduleAIMove(): void {
    this.aiThinking = true;
    const delay = getAIMoveDelay();
    this.time.delayedCall(delay, () => {
      const difficulty = (gameData.aiDifficulty as AIDifficulty) || AIDifficulty.MEDIUM;
      const move = getAIMove(this.localBoard, difficulty, 'ai_bot', gameData.playerId);
      this.aiThinking = false;
      this.makeLocalMove(move.row, move.col, move.letter);
    });
  }

  private getLocalCurrentPlayer(): PlayerInfo | undefined {
    return this.localPlayers.find(p => p.id === this.currentPlayerId);
  }

  private getCurrentPlayerColor(): number {
    const color = this.getLocalCurrentPlayer()?.color ?? PLAYER_COLORS[0];
    return parseInt(color.replace('#', ''), 16);
  }

  private getSafeLetterSelectorX(x: number, width: number): number {
    const selectorHalfWidth = 68;
    const screenPadding = 12;
    return Phaser.Math.Clamp(x, selectorHalfWidth + screenPadding, width - selectorHalfWidth - screenPadding);
  }

  private updatePlayerCards(): void {
    this.localPlayers.forEach((p, i) => {
      if (!this.playerCards[i]) return;
      const isActive = p.id === this.currentPlayerId;
      const status = isActive
        ? (p.id === 'ai_bot' && this.aiThinking ? 'THINKING...' : 'YOUR TURN')
        : 'WAITING';
      this.playerCards[i].update(p.name, this.localScores[p.id] || 0, status, isActive, p.color);
    });
  }

  private startLocalTimer(): void {
    this.timerRemaining = TURN_TIMER_SECONDS;
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.timerRemaining--;
        this.timerText.setText(`${this.timerRemaining}s`);
        if (this.timerRemaining <= 10) this.timerText.setColor('#ff4466');
        if (this.timerRemaining <= 0) {
          this.advanceTurn();
          this.resetLocalTimer();
          if (gameData.mode === 'single' && this.currentPlayerId === 'ai_bot') {
            this.scheduleAIMove();
          }
        }
      },
    });
  }

  private resetLocalTimer(): void {
    this.timerRemaining = TURN_TIMER_SECONDS;
    this.timerText.setColor('#888899');
  }

  private goToResult(scores: Record<string, number>, winnerId: string | null, isDraw: boolean): void {
    gameData.gameState = {
      roomCode: gameData.roomCode ?? '',
      board: this.localBoard,
      players: this.localPlayers,
      scores,
      currentPlayerId: this.currentPlayerId,
      turnNumber: 0,
      scoredLines: this.allScoredLines,
      moveHistory: [],
      startedAt: Date.now(),
      gridSize: this.localBoard.length,
    };
    this.scene.start('ResultScene', { scores, winnerId, isDraw });
  }

  private goHome(): void {
    if (gameData.mode === 'online' && gameData.roomCode) {
      socketService.leaveRoom(gameData.roomCode);
      socketService.disconnect();
      gameData.roomCode = undefined;
      gameData.room = undefined;
      gameData.gameState = undefined;
      gameData.isHost = undefined;
      gameData.playerId = '';
    }
    this.scene.start('MenuScene');
  }

  private cleanupScene(): void {
    this.timerEvent?.destroy();
    this.timerEvent = null;
    this.cleanupOnlineHandlers();
  }

  shutdown(): void {
    this.cleanupScene();
  }
}
