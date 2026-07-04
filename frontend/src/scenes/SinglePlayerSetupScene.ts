import Phaser from 'phaser';
import { AIDifficulty } from '@shared/enums';
import { Theme, GameConfig } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { telegram } from '../telegram/TelegramService';

export class SinglePlayerSetupScene extends Phaser.Scene {
  private selectedDifficulty = AIDifficulty.MEDIUM;
  private selectedGridSize = gameData.gridSize || GameConfig.defaultGridSize;

  constructor() {
    super({ key: 'SinglePlayerSetupScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);

    NeonUI.drawPanel(this, width / 2, height / 2, width - 40, 520);
    NeonUI.createTitle(this, width / 2, height / 2 - 220, 'Single Player', '22px');
    NeonUI.createSubtitle(this, width / 2, height / 2 - 190, 'Challenge the AI Mastermind');

    const nameInput = NeonUI.createInput(this, width / 2, height / 2 - 135, width - 100, 44, 'Player', gameData.playerName);
    this.add.existing(nameInput.container);

    this.add.text(width / 2, height / 2 - 92, 'Difficulty', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    const difficulties = [
      { key: AIDifficulty.EASY, label: 'Easy' },
      { key: AIDifficulty.MEDIUM, label: 'Medium' },
      { key: AIDifficulty.HARD, label: 'Hard' },
    ];

    const diffBtns: Phaser.GameObjects.Container[] = [];
    difficulties.forEach((d, i) => {
      const btn = NeonUI.createButton(this, width / 2 - 100 + i * 100, height / 2 - 55, 80, 36, d.label, {
        active: d.key === this.selectedDifficulty,
      });
      btn.on('pointerdown', () => {
        this.selectedDifficulty = d.key;
        this.scene.restart();
      });
      diffBtns.push(btn);
    });

    this.add.text(width / 2, height / 2 + 4, 'Grid Size', {
      fontFamily: Theme.fontFamily, fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5);

    const sizes = [3, 4, 5, 6, 7, 8];
    sizes.forEach((size, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const btn = NeonUI.createButton(this, width / 2 - 80 + col * 80, height / 2 + 40 + row * 48, 60, 36, `${size}x${size}`, {
        active: size === this.selectedGridSize,
      });
      btn.on('pointerdown', () => {
        this.selectedGridSize = size;
        gameData.gridSize = size;
        this.scene.restart();
      });
    });

    const backBtn = NeonUI.createButton(this, width / 2 - 80, height / 2 + 160, 120, 44, 'Back');
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    const startBtn = NeonUI.createGradientButton(this, width / 2 + 80, height / 2 + 160, 160, 44, 'Start Game');
    startBtn.on('pointerdown', () => {
      gameData.playerName = nameInput.getValue() || 'Player';
      gameData.aiDifficulty = this.selectedDifficulty;
      gameData.gridSize = this.selectedGridSize;
      gameData.playerId = `player_${Date.now()}`;
      gameData.mode = 'single';
      this.scene.start('GameScene');
    });
  }
}


