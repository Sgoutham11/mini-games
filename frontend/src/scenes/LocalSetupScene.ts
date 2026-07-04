import Phaser from 'phaser';
import { PLAYER_COLORS } from '@shared/enums';
import { Theme, GameConfig } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';

export class LocalSetupScene extends Phaser.Scene {
  private selectedCount = 2;
  private selectedGridSize = gameData.gridSize || GameConfig.defaultGridSize;

  constructor() {
    super({ key: 'LocalSetupScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);

    NeonUI.drawPanel(this, width / 2, height / 2, width - 40, 540);
    NeonUI.createTitle(this, width / 2, height / 2 - 235, 'Local Multiplayer', '22px');
    NeonUI.createSubtitle(this, width / 2, height / 2 - 205, 'Play with friends on one device');

    this.add.text(width / 2, height / 2 - 158, 'Players Count', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    const counts = [2, 3, 4];
    const icons = ['👥', '👥👤', '👥👥'];
    counts.forEach((count, i) => {
      const cx = width / 2 - 120 + i * 120;
      const card = this.add.container(cx, height / 2 - 94);
      const w = 90, h = 90;

      const bg = this.add.graphics();
      const draw = (active: boolean) => {
        bg.clear();
        bg.fillStyle(Theme.bgCell, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        bg.lineStyle(2, active ? Theme.green : Theme.grayDark, active ? 0.9 : 0.4);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      };
      draw(count === this.selectedCount);

      const icon = this.add.text(0, -10, icons[i], { fontSize: '20px' }).setOrigin(0.5);
      const num = this.add.text(0, 20, String(count), {
        fontFamily: Theme.fontFamily, fontSize: '22px',
        color: count === this.selectedCount ? '#2ecc71' : '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

      card.add([bg, icon, num]);
      card.setSize(w, h);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.selectedCount = count;
        this.scene.restart();
      });
      this.add.existing(card);
    });

    this.add.text(width / 2, height / 2 + 0, 'Grid Size', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    [3, 4, 5, 6, 7, 8].forEach((size, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const btn = NeonUI.createButton(this, width / 2 - 80 + col * 80, height / 2 + 38 + row * 48, 60, 36, `${size}x${size}`, {
        active: size === this.selectedGridSize,
      });
      btn.on('pointerdown', () => {
        this.selectedGridSize = size;
        gameData.gridSize = size;
        this.scene.restart();
      });
    });

    const backBtn = NeonUI.createButton(this, width / 2 - 80, height / 2 + 150, 120, 44, 'Back');
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    const startBtn = NeonUI.createGradientButton(this, width / 2 + 80, height / 2 + 150, 160, 44, 'Start Game');
    startBtn.on('pointerdown', () => {
      gameData.mode = 'local';
      gameData.playerCount = this.selectedCount;
      gameData.gridSize = this.selectedGridSize;
      gameData.localPlayers = Array.from({ length: this.selectedCount }, (_, i) => ({
        id: `local_p${i}`,
        name: `Player ${i + 1}`,
        color: PLAYER_COLORS[i],
      }));
      gameData.playerId = gameData.localPlayers[0].id;
      this.scene.start('GameScene');
    });
  }
}


