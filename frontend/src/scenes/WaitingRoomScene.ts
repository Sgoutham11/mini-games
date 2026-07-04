import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import {
  socketService, ServerEvents,
  type PlayerJoinedPayload, type GameStartedPayload, type RoomState,
} from '../sockets/SocketService';

export class WaitingRoomScene extends Phaser.Scene {
  private roomDisplay!: Phaser.GameObjects.Text;
  private playerList!: Phaser.GameObjects.Text;
  private room: RoomState | null = null;
  private socketHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

  constructor() {
    super({ key: 'WaitingRoomScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);
    this.room = gameData.room ?? null;

    NeonUI.drawPanel(this, width / 2, height / 2, width - 32, 480);
    NeonUI.createTitle(this, width / 2, 100, 'Waiting Room', '24px');
    NeonUI.createSubtitle(this, width / 2, 130, 'Share the room code with friends');

    this.roomDisplay = this.add.text(width / 2, 200, gameData.roomCode ?? '------', {
      fontFamily: Theme.fontFamily, fontSize: '36px', color: '#00e5ff', fontStyle: 'bold', letterSpacing: 8,
    }).setOrigin(0.5);
    this.roomDisplay.setShadow(0, 0, '#00e5ff', 10, true, true);

    this.add.text(width / 2, 250, `${this.room?.players.length ?? 1} / ${this.room?.maxPlayers ?? 2} Players`, {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#888899',
    }).setOrigin(0.5);

    this.playerList = this.add.text(width / 2, 320, '', {
      fontFamily: Theme.fontFamily, fontSize: '15px', color: '#ffffff', align: 'center', lineSpacing: 12,
    }).setOrigin(0.5);

    this.updatePlayerList();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupSocketHandlers());

    this.addSocketHandler(ServerEvents.PLAYER_JOINED, (payload: unknown) => {
      const data = payload as PlayerJoinedPayload;
      gameData.room = data.room;
      this.room = data.room;
      this.updatePlayerList();
    });

    this.addSocketHandler(ServerEvents.GAME_STARTED, (payload: unknown) => {
      this.enterGame(payload as GameStartedPayload);
    });

    const pendingGame = socketService.getLatestGameStarted(gameData.roomCode);
    if (pendingGame) {
      this.enterGame(pendingGame);
      return;
    }
    const backBtn = NeonUI.createButton(this, width / 2, height - 80, 160, 44, '← Leave Room');
    backBtn.on('pointerdown', () => {
      if (gameData.roomCode) socketService.leaveRoom(gameData.roomCode);
      socketService.disconnect();
      this.scene.start('MenuScene');
    });

    if (gameData.isHost && this.room && this.room.players.length >= 2) {
      const startBtn = NeonUI.createGradientButton(this, width / 2, height - 140, 200, 44, '▶ Start Game');
      startBtn.on('pointerdown', () => {
        if (gameData.roomCode) {
          socketService.playerReady(gameData.roomCode);
        }
      });
    }
  }

  private enterGame(data: GameStartedPayload): void {
    this.cleanupSocketHandlers();
    socketService.clearLatestGameStarted();
    gameData.gameState = data.gameState;
    gameData.roomCode = data.gameState.roomCode;
    gameData.mode = 'online';
    this.scene.start('GameScene');
  }

  private addSocketHandler(event: string, handler: (...args: unknown[]) => void): void {
    this.socketHandlers.push({ event, handler });
    socketService.on(event, handler);
  }

  private cleanupSocketHandlers(): void {
    this.socketHandlers.forEach(({ event, handler }) => socketService.off(event, handler));
    this.socketHandlers = [];
  }

  private updatePlayerList(): void {
    if (!this.room) return;
    const lines = this.room.players.map(p => {
      const status = p.isReady ? '✓ Ready' : '⏳ Waiting';
      const host = p.isHost ? ' 👑' : '';
      return `${p.name}${host}  —  ${status}`;
    });
    this.playerList.setText(lines.join('\n'));
  }
}
