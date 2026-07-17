import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI } from '../components/NeonUI';
import { telegram } from '../telegram/TelegramService';

export class GameSelectionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameSelectionScene' });
  }

  create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);

    NeonUI.createTitle(this, width / 2, 80, 'Choose Your Game', '24px');
    NeonUI.createSubtitle(this, width / 2, 115, 'Select a game to play');

    const games = [
      {
        icon: 'SOS',
        title: 'SOS',
        desc: 'Classic SOS strategy battle',
        footer: 'Available now',
        scene: 'MenuScene',
        highlight: true,
      },
      {
        icon: 'B',
        title: 'Bingo',
        desc: 'Turn-based number strategy',
        footer: 'New game',
        scene: 'BingoMenuScene',
        highlight: true,
      },
    ];

    const cardW = width - 48;
    const cardH = 110;
    const startY = 160;

    games.forEach((game, i) => {
      const y = startY + i * (cardH + 16);
      const card = this.createGameCard(width / 2, y, cardW, cardH, game);
      card.on('pointerdown', () => {
        telegram.haptic('light');
        this.scene.start(game.scene);
      });
    });
  }

  private createGameCard(
    x: number, y: number, w: number, h: number,
    game: { icon: string; title: string; desc: string; footer: string; highlight?: boolean }
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const highlight = game.highlight ?? false;

    const bg = this.add.graphics();
    bg.fillStyle(Theme.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    if (highlight) {
      bg.lineStyle(2, Theme.green, 0.8);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    } else {
      bg.lineStyle(1, Theme.grayDark, 0.4);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    }

    const iconBg = this.add.graphics();
    iconBg.fillGradientStyle(Theme.cyan, Theme.orange, Theme.cyan, Theme.orange, 0.8);
    iconBg.fillCircle(-w / 2 + 40, 0, 24);

    const icon = this.add.text(-w / 2 + 40, 0, game.icon, {
      fontFamily: Theme.fontFamily,
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const title = this.add.text(-w / 2 + 80, -20, game.title, {
      fontFamily: Theme.fontFamily, fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    });
    const desc = this.add.text(-w / 2 + 80, 2, game.desc, {
      fontFamily: Theme.fontFamily, fontSize: '12px', color: '#888899',
    });
    const footer = this.add.text(-w / 2 + 80, 28, game.footer, {
      fontFamily: Theme.fontFamily, fontSize: '11px',
      color: highlight ? '#2ecc71' : '#ffaa00',
    });

    container.add([bg, iconBg, icon, title, desc, footer]);
    container.setSize(w, h);
    NeonUI.addHitZone(this, container, w, h);

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x1a1a28, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      bg.lineStyle(2, Theme.cyan, 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(Theme.bgPanel, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      if (highlight) {
        bg.lineStyle(2, Theme.green, 0.8);
      } else {
        bg.lineStyle(1, Theme.grayDark, 0.4);
      }
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    });

    return container;
  }
}
