import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { telegram } from '../telegram/TelegramService';
import { socketService, ServerEvents, type RoomCreatedPayload, type ErrorPayload, type PlayerJoinedPayload } from '../sockets/SocketService';

export class OnlineLobbyScene extends Phaser.Scene {
  private mode: 'create' | 'join' = 'create';
  private selectedCount = 2;
  private nameInput!: ReturnType<typeof NeonUI.createInput>;
  private roomCodeInput!: ReturnType<typeof NeonUI.createInput>;
  private nameValidationText?: Phaser.GameObjects.Text;
  private validationText?: Phaser.GameObjects.Text;
  private contentContainer!: Phaser.GameObjects.Container;
  private connecting = false;
  private selectedGridSize = gameData.gridSize || 3;
  private socketHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  constructor() {
    super({ key: 'OnlineLobbyScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const panelBottom = height / 2 + 320;
    this.cameras.main.setBackgroundColor(Theme.bg);
    this.connecting = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupSocketHandlers());

    NeonUI.drawPanel(this, width / 2, height / 2, width - 32, 680);
    NeonUI.createTitle(this, width / 2, 86, 'Online Battle', '24px');
    NeonUI.createSubtitle(this, width / 2, 116, "Create a room or join a friend's room");

    const tabCreate = NeonUI.createButton(this, width / 2 - 90, 160, 160, 40, 'CREATE ROOM', { active: this.mode === 'create' });
    const tabJoin = NeonUI.createButton(this, width / 2 + 90, 160, 160, 40, 'JOIN ROOM', { active: this.mode === 'join' });

    tabCreate.on('pointerdown', () => { this.mode = 'create'; this.scene.restart(); });
    tabJoin.on('pointerdown', () => { this.mode = 'join'; this.scene.restart(); });

    this.contentContainer = this.add.container(0, 0);

    this.add.text(width / 2, 210, 'Your Name', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    this.nameInput = NeonUI.createInput(this, width / 2, 245, width - 80, 44, 'Player', gameData.playerName);
    this.add.existing(this.nameInput.container);
    this.nameValidationText = this.add.text(width / 2, 278, '', {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: '#ff4466',
    }).setOrigin(0.5);
    this.nameValidationText.setResolution(window.devicePixelRatio || 2);

    if (this.mode === 'create') {
      this.buildCreateUI(width);
    } else {
      this.buildJoinUI(width);
    }

    const backBtn = NeonUI.createButton(this, 84, panelBottom - 34, 120, 44, 'Back');
    backBtn.on('pointerdown', () => {
      socketService.disconnect();
      this.scene.start('MenuScene');
    });

    const actionLabel = this.mode === 'create' ? 'Create Room' : 'Join Room';
    const actionBtn = NeonUI.createGradientButton(this, width - 114, panelBottom - 34, 180, 44, actionLabel);
    actionBtn.on('pointerdown', () => this.handleAction());
  }

  private buildCreateUI(width: number): void {
    this.add.text(width / 2, 300, 'Players Count', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    [2, 3, 4].forEach((count, i) => {
      const cx = width / 2 - 96 + i * 96;
      const card = this.add.container(cx, 354);
      const w = 76, h = 76;
      const bg = this.add.graphics();
      bg.fillStyle(Theme.bgCell, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(2, count === this.selectedCount ? Theme.green : Theme.grayDark, count === this.selectedCount ? 0.9 : 0.4);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

      const num = this.add.text(0, 0, String(count), {
        fontFamily: Theme.fontFamily, fontSize: '26px',
        color: count === this.selectedCount ? '#2ecc71' : '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      card.add([bg, num]);
      card.setSize(w, h);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => { this.selectedCount = count; this.scene.restart(); });
      this.add.existing(card);
    });

    this.add.text(width / 2, 438, 'Grid Size', {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const sizes = [3, 4, 5, 6, 7, 8];

    sizes.forEach((size, index) => {

      const col = index % 3;
      const row = Math.floor(index / 3);

      const x = width / 2 - 90 + col * 90;
      const y = 492 + row * 74;

      const card = this.add.container(x, y);

      const bg = this.add.graphics();

      bg.fillStyle(Theme.bgCell, 1);
      bg.fillRoundedRect(-32, -32, 64, 64, 10);

      bg.lineStyle(
        2,
        size === this.selectedGridSize ? Theme.green : Theme.grayDark,
        size === this.selectedGridSize ? 1 : 0.5
      );

      bg.strokeRoundedRect(-32, -32, 64, 64, 10);

      const txt = this.add.text(0, 0, String(size), {
        fontFamily: Theme.fontFamily,
        fontSize: '24px',
        color: size === this.selectedGridSize ? '#2ecc71' : '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(.5);

      card.add([bg, txt]);

      card.setSize(64, 64);

      card.setInteractive({ useHandCursor: true });

      card.on('pointerdown', () => {

        this.selectedGridSize = size;

        gameData.gridSize = size;

        this.scene.restart();

      });

    });
  }

  private buildJoinUI(width: number): void {
    this.add.text(width / 2, 300, 'Room Code', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    this.roomCodeInput = NeonUI.createInput(this, width / 2, 340, width - 80, 44, 'E.G. ABCDEF', '');
    this.add.existing(this.roomCodeInput.container);

    this.validationText = this.add.text(width / 2, 382, '', {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: '#ff4466',
    }).setOrigin(0.5);
    this.validationText.setResolution(window.devicePixelRatio || 2);
  }

  private async handleAction(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;

    const playerName = (this.nameInput.getValue() || 'Player').trim();
    if (playerName.length > 15) {
      this.showNameValidation('Player name must be 15 characters or less');
      this.connecting = false;
      return;
    }
    gameData.playerName = playerName || 'Player';

    try {
      await socketService.connect();

      this.addSocketHandler(ServerEvents.ERROR, (payload: unknown) => {
        const err = payload as ErrorPayload;
        this.showValidation(err.message || 'Unable to join room');
        this.connecting = false;
      });

      if (this.mode === 'create') {
        this.addSocketHandler(ServerEvents.ROOM_CREATED, (payload: unknown) => {
          const data = payload as RoomCreatedPayload;
          gameData.roomCode = data.roomCode;
          gameData.room = data.room;
          gameData.isHost = true;
          gameData.playerId = data.room.players[0].id;
          this.roomCodeInput?.blur?.();   
          (this.nameInput as any)?.blur?.();
          (document.activeElement as HTMLElement)?.blur();
          this.cleanupSocketHandlers();
          this.scene.start('WaitingRoomScene');
        });
        socketService.createRoom({
          playerName: gameData.playerName,
          // gridSize: gameData.gridSize,
          gridSize: this.selectedGridSize,
          playerCount: this.selectedCount,
          telegramId: telegram.getContext().userId ?? undefined,
        });
      } else {
        const roomCode = this.roomCodeInput.getValue().toUpperCase().trim();
        if (!roomCode) {
          this.showValidation('Enter a room code');
          this.connecting = false;
          return;
        }

        this.addSocketHandler(ServerEvents.PLAYER_JOINED, (payload: unknown) => {
          const data = payload as PlayerJoinedPayload;
          gameData.roomCode = data.room.roomCode;
          gameData.room = data.room;
          gameData.isHost = false;
          gameData.playerId = data.player.id;
          this.roomCodeInput?.blur?.();
          (this.nameInput as any)?.blur?.();
          (document.activeElement as HTMLElement)?.blur();
          this.cleanupSocketHandlers();
          this.scene.start('WaitingRoomScene');
        });
        socketService.joinRoom({
          playerName: gameData.playerName,
          roomCode,
          telegramId: telegram.getContext().userId ?? undefined,
        });
      }
    } catch (err) {
      this.showValidation('Unable to connect. Please try again.');
      this.connecting = false;
    }
  }

  private showValidation(message: string): void {
    if (!this.validationText) return;

    this.validationText.setText(message);
    this.validationText.setAlpha(1);
    this.tweens.killTweensOf(this.validationText);
    this.tweens.add({
      targets: this.validationText,
      alpha: 0.75,
      duration: 450,
      yoyo: true,
      repeat: 1,
    });
  }

  private showNameValidation(message: string): void {
    if (!this.nameValidationText) return;

    this.nameValidationText.setText(message);
    this.nameValidationText.setAlpha(1);
    this.tweens.killTweensOf(this.nameValidationText);
    this.tweens.add({
      targets: this.nameValidationText,
      alpha: 0.75,
      duration: 450,
      yoyo: true,
      repeat: 1,
    });
  }

  private addSocketHandler(event: string, handler: (...args: unknown[]) => void): void {
    this.socketHandlers.push({ event, handler });
    socketService.on(event, handler);
  }

  private cleanupSocketHandlers(): void {
    this.socketHandlers.forEach(({ event, handler }) => socketService.off(event, handler));
    this.socketHandlers = [];
  }
}
