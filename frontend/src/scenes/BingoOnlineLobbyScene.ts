import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { telegram } from '../telegram/TelegramService';
import {
  BingoServerEvents,
  socketService,
  type BingoErrorPayload,
  type BingoPlayerJoinedPayload,
  type BingoRoomCreatedPayload,
} from '../sockets/SocketService';
import type { BingoBoardSize } from '@shared/bingo-events';

export class BingoOnlineLobbyScene extends Phaser.Scene {
  private mode: 'create' | 'join' = 'create';
  private selectedCount = 2;
  private selectedBoardSize: BingoBoardSize = 5;
  private nameInput!: ReturnType<typeof NeonUI.createInput>;
  private roomCodeInput?: ReturnType<typeof NeonUI.createInput>;
  private validationText?: Phaser.GameObjects.Text;
  private connecting = false;
  private handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  constructor() {
    super({ key: 'BingoOnlineLobbyScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);
    this.connecting = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupHandlers());

    NeonUI.drawPanel(this, width / 2, height / 2, width - 32, 680);
    NeonUI.createTitle(this, width / 2, 86, 'Bingo Online', '24px');
    NeonUI.createSubtitle(this, width / 2, 116, "Create a room or join a friend's room");

    const tabCreate = NeonUI.createButton(this, width / 2 - 90, 160, 160, 40, 'CREATE', { active: this.mode === 'create' });
    const tabJoin = NeonUI.createButton(this, width / 2 + 90, 160, 160, 40, 'JOIN', { active: this.mode === 'join' });
    tabCreate.on('pointerdown', () => { this.mode = 'create'; this.scene.restart(); });
    tabJoin.on('pointerdown', () => { this.mode = 'join'; this.scene.restart(); });

    this.add.text(width / 2, 210, 'Your Name', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.nameInput = NeonUI.createInput(this, width / 2, 245, width - 80, 44, 'Player', gameData.playerName);
    this.add.existing(this.nameInput.container);

    this.validationText = this.add.text(width / 2, 284, '', {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: '#ff4466',
    }).setOrigin(0.5);
    this.validationText.setResolution(window.devicePixelRatio || 2);

    if (this.mode === 'create') this.buildCreateUI(width);
    else this.buildJoinUI(width);

    const backBtn = NeonUI.createButton(this, 84, height - 88, 120, 44, 'Back');
    backBtn.on('pointerdown', () => {
      socketService.disconnect();
      this.scene.start('BingoMenuScene');
    });

    const actionBtn = NeonUI.createGradientButton(this, width - 114, height - 88, 180, 44, this.mode === 'create' ? 'Create Room' : 'Join Room');
    actionBtn.on('pointerdown', () => this.handleAction());
  }

  private buildCreateUI(width: number): void {
    this.add.text(width / 2, 320, 'Players Count', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    [2, 3, 4, 5, 6].forEach((count, i) => {
      const card = this.createNumberTile(width / 2 - 124 + i * 62, 365, 48, 48, String(count), count === this.selectedCount);
      card.on('pointerdown', () => {
        this.selectedCount = count;
        this.scene.restart();
      });
    });

    this.add.text(width / 2, 430, 'Board Size', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const sizes: Array<{ size: BingoBoardSize; label: string }> = [
      { size: 5, label: 'BINGO' },
      { size: 6, label: 'BINGOS' },
      { size: 7, label: 'BINGOES' },
      { size: 8, label: 'BINGOESS' },
    ];

    sizes.forEach((item, i) => {
      const x = width / 2 - 78 + (i % 2) * 156;
      const y = 480 + Math.floor(i / 2) * 74;
      const selected = item.size === this.selectedBoardSize;
      const tile = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(Theme.bgCell, 1);
      bg.fillRoundedRect(-62, -27, 124, 54, 10);
      bg.lineStyle(2, selected ? Theme.cyan : Theme.grayDark, selected ? 1 : 0.5);
      bg.strokeRoundedRect(-62, -27, 124, 54, 10);
      const num = this.add.text(-34, 0, String(item.size), {
        fontFamily: Theme.fontFamily,
        fontSize: '22px',
        color: selected ? '#00e5ff' : '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const label = this.add.text(6, 0, item.label, {
        fontFamily: Theme.fontFamily,
        fontSize: '10px',
        color: '#888899',
      }).setOrigin(0.5);
      tile.add([bg, num, label]);
      tile.setSize(124, 54);
      NeonUI.addHitZone(this, tile, 124, 54);
      tile.on('pointerdown', () => {
        this.selectedBoardSize = item.size;
        this.scene.restart();
      });
    });
  }

  private buildJoinUI(width: number): void {
    this.add.text(width / 2, 335, 'Room Code', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.roomCodeInput = NeonUI.createInput(this, width / 2, 375, width - 80, 44, 'E.G. A7K9Q2', '');
    this.add.existing(this.roomCodeInput.container);
  }

  private createNumberTile(x: number, y: number, w: number, h: number, label: string, selected: boolean): Phaser.GameObjects.Container {
    const tile = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(Theme.bgCell, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    bg.lineStyle(2, selected ? Theme.green : Theme.grayDark, selected ? 1 : 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    const text = this.add.text(0, 0, label, {
      fontFamily: Theme.fontFamily,
      fontSize: '22px',
      color: selected ? '#2ecc71' : '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    tile.add([bg, text]);
    tile.setSize(w, h);
    NeonUI.addHitZone(this, tile, w, h);
    return tile;
  }

  private async handleAction(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;

    const playerName = (this.nameInput.getValue() || 'Player').trim();
    if (playerName.length > 15) {
      this.showValidation('Player name must be 15 characters or less');
      this.connecting = false;
      return;
    }
    gameData.playerName = playerName || 'Player';

    try {
      await socketService.connect();
      this.addHandler(BingoServerEvents.ERROR, (payload: unknown) => {
        const err = payload as BingoErrorPayload;
        this.showValidation(err.message || 'Unable to join room');
        this.connecting = false;
      });

      if (this.mode === 'create') {
        this.addHandler(BingoServerEvents.ROOM_CREATED, (payload: unknown) => {
          const data = payload as BingoRoomCreatedPayload;
          this.connecting = false;
          gameData.bingoRoom = data.room;
          gameData.roomCode = data.roomCode;
          gameData.playerId = data.room.players[0].id;
          gameData.isHost = true;
          this.cleanupHandlers();
          this.scene.start('BingoWaitingRoomScene');
        });
        socketService.bingoCreateRoom({
          playerName: gameData.playerName,
          boardSize: this.selectedBoardSize,
          playerCount: this.selectedCount,
          telegramId: telegram.getContext().userId ?? undefined,
        });
      } else {
        const roomCode = this.roomCodeInput?.getValue().toUpperCase().trim() ?? '';
        if (!roomCode) {
          this.showValidation('Enter a room code');
          this.connecting = false;
          return;
        }
        this.addHandler(BingoServerEvents.PLAYER_JOINED, (payload: unknown) => {
          const data = payload as BingoPlayerJoinedPayload;
          this.connecting = false;
          gameData.bingoRoom = data.room;
          gameData.roomCode = data.room.roomCode;
          gameData.playerId = data.player.id;
          gameData.isHost = false;
          this.cleanupHandlers();
          this.scene.start('BingoWaitingRoomScene');
        });
        socketService.bingoJoinRoom({
          playerName: gameData.playerName,
          roomCode,
          telegramId: telegram.getContext().userId ?? undefined,
        });
      }
    } catch {
      this.showValidation('Unable to connect. Please try again.');
      this.connecting = false;
    }
  }

  private showValidation(message: string): void {
    if (!this.validationText) return;
    this.validationText.setText(message);
    this.validationText.setAlpha(1);
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
