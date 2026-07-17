import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import {
  BingoServerEvents,
  socketService,
  type BingoGameStartedPayload,
  type BingoPlayerJoinedPayload,
  type BingoPlayerLeftPayload,
  type BingoRoomUpdatePayload,
} from '../sockets/SocketService';
import type { BingoRoomState } from '@shared/bingo-events';

export class BingoWaitingRoomScene extends Phaser.Scene {
  private room: BingoRoomState | null = null;
  private playerList!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  constructor() {
    super({ key: 'BingoWaitingRoomScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);
    this.room = gameData.bingoRoom ?? null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupHandlers());

    NeonUI.drawPanel(this, width / 2, height / 2, width - 32, 520);
    NeonUI.createTitle(this, width / 2, 96, 'Bingo Waiting Room', '23px');
    NeonUI.createSubtitle(this, width / 2, 128, 'Share the room code with friends');

    this.add.text(width / 2, 205, this.room?.roomCode ?? '------', {
      fontFamily: Theme.fontFamily,
      fontSize: '36px',
      color: '#00e5ff',
      fontStyle: 'bold',
      letterSpacing: 8,
    }).setOrigin(0.5).setShadow(0, 0, '#00e5ff', 10, true, true);

    this.countText = this.add.text(width / 2, 248, '', {
      fontFamily: Theme.fontFamily,
      fontSize: '13px',
      color: '#888899',
    }).setOrigin(0.5);

    this.playerList = this.add.text(width / 2, 360, '', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 12,
    }).setOrigin(0.5);
    this.updateRoomUI();

    this.addHandler(BingoServerEvents.PLAYER_JOINED, (payload: unknown) => {
      const data = payload as BingoPlayerJoinedPayload;
      this.room = data.room;
      gameData.bingoRoom = data.room;
      this.updateRoomUI();
    });
    this.addHandler(BingoServerEvents.ROOM_UPDATE, (payload: unknown) => {
      const data = payload as BingoRoomUpdatePayload;
      this.room = data.room;
      gameData.bingoRoom = data.room;
      this.updateRoomUI();
    });
    this.addHandler(BingoServerEvents.PLAYER_LEFT, (payload: unknown) => {
      const data = payload as BingoPlayerLeftPayload;
      this.room = data.room;
      gameData.bingoRoom = data.room;
      this.updateRoomUI();
    });
    this.addHandler(BingoServerEvents.GAME_STARTED, (payload: unknown) => this.enterGame(payload as BingoGameStartedPayload));

    const pending = socketService.getLatestBingoGameStarted(gameData.roomCode);
    if (pending) {
      this.enterGame(pending);
      return;
    }

    const leaveBtn = NeonUI.createButton(this, 80, height - 86, 120, 44, 'Leave');
    leaveBtn.on('pointerdown', () => {
      if (gameData.roomCode) socketService.bingoLeaveRoom(gameData.roomCode);
      socketService.disconnect();
      this.scene.start('BingoMenuScene');
    });

    if (gameData.isHost) {
      const addBotBtn = NeonUI.createButton(this, width / 2, height - 86, 110, 44, 'Add Bot');
      addBotBtn.on('pointerdown', () => {
        if (gameData.roomCode) socketService.bingoAddBot(gameData.roomCode);
      });
      const startBtn = NeonUI.createGradientButton(this, width - 80, height - 86, 120, 44, 'Start');
      startBtn.on('pointerdown', () => {
        if (gameData.roomCode && (this.room?.players.length ?? 0) >= 2) {
          socketService.bingoStartGame(gameData.roomCode);
        }
      });
    }
  }

  private enterGame(data: BingoGameStartedPayload): void {
    this.cleanupHandlers();
    socketService.clearLatestBingoGameStarted();
    gameData.bingoGameState = data.gameState;
    gameData.roomCode = data.gameState.roomCode;
    this.scene.start('BingoGameScene');
  }

  private updateRoomUI(): void {
    if (!this.room) return;
    this.countText.setText(`${this.room.players.length} / ${this.room.maxPlayers} Players  |  ${this.room.boardSize}x${this.room.boardSize}`);
    const lines = this.room.players.map(player => {
      const host = player.isHost ? ' HOST' : '';
      const bot = player.isBot ? ' BOT' : '';
      return `${player.name}${host}${bot}`;
    });
    this.playerList.setText(lines.join('\n'));
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
