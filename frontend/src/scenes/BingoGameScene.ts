import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { BingoBoardView } from '../components/BingoBoard';
import {
  BingoServerEvents,
  socketService,
  type BingoBoardUpdatedPayload,
  type BingoGameEndedPayload,
  type BingoPlayerLeftPayload,
  type BingoScoreUpdatedPayload,
  type BingoTimerUpdatedPayload,
  type BingoTurnChangedPayload,
} from '../sockets/SocketService';
import type { BingoGameState, BingoPlayerInfo } from '@shared/bingo-events';
import { telegram } from '../telegram/TelegramService';

export class BingoGameScene extends Phaser.Scene {
  private gameState!: BingoGameState;
  private board!: BingoBoardView;
  private playerTexts: Phaser.GameObjects.Text[] = [];
  private ownProgressText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private lastMoveText!: Phaser.GameObjects.Text;
  private handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  constructor() {
    super({ key: 'BingoGameScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);
    this.gameState = gameData.bingoGameState!;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupHandlers());

    const homeBtn = NeonUI.createIconButton(this, width - 52, 30, 'home');
    homeBtn.on('pointerdown', () => this.goHome());

    NeonUI.createTitle(this, width / 2, 70, 'Bingo Battle', '22px');
    NeonUI.createSubtitle(this, width / 2, 100, 'Select one number on your turn');

    this.buildPlayerCards(width);
    const playerRows = Math.ceil(this.gameState.players.length / 2);
    const timerY = 126 + playerRows * 54 + 20;
    this.timerText = this.add.text(width / 2, timerY, '15s', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#888899',
    }).setOrigin(0.5);
    this.lastMoveText = this.add.text(width / 2, timerY + 26, 'Last: none', {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: '#888899',
    }).setOrigin(0.5);

    this.ownProgressText = this.add.text(width / 2, timerY + 54, '', {
      fontFamily: Theme.fontFamily,
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.ownProgressText.setResolution(window.devicePixelRatio || 2);

    const boardTop = timerY + 82;
    const boardBottom = height - 92;
    const boardPx = Math.min(width - 56, 360, boardBottom - boardTop);
    const boardY = (boardTop + boardBottom) / 2;
    this.board = new BingoBoardView(this, width / 2, boardY, this.gameState.boardSize, boardPx);
    this.board.setNumberClickHandler(number => this.selectNumber(number));

    const quitBtn = NeonUI.createButton(this, width / 2, height - 48, 130, 40, 'Quit');
    quitBtn.on('pointerdown', () => this.goHome());

    this.setupSocketHandlers();
    this.render();
  }

  private buildPlayerCards(width: number): void {
    this.playerTexts.forEach(text => text.destroy());
    this.playerTexts = [];
    const cardW = (width - 56) / 2;
    this.gameState.players.forEach((player, i) => {
      const x = 20 + (i % 2) * (cardW + 16);
      const y = 126 + Math.floor(i / 2) * 54;
      const bg = this.add.graphics();
      bg.fillStyle(Theme.bgPanel, 0.94);
      bg.fillRoundedRect(x, y, cardW, 46, 9);
      bg.lineStyle(1.5, parseInt(player.color.replace('#', ''), 16), 0.7);
      bg.strokeRoundedRect(x, y, cardW, 46, 9);

      const text = this.add.text(x + 10, y + 7, '', {
        fontFamily: Theme.fontFamily,
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
        lineSpacing: 3,
      });
      text.setResolution(window.devicePixelRatio || 2);
      this.playerTexts.push(text);
    });
  }

  private setupSocketHandlers(): void {
    this.addHandler(BingoServerEvents.BOARD_UPDATED, (payload: unknown) => {
      const data = payload as BingoBoardUpdatedPayload;
      this.gameState = data.gameState;
      gameData.bingoGameState = data.gameState;
      this.lastMoveText.setText(`${data.autoSelected ? 'Auto' : 'Last'}: ${data.selectedNumber} by ${data.selectedBy}`);
      telegram.haptic('medium');
      this.render();
    });
    this.addHandler(BingoServerEvents.SCORE_UPDATED, (payload: unknown) => {
      const data = payload as BingoScoreUpdatedPayload;
      this.gameState.players = data.players;
      this.render();
    });
    this.addHandler(BingoServerEvents.TURN_CHANGED, (payload: unknown) => {
      const data = payload as BingoTurnChangedPayload;
      this.gameState.currentPlayerId = data.currentPlayerId;
      this.gameState.turnNumber = data.turnNumber;
      this.render();
    });
    this.addHandler(BingoServerEvents.PLAYER_LEFT, (payload: unknown) => {
      const data = payload as BingoPlayerLeftPayload;
      if (data.gameState) this.gameState = data.gameState;
      this.render();
    });
    this.addHandler(BingoServerEvents.TIMER_UPDATED, (payload: unknown) => {
      const data = payload as BingoTimerUpdatedPayload;
      this.timerText.setText(`${data.remaining}s`);
      this.timerText.setColor(data.remaining <= 5 ? '#ff4466' : '#888899');
    });
    this.addHandler(BingoServerEvents.GAME_ENDED, (payload: unknown) => {
      const data = payload as BingoGameEndedPayload;
      gameData.bingoGameState = data.gameState;
      this.scene.start('BingoResultScene', data);
    });
  }

  private render(): void {
    const me = this.getMe();
    this.gameState.players.forEach((player, i) => {
      const turn = player.id === this.gameState.currentPlayerId && player.status === 'PLAYING';
      const status = player.status === 'PLAYING' ? (turn ? 'TURN' : 'WAIT') : player.status;
      this.playerTexts[i]?.setText(`${this.fitName(player.name)}\nScore ${player.score}/${this.gameState.pointsToWin}  ${status}`);
      this.playerTexts[i]?.setColor(turn ? '#ffffff' : '#d9deea');
    });

    const board = me ? this.gameState.boards[me.id] : undefined;
    if (board) {
      const canPlay = me?.id === this.gameState.currentPlayerId && me.status === 'PLAYING';
      const ownerColor = parseInt((me?.color ?? '#00e5ff').replace('#', ''), 16);
      this.ownProgressText.setText(`Your Board  ${this.progress(me)}  ${me.score}/${this.gameState.pointsToWin}`);
      this.ownProgressText.setColor(me.color);
      this.board.updateBoard(board, this.gameState.selectedNumbers, canPlay, ownerColor);
    }
  }

  private progress(player: BingoPlayerInfo): string {
    const earned = Math.min(player.score || 0, this.gameState.header.length);
    return this.gameState.header
      .split('')
      .map((letter, index) => index < earned ? letter : letter.toLowerCase())
      .join(' ');
  }

  private fitName(name: string): string {
    return name.length > 12 ? `${name.slice(0, 9)}...` : name;
  }

  private selectNumber(number: number): void {
    if (!gameData.roomCode) return;
    socketService.bingoSelectNumber({ roomCode: gameData.roomCode, selectedNumber: number });
  }

  private getMe(): BingoPlayerInfo | undefined {
    return this.gameState.players.find(player => player.id === gameData.playerId);
  }

  private goHome(): void {
    if (gameData.roomCode) socketService.bingoLeaveRoom(gameData.roomCode);
    socketService.disconnect();
    gameData.bingoGameState = undefined;
    gameData.bingoRoom = undefined;
    this.scene.start('BingoMenuScene');
  }

  private addHandler(event: string, handler: (...args: unknown[]) => void): void {
    this.handlers.push({ event, handler });
    socketService.on(event, handler);
  }

  private cleanupHandlers(): void {
    this.handlers.forEach(({ event, handler }) => socketService.off(event, handler));
    this.handlers = [];
  }
}
