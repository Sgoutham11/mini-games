import Phaser from 'phaser';
import { Theme } from '../config';
import { NeonUI } from './NeonUI';
import type { BingoPlayerBoard } from '@shared/bingo-events';

export class BingoBoardView extends Phaser.GameObjects.Container {
  private cells: Phaser.GameObjects.Container[] = [];
  private onNumberClick?: (number: number) => void;
  private lastCellSize = 0;
  private lastTotalSize = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private size: number,
    private boardSizePx: number
  ) {
    super(scene, x, y);
    scene.add.existing(this);
  }

  setNumberClickHandler(handler: (number: number) => void): void {
    this.onNumberClick = handler;
  }

  updateBoard(playerBoard: BingoPlayerBoard, selectedNumbers: number[], canPlay: boolean, accentColor: number): void {
    this.removeAll(true);
    this.cells = [];

    const gap = 6;
    const cellSize = Math.floor((this.boardSizePx - gap * (this.size - 1)) / this.size);
    const total = cellSize * this.size + gap * (this.size - 1);
    this.lastCellSize = cellSize;
    this.lastTotalSize = total;
    const selected = new Set(selectedNumbers);

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const number = playerBoard.board[row][col];
        const marked = playerBoard.marked[row][col] || selected.has(number);
        const x = -total / 2 + col * (cellSize + gap) + cellSize / 2;
        const y = -total / 2 + row * (cellSize + gap) + cellSize / 2;
        const cell = this.createCell(x, y, cellSize, number, marked, canPlay && !marked, accentColor);
        this.add(cell);
        this.cells.push(cell);
      }
    }

    this.drawCompletedPatternLines(playerBoard.completedPatterns, accentColor);
  }

  private drawCompletedPatternLines(patterns: string[], accentColor: number): void {
    if (patterns.length === 0) return;

    const lines = this.scene.add.graphics();
    lines.lineStyle(Math.max(2, Math.floor(this.lastCellSize * 0.045)), accentColor, 0.45);

    const start = -this.lastTotalSize / 2 + this.lastCellSize / 2;
    const end = this.lastTotalSize / 2 - this.lastCellSize / 2;
    const step = this.lastCellSize + 6;

    patterns.forEach(pattern => {
      if (pattern.startsWith('ROW_')) {
        const row = Number(pattern.replace('ROW_', ''));
        const y = start + row * step;
        lines.lineBetween(start, y, end, y);
        return;
      }

      if (pattern.startsWith('COL_')) {
        const col = Number(pattern.replace('COL_', ''));
        const x = start + col * step;
        lines.lineBetween(x, start, x, end);
        return;
      }

      if (pattern === 'DIAG_1') {
        lines.lineBetween(start, start, end, end);
        return;
      }

      if (pattern === 'DIAG_2') {
        lines.lineBetween(end, start, start, end);
      }
    });

    this.add(lines);
  }

  private createCell(
    x: number,
    y: number,
    size: number,
    number: number,
    marked: boolean,
    enabled: boolean,
    accentColor: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();

    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(marked ? 0x12313c : Theme.bgCell, 1);
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8);
      bg.lineStyle(marked ? 2 : 1, marked || hover ? accentColor : Theme.grayDark, marked || hover ? 0.95 : 0.45);
      bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 8);
      if (hover && enabled) {
        bg.fillStyle(accentColor, 0.12);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8);
      }
      if (marked) {
        bg.fillStyle(Theme.green, 1);
        bg.fillCircle(size / 2 - 8, -size / 2 + 8, 3);
      }
    };
    draw(false);

    const text = this.scene.add.text(0, 0, String(number), {
      fontFamily: Theme.fontFamily,
      fontSize: `${Math.max(11, Math.floor(size * 0.34))}px`,
      color: marked ? '#00e5ff' : '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setResolution(window.devicePixelRatio || 2);

    container.add([bg, text]);
    container.setSize(size, size);
    if (enabled) {
      NeonUI.addHitZone(this.scene, container, size, size);
      container.on('pointerover', () => draw(true));
      container.on('pointerout', () => draw(false));
      container.on('pointerdown', () => this.onNumberClick?.(number));
    }
    return container;
  }
}
