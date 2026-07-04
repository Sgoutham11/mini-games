import Phaser from 'phaser';
import { Theme } from '../config';

/** Shared neon UI drawing utilities */
export class NeonUI {
  static drawPanel(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number,
    opts: { glowColor?: number; fillColor?: number; borderWidth?: number } = {}
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    const glowColor = opts.glowColor ?? Theme.cyan;
    const fillColor = opts.fillColor ?? Theme.bgPanel;
    const borderWidth = opts.borderWidth ?? 2;

    const glow = scene.add.graphics();
    glow.lineStyle(6, glowColor, 0.15);
    glow.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, Theme.borderRadius + 2);

    const bg = scene.add.graphics();
    bg.fillStyle(fillColor, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, Theme.borderRadius);
    bg.lineStyle(borderWidth, glowColor, 0.8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, Theme.borderRadius);

    container.add([glow, bg]);
    return container;
  }

  static createButton(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number,
    label: string,
    opts: { active?: boolean; fontSize?: string; icon?: string } = {}
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    const active = opts.active ?? false;
    const fontSize = opts.fontSize ?? '14px';
    const color = active ? Theme.greenActive : Theme.grayDark;
    const textColor = active ? '#ffffff' : '#888899';

    const bg = scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      if (active) {
        bg.fillStyle(Theme.greenActive, hover ? 1 : 0.9);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      } else {
        bg.fillStyle(hover ? 0x2a2a3a : Theme.bgPanel, 0.9);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
        bg.lineStyle(1, color, 0.5);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      }
    };
    draw(false);

    const text = scene.add.text(0, 0, label, {
      fontFamily: Theme.fontFamily,
      fontSize,
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setResolution(window.devicePixelRatio || 2);

    container.add([bg, text]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => draw(true));
    container.on('pointerout', () => draw(false));

    return container;
  }

  static createGradientButton(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    const bg = scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillGradientStyle(Theme.greenActive, Theme.cyan, Theme.greenActive, Theme.cyan, hover ? 1 : 0.85);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false);

    const text = scene.add.text(0, 0, label, {
      fontFamily: Theme.fontFamily,
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setResolution(window.devicePixelRatio || 2);

    container.add([bg, text]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => draw(true));
    container.on('pointerout', () => draw(false));

    return container;
  }

  static createTitle(scene: Phaser.Scene, x: number, y: number, text: string, size = '26px'): Phaser.GameObjects.Text {
    const title = scene.add.text(x, y, text, {
      fontFamily: Theme.fontFamily,
      fontSize: size,
      color: '#00e5ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setResolution(window.devicePixelRatio || 2);
    title.setShadow(0, 0, '#00e5ff', 8, true, true);
    return title;
  }

  static createSubtitle(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Text {
    const subtitle = scene.add.text(x, y, text, {
      fontFamily: Theme.fontFamily,
      fontSize: Theme.fontSubtitle,
      color: '#888899',
    }).setOrigin(0.5);
    subtitle.setResolution(window.devicePixelRatio || 2);
    return subtitle;
  }

  static createInput(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number,
    placeholder: string, value: string
  ): { container: Phaser.GameObjects.Container; getValue: () => string; setValue: (v: string) => void ;
      blur: () => void; focus: () => void;} {
    const container = scene.add.container(x, y);
    let currentValue = value;

    const bg = scene.add.graphics();
    bg.fillStyle(Theme.bgCell, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1, Theme.cyan, 0.6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const display = scene.add.text(-w / 2 + 14, 0, value || placeholder, {
      fontFamily: Theme.fontFamily,
      fontSize: '15px',
      color: value ? '#ffffff' : '#666677',
    }).setOrigin(0, 0.5);
    display.setResolution(window.devicePixelRatio || 2);

    const hidden = document.createElement('input');
    hidden.type = 'text';
    hidden.value = value;
    hidden.placeholder = placeholder;

    hidden.autocomplete = 'off';
    hidden.inputMode = 'text';
    hidden.setAttribute('autocorrect', 'off');
    hidden.autocapitalize = 'off';
    hidden.spellcheck = false;

    // Telegram mobile webviews open the keyboard reliably only for a real tapped input.
    hidden.style.position = 'fixed';
    hidden.style.left = '0';
    hidden.style.top = '0';
    hidden.style.width = `${w}px`;
    hidden.style.height = `${h}px`;
    hidden.style.opacity = '0.01';
    hidden.style.zIndex = '999999';
    hidden.style.border = '0';
    hidden.style.padding = '0';
    hidden.style.margin = '0';
    hidden.style.outline = '0';
    hidden.style.background = 'transparent';
    hidden.style.color = 'transparent';
    hidden.style.caretColor = 'transparent';
    hidden.style.pointerEvents = 'auto';

    document.body.appendChild(hidden);

    container.add([bg, display]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });

    const syncInputBounds = () => {
      const canvas = scene.scale.canvas;
      if (!canvas || !hidden.isConnected) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / scene.scale.width;
      const scaleY = rect.height / scene.scale.height;
      const world = container.getWorldTransformMatrix();
      const left = rect.left + (world.tx - w / 2) * scaleX;
      const top = rect.top + (world.ty - h / 2) * scaleY;

      hidden.style.left = `${left}px`;
      hidden.style.top = `${top}px`;
      hidden.style.width = `${w * scaleX}px`;
      hidden.style.height = `${h * scaleY}px`;
    };

    const updateDisplay = () => {
      display.setText(currentValue || placeholder);
      display.setColor(currentValue ? '#ffffff' : '#666677');
    };

    container.on('pointerdown', () => {
      syncInputBounds();
      hidden.focus({ preventScroll: true });
      hidden.select();
    });

    hidden.addEventListener('focus', () => {
      syncInputBounds();
      hidden.select();
    });

    hidden.addEventListener('input', () => {
      currentValue = hidden.value;
      updateDisplay();
    });

    scene.scale.on('resize', syncInputBounds);
    window.addEventListener('resize', syncInputBounds);
    syncInputBounds();

    const cleanup = () => {
      scene.scale.off('resize', syncInputBounds);
      window.removeEventListener('resize', syncInputBounds);
      hidden.remove();
    };

    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);

    return {
      container,

      getValue: () => currentValue,

      setValue: (v: string) => {
        currentValue = v;
        hidden.value = v;
        updateDisplay();
      },

      blur: () => hidden.blur(),

      focus: () => {
        syncInputBounds();
        hidden.focus({ preventScroll: true });
      }
    };
  }

  static createIconButton(scene: Phaser.Scene, x: number, y: number, icon: string, size = 36): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    const bg = scene.add.graphics();
    const glyph = scene.add.graphics();

    const drawIcon = (hover: boolean) => {
      glyph.clear();
      glyph.lineStyle(2.4, hover ? Theme.green : Theme.cyan, 1);
      glyph.fillStyle(hover ? Theme.green : Theme.cyan, 1);

      if (icon === 'home') {
        glyph.beginPath();
        glyph.moveTo(-10, -1);
        glyph.lineTo(0, -11);
        glyph.lineTo(10, -1);
        glyph.strokePath();
        glyph.strokeRoundedRect(-7, -1, 14, 12, 2);
        glyph.fillRect(-2.5, 5, 5, 6);
        return;
      }

      if (icon === 'refresh') {
        glyph.beginPath();
        glyph.arc(0, 0, 10, Phaser.Math.DegToRad(35), Phaser.Math.DegToRad(300), false);
        glyph.strokePath();
        glyph.beginPath();
        glyph.moveTo(8, -9);
        glyph.lineTo(14, -8);
        glyph.lineTo(10, -3);
        glyph.closePath();
        glyph.fillPath();
        return;
      }
    };

    const draw = (hover: boolean) => {
      bg.clear();
      bg.lineStyle(1, Theme.cyan, hover ? 0.9 : 0.5);
      bg.strokeCircle(0, 0, size / 2);
      if (hover) {
        bg.fillStyle(Theme.cyan, 0.1);
        bg.fillCircle(0, 0, size / 2);
      }
      drawIcon(hover);
    };
    draw(false);

    if (icon !== 'home' && icon !== 'refresh') {
      const text = scene.add.text(0, 0, icon, { fontSize: '16px' }).setOrigin(0.5);
      text.setResolution(window.devicePixelRatio || 2);
      container.add([bg, text]);
    } else {
      container.add([bg, glyph]);
    }
    container.setSize(size, size);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => draw(true));
    container.on('pointerout', () => draw(false));
    return container;
  }
}

/** Global game session data passed between scenes */
export interface GameSessionData {
  mode: 'single' | 'local' | 'online';
  gridSize: number;
  playerCount: number;
  playerName: string;
  playerId: string;
  aiDifficulty?: string;
  roomCode?: string;
  room?: import('@shared/events').RoomState;
  gameState?: import('@shared/events').GameState;
  isHost?: boolean;
  localPlayers?: Array<{ id: string; name: string; color: string }>;
}

export const gameData: GameSessionData = {
  mode: 'single',
  gridSize: 6,
  playerCount: 2,
  playerName: 'Player',
  playerId: '',
};
