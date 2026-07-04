import Phaser from 'phaser';
import { Theme } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const g = this.add.graphics();
    g.fillStyle(Theme.cyan, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture('particle', 32, 32);
    g.destroy();
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
