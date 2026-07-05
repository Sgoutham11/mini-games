import Phaser from 'phaser';
import { GameMode } from '@shared/enums';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { telegram } from '../telegram/TelegramService';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);

    NeonUI.createTitle(this, width / 2, 80, 'Choose Your Battle Mode', '24px');
    NeonUI.createSubtitle(this, width / 2, 115, 'Select your preferred gaming experience');

    const backBtn = NeonUI.createButton(this, 84, height - 54, 120, 44, 'Back');
    backBtn.on('pointerdown', () => {
      telegram.haptic('light');
      this.scene.start('GameSelectionScene');
    });

    const modes = [
      {
        key: GameMode.SINGLE_PLAYER,
        icon: '🤖',
        title: 'Single Player',
        desc: 'Challenge the AI Mastermind',
        footer: 'Difficulty: Adaptive',
        scene: 'SinglePlayerSetupScene',
      },
      {
        key: GameMode.LOCAL_MULTIPLAYER,
        icon: '👥',
        title: 'Local Multiplayer',
        desc: 'Play with friends on one device',
        footer: '',
        scene: 'LocalSetupScene',
      },
      {
        key: GameMode.ONLINE_MULTIPLAYER,
        icon: '🌐',
        title: 'Online Battle',
        desc: 'Play with friends anywhere',
        footer: 'LIVE',
        scene: 'OnlineLobbyScene',
        highlight: true,
      },
    ];

    const cardW = width - 48;
    const cardH = 110;
    let startY = 160;

    modes.forEach((mode, i) => {
      const y = startY + i * (cardH + 16);
      const card = this.createModeCard(width / 2, y, cardW, cardH, mode);
      card.on('pointerdown', () => {
        telegram.haptic('light');
        if (mode.key === GameMode.SINGLE_PLAYER) gameData.mode = 'single';
        else if (mode.key === GameMode.LOCAL_MULTIPLAYER) gameData.mode = 'local';
        else gameData.mode = 'online';
        gameData.playerName = telegram.getContext().displayName;
        this.scene.start(mode.scene);
      });
    });
  }

  private createModeCard(
    x: number, y: number, w: number, h: number,
    mode: { icon: string; title: string; desc: string; footer: string; highlight?: boolean }
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const highlight = mode.highlight ?? false;

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

    const icon = this.add.text(-w / 2 + 40, 0, mode.icon, { fontSize: '22px' }).setOrigin(0.5);
    const title = this.add.text(-w / 2 + 80, -20, mode.title, {
      fontFamily: Theme.fontFamily, fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    });
    const desc = this.add.text(-w / 2 + 80, 2, mode.desc, {
      fontFamily: Theme.fontFamily, fontSize: '12px', color: '#888899',
    });
    const footer = this.add.text(-w / 2 + 80, 28, mode.footer, {
      fontFamily: Theme.fontFamily, fontSize: '11px',
      color: highlight ? '#2ecc71' : '#ffaa00',
    });

    container.add([bg, iconBg, icon, title, desc, footer]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });

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
