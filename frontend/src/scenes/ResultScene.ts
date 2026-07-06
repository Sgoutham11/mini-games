import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { API_BASE } from '../config';
import { telegram } from '../telegram/TelegramService';
import { LoggerService } from '../logger/LoggerService';
import { socketService } from '../sockets/SocketService';

interface ResultData {
  scores: Record<string, number>;
  winnerId: string | null;
  isDraw: boolean;
}

export class ResultScene extends Phaser.Scene {
  private resultData!: ResultData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultData): void {
    this.resultData = data;
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);

    const { scores, winnerId, isDraw } = this.resultData;

    NeonUI.drawPanel(this, width / 2, height / 2, width - 40, 480);

    let titleText = 'DRAW!';
    let titleColor = '#ffaa00';
    if (!isDraw && winnerId) {
      const winner = gameData.gameState?.players.find(p => p.id === winnerId)
        ?? gameData.localPlayers?.find(p => p.id === winnerId);
      titleText = `${winner?.name ?? 'Player'} WINS!`;
      titleColor = winner?.color ?? '#00e5ff';
    }

    const title = this.add.text(width / 2, 120, titleText, {
      fontFamily: Theme.fontFamily, fontSize: '28px', color: titleColor, fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 10, true, true);

    NeonUI.createSubtitle(this, width / 2, 160, 'Final Scores');

    const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
    entries.forEach(([playerId, score], i) => {
      const player = gameData.gameState?.players.find(p => p.id === playerId)
        ?? gameData.localPlayers?.find(p => p.id === playerId);
      const isQuit = player?.status === 'QUIT';
      const name = this.fitText(player?.name ?? playerId, 15);
      const color = isQuit ? '#888899' : (player?.color ?? '#ffffff');
      const y = 210 + i * 50;

      this.add.text(width / 2 - 80, isQuit ? y - 6 : y, `#${i + 1}  ${name}`, {
        fontFamily: Theme.fontFamily, fontSize: '16px', color,
      }).setOrigin(0, 0.5);

      if (isQuit) {
        this.add.text(width / 2 - 52, y + 13, 'QUIT', {
          fontFamily: Theme.fontFamily,
          fontSize: '10px',
          color: '#ff4466',
          fontStyle: 'bold',
        }).setOrigin(0, 0.5);
      }

      this.add.text(width / 2 + 80, y, `${score} SOS`, {
        fontFamily: Theme.fontFamily, fontSize: '18px', color: '#00e5ff', fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    });

    this.saveScore(scores, winnerId, isDraw);

    const rematchBtn = NeonUI.createGradientButton(this, width / 2 - 90, height - 120, 160, 44, '↻ Rematch');
    rematchBtn.on('pointerdown', () => {
      if (gameData.mode === 'online') {
        this.leaveOnlineMatch();
        this.scene.start('OnlineLobbyScene');
      } else {
        gameData.gameState = undefined;
        this.scene.start('GameScene');
      }
    });

    const homeBtn = NeonUI.createButton(this, width / 2 + 90, height - 120, 160, 44, '🏠 Home');
    homeBtn.on('pointerdown', () => {
      this.leaveOnlineMatch();
      this.scene.start('MenuScene');
    });
  }

  private fitText(value: string, maxChars: number): string {
    return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
  }

  private leaveOnlineMatch(): void {
    if (gameData.mode !== 'online') return;

    if (gameData.roomCode) {
      socketService.leaveRoom(gameData.roomCode);
    }

    socketService.disconnect();
    gameData.roomCode = undefined;
    gameData.room = undefined;
    gameData.gameState = undefined;
    gameData.isHost = undefined;
    gameData.playerId = '';
  }

  private async saveScore(
    scores: Record<string, number>,
    winnerId: string | null,
    isDraw: boolean
  ): Promise<void> {

    try {
       LoggerService.debugLog("Inside save score function", `${API_BASE}/api/game/score`);
      const myScore = scores[gameData.playerId] ?? 0;

      const opponentScore = Object.entries(scores)
        .filter(([id]) => id !== gameData.playerId)
        .reduce((max, [, s]) => Math.max(max, s), 0);

      LoggerService.debugLog("Saving score...");
      LoggerService.debugLog("API_BASE", API_BASE);
      LoggerService.debugLog(":", gameData.playerName);

      const response = await fetch(`${API_BASE}/api/game/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${telegram.getInitData()}`,
        },
        body: JSON.stringify({
          playerName: gameData.playerName,
          score: myScore,
          opponentScore,
          boardSize: gameData.gridSize,
          isWin: !isDraw && winnerId === gameData.playerId,
        }),
      });

      LoggerService.debugLog("Status:", response.status);

      if (!response.ok) {
        const body = await response.text();
        LoggerService.debugLog("Server Error:", body);

        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      LoggerService.debugLog("Score saved successfully");

    } catch (error) {

      console.error(error);

      if (error instanceof Error) {
        LoggerService.debugLog("Save Score Exception:", error.message);
        LoggerService.debugLog(error.stack);
      } else {
        LoggerService.debugLog("Unknown Exception:", JSON.stringify(error));
      }

    }
  }

  // private async saveScore(scores: Record<string, number>, winnerId: string | null, isDraw: boolean): Promise<void> {
  //   try {
  //     const myScore = scores[gameData.playerId] ?? 0;
  //     const opponentScore = Object.entries(scores)
  //       .filter(([id]) => id !== gameData.playerId)
  //       .reduce((max, [, s]) => Math.max(max, s), 0);
  //       LoggerService.debugLog("API_BASE", API_BASE);

  //     await fetch(`${API_BASE}/api/game/score`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Bearer ${telegram.getInitData()}`,
  //       },
  //       body: JSON.stringify({
  //         playerName: gameData.playerName,
  //         score: myScore,
  //         opponentScore,
  //         boardSize: gameData.gridSize,
  //         isWin: !isDraw && winnerId === gameData.playerId,
  //       }),
  //     });
  //   } catch (error) {
  //      if (error instanceof Error) {
  //     LoggerService.debugLog("Save Score Exception:", error.message);
  //     LoggerService.debugLog(error.stack);
  //   } else {
  //     LoggerService.debugLog("Unknown Exception:", JSON.stringify(error));
  //   }
  //   }
  // }
}
