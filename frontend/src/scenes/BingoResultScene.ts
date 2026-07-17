import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import type { BingoGameEndedPayload } from '@shared/bingo-events';
import { API_BASE } from '../config';
import { telegram } from '../telegram/TelegramService';
import { socketService } from '../sockets/SocketService';

export class BingoResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BingoResultScene' });
  }

  create(data: BingoGameEndedPayload): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);

    const gameState = data.gameState ?? gameData.bingoGameState;
    const players = [...(data.players ?? gameState?.players ?? [])].sort((a, b) => {
      const rankA = a.finishRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.finishRank ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

    NeonUI.drawPanel(this, width / 2, height / 2, width - 32, 560);
    NeonUI.createTitle(this, width / 2, 96, 'Bingo Results', '24px');
    const winner = players.find(player => player.id === data.winnerId);
    NeonUI.createSubtitle(this, width / 2, 128, winner ? `Winner: ${winner.name}` : 'Final ranking and scores');

    players.forEach((player, i) => {
      const y = 190 + i * 66;
      const x = 44;
      const w = width - 88;
      const bg = this.add.graphics();
      const color = parseInt(player.color.replace('#', ''), 16);
      bg.fillStyle(Theme.bgCell, 1);
      bg.fillRoundedRect(x, y, w, 54, 10);
      bg.lineStyle(1.5, color, 0.8);
      bg.strokeRoundedRect(x, y, w, 54, 10);

      const rank = player.finishRank ?? i + 1;
      this.add.text(x + 18, y + 18, String(rank), {
        fontFamily: Theme.fontFamily,
        fontSize: '13px',
        color: player.color,
        fontStyle: 'bold',
      });
      this.add.text(x + 52, y + 9, player.name, {
        fontFamily: Theme.fontFamily,
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      this.add.text(x + 52, y + 30, `${player.score}/${gameState?.pointsToWin ?? 5}`, {
        fontFamily: Theme.fontFamily,
        fontSize: '11px',
        color: '#888899',
      });
      this.add.text(x + w - 78, y + 19, player.status, {
        fontFamily: Theme.fontFamily,
        fontSize: '11px',
        color: player.status === 'LOST' ? '#ff4466' : player.color,
        fontStyle: 'bold',
      });
    });

    this.saveScore(data);

    const playBtn = NeonUI.createGradientButton(this, width / 2 - 80, height - 86, 140, 44, 'Play Again');
    playBtn.on('pointerdown', () => {
      this.resetBingoSocketSession();
      this.scene.start('BingoMenuScene');
    });
    const homeBtn = NeonUI.createButton(this, width / 2 + 90, height - 86, 120, 44, 'Home');
    homeBtn.on('pointerdown', () => {
      this.resetBingoSocketSession();
      this.scene.start('GameSelectionScene');
    });
  }

  private resetBingoSocketSession(): void {
    socketService.disconnect();
    gameData.roomCode = undefined;
    gameData.bingoRoom = undefined;
    gameData.bingoGameState = undefined;
    gameData.isHost = undefined;
    gameData.playerId = '';
  }

  private async saveScore(data: BingoGameEndedPayload): Promise<void> {
    try {
      const scores = data.scores ?? {};
      const myScore = scores[gameData.playerId] ?? 0;
      const opponentScore = Object.entries(scores)
        .filter(([id]) => id !== gameData.playerId)
        .reduce((max, [, score]) => Math.max(max, score), 0);

      await fetch(`${API_BASE}/api/game/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${telegram.getInitData()}`,
        },
        body: JSON.stringify({
          gameCode: 'BINGO',
          playerName: gameData.playerName,
          score: myScore,
          opponentScore,
          boardSize: data.gameState?.boardSize ?? gameData.bingoGameState?.boardSize ?? 5,
          isWin: !data.isDraw && data.winnerId === gameData.playerId,
        }),
      });
    } catch (error) {
      console.error('[BingoResult] Failed to save score', error);
    }
  }
}
