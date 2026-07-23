import Phaser from 'phaser';
import { Theme } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.spritesheet('trophy', '/assets/trophy-sprite.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    const g = this.add.graphics();
    g.fillStyle(Theme.cyan, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture('particle', 32, 32);
    g.destroy();
  }

  create(): void {
    if (!this.anims.exists('trophy-shine')) {
      this.anims.create({
        key: 'trophy-shine',
        frames: this.anims.generateFrameNumbers('trophy', { start: 0, end: 44 }),
        frameRate: 16,
        repeat: -1,
      });
    }

    this.scene.start('GameSelectionScene');
  }
}
