import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI, gameData } from '../components/NeonUI';
import { telegram } from '../telegram/TelegramService';
import { socketService } from '../sockets/SocketService';

export class BingoMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BingoMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(Theme.bg);
    socketService.disconnect();
    gameData.selectedGame = 'bingo';
    gameData.bingoRoom = undefined;
    gameData.bingoGameState = undefined;
    gameData.roomCode = undefined;
    gameData.isHost = undefined;
    socketService.clearLatestBingoGameStarted();

    NeonUI.createTitle(this, width / 2, 80, 'Choose Bingo Mode', '24px');
    NeonUI.createSubtitle(this, width / 2, 115, 'Create a party, join friends, or play locally');

    const modes = [
      {
        icon: 'ON',
        title: 'Online Party',
        desc: 'Create or join a live room',
        footer: 'Recommended',
        scene: 'BingoOnlineLobbyScene',
        highlight: true,
      },
      // {
      //   icon: 'L',
      //   title: 'Local Multiplayer',
      //   desc: 'Same-device Bingo rounds',
      //   footer: 'Future option',
      //   scene: '',
      // },
      // {
      //   icon: 'AI',
      //   title: 'Single Player',
      //   desc: 'Practice against bot logic',
      //   footer: 'Future option',
      //   scene: '',
      // },
    ];

    const cardW = width - 48;
    const cardH = 110;
    modes.forEach((mode, i) => {
      const card = this.createModeCard(width / 2, 160 + i * 126, cardW, cardH, mode);
      card.on('pointerdown', () => {
        telegram.haptic('light');
        if (mode.scene) this.scene.start(mode.scene);
      });
    });

    const backBtn = NeonUI.createButton(this, 84, height - 54, 120, 44, 'Back');
    backBtn.on('pointerdown', () => {
      telegram.haptic('light');
      this.scene.start('GameSelectionScene');
    });
  }

  private createModeCard(
    x: number,
    y: number,
    w: number,
    h: number,
    mode: { icon: string; title: string; desc: string; footer: string; highlight?: boolean }
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const highlight = mode.highlight ?? false;
    const bg = this.add.graphics();

    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x1a1a28 : Theme.bgPanel, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      bg.lineStyle(highlight ? 2 : 1, hover ? Theme.cyan : highlight ? Theme.green : Theme.grayDark, highlight ? 0.8 : 0.4);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    draw(false);

    const iconBg = this.add.graphics();
    iconBg.fillStyle(highlight ? Theme.green : Theme.cyan, 0.9);
    iconBg.fillCircle(-w / 2 + 40, 0, 24);

    const icon = this.add.text(-w / 2 + 40, 0, mode.icon, {
      fontFamily: Theme.fontFamily,
      fontSize: '13px',
      color: '#081018',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    icon.setResolution(window.devicePixelRatio || 2);

    const title = this.add.text(-w / 2 + 80, -20, mode.title, {
      fontFamily: Theme.fontFamily,
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    const desc = this.add.text(-w / 2 + 80, 2, mode.desc, {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: '#888899',
    });
    const footer = this.add.text(-w / 2 + 80, 28, mode.footer, {
      fontFamily: Theme.fontFamily,
      fontSize: '11px',
      color: highlight ? '#2ecc71' : '#ffaa00',
    });
    [title, desc, footer].forEach(text => text.setResolution(window.devicePixelRatio || 2));

    container.add([bg, iconBg, icon, title, desc, footer]);
    container.setSize(w, h);
    NeonUI.addHitZone(this, container, w, h);
    container.on('pointerover', () => draw(true));
    container.on('pointerout', () => draw(false));
    return container;
  }
}
