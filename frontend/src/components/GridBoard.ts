import Phaser from 'phaser';
import { Theme } from '../config';
import type { Cell, ScoredLine, PlayerInfo } from '@shared/events';

export class GridBoard extends Phaser.GameObjects.Container {
  private cells: Phaser.GameObjects.Container[][] = [];
  private lineGraphics: Phaser.GameObjects.Graphics;
  private gridSize: number;
  private cellSize: number;
  private boardX: number;
  private boardY: number;
  private onCellClick?: (row: number, col: number) => void;
  private allScoredLines: ScoredLine[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, gridSize: number, maxWidth: number) {
    super(scene, x, y);
    this.gridSize = gridSize;
    this.cellSize = Math.floor((maxWidth - (gridSize + 1) * 4) / gridSize);
    const totalSize = this.gridSize * this.cellSize + (this.gridSize + 1) * 4;
    this.boardX = -totalSize / 2;
    this.boardY = -totalSize / 2;

    this.lineGraphics = scene.add.graphics();
    this.add(this.lineGraphics);

    this.buildGrid();
    scene.add.existing(this);
  }

  private buildGrid(): void {
    for (let r = 0; r < this.gridSize; r++) {
      this.cells[r] = [];
      for (let c = 0; c < this.gridSize; c++) {
        const cx = this.boardX + 4 + c * (this.cellSize + 4) + this.cellSize / 2;
        const cy = this.boardY + 4 + r * (this.cellSize + 4) + this.cellSize / 2;

        const cellContainer = this.scene.add.container(cx, cy);
        const bg = this.scene.add.graphics();
        bg.fillStyle(Theme.bgCell, 1);
        bg.fillRoundedRect(-this.cellSize / 2, -this.cellSize / 2, this.cellSize, this.cellSize, 6);
        bg.lineStyle(1, 0x2a2a3a, 0.8);
        bg.strokeRoundedRect(-this.cellSize / 2, -this.cellSize / 2, this.cellSize, this.cellSize, 6);

        const letterText = this.scene.add.text(0, 0, '', {
          fontFamily: Theme.fontFamily,
          fontSize: `${Math.floor(this.cellSize * 0.5)}px`,
          fontStyle: 'bold',
        }).setOrigin(0.5);
        letterText.setResolution(window.devicePixelRatio || 2);

        cellContainer.add([bg, letterText]);
        cellContainer.setSize(this.cellSize, this.cellSize);
        cellContainer.setData('row', r);
        cellContainer.setData('col', c);
        cellContainer.setData('bg', bg);
        cellContainer.setData('text', letterText);
        cellContainer.setInteractive({ useHandCursor: true });

        cellContainer.on('pointerover', () => {
          if (!letterText.text) {
            bg.clear();
            bg.fillStyle(Theme.bgCellHover, 1);
            bg.fillRoundedRect(-this.cellSize / 2, -this.cellSize / 2, this.cellSize, this.cellSize, 6);
            bg.lineStyle(1, Theme.cyan, 0.4);
            bg.strokeRoundedRect(-this.cellSize / 2, -this.cellSize / 2, this.cellSize, this.cellSize, 6);
          }
        });

        cellContainer.on('pointerout', () => this.resetCellBg(r, c));
        cellContainer.on('pointerdown', () => {
          if (!letterText.text && this.onCellClick) {
            this.onCellClick(r, c);
          }
        });

        this.cells[r][c] = cellContainer;
        this.add(cellContainer);
      }
    }
  }

  setCellClickHandler(handler: (row: number, col: number) => void): void {
    this.onCellClick = handler;
  }

  getCellWorldPosition(row: number, col: number): { x: number; y: number } {
    const cell = this.cells[row]?.[col];
    if (!cell) return { x: this.x, y: this.y };

    const matrix = cell.getWorldTransformMatrix();
    return { x: matrix.tx, y: matrix.ty };
  }

  updateFromBoard(board: Cell[][], players: PlayerInfo[]): void {
    const colorMap = new Map(players.map(p => [p.id, p.color]));
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = board[r]?.[c];
        if (!cell) continue;
        const text = this.cells[r][c].getData('text') as Phaser.GameObjects.Text;
        if (cell.value) {
          text.setText(cell.value);
          const color = cell.ownerId ? (colorMap.get(cell.ownerId) ?? '#00f0ff') : '#00f0ff';
          text.setColor(color);
          text.setShadow(0, 0, color, 6, true, true);
        }
      }
    }
  }

  addScoredLines(lines: ScoredLine[], players: PlayerInfo[]): void {
    this.allScoredLines.push(...lines);
    this.drawAllLines(players);
  }

  setAllScoredLines(lines: ScoredLine[], players: PlayerInfo[]): void {
    this.allScoredLines = lines;
    this.drawAllLines(players);
  }

  private drawAllLines(players: PlayerInfo[]): void {
    this.lineGraphics.clear();
    const colorMap = new Map(players.map(p => [p.id, parseInt(p.color.replace('#', ''), 16)]));

    for (const line of this.allScoredLines) {
      const color = colorMap.get(line.playerId) ?? Theme.cyan;
      const points = line.cells.map(({ row, col }) => {
        const cx = this.boardX + 4 + col * (this.cellSize + 4) + this.cellSize / 2;
        const cy = this.boardY + 4 + row * (this.cellSize + 4) + this.cellSize / 2;
        return { x: cx, y: cy };
      });

      if (points.length >= 2) {
        this.lineGraphics.lineStyle(3, color, 0.9);
        this.lineGraphics.beginPath();
        this.lineGraphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          this.lineGraphics.lineTo(points[i].x, points[i].y);
        }
        this.lineGraphics.strokePath();

        this.lineGraphics.lineStyle(6, color, 0.2);
        this.lineGraphics.beginPath();
        this.lineGraphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          this.lineGraphics.lineTo(points[i].x, points[i].y);
        }
        this.lineGraphics.strokePath();
      }
    }
  }

  private resetCellBg(r: number, c: number): void {
    const cell = this.cells[r][c];
    const bg = cell.getData('bg') as Phaser.GameObjects.Graphics;
    const text = cell.getData('text') as Phaser.GameObjects.Text;
    if (!text.text) {
      bg.clear();
      bg.fillStyle(Theme.bgCell, 1);
      bg.fillRoundedRect(-this.cellSize / 2, -this.cellSize / 2, this.cellSize, this.cellSize, 6);
      bg.lineStyle(1, 0x2a2a3a, 0.8);
      bg.strokeRoundedRect(-this.cellSize / 2, -this.cellSize / 2, this.cellSize, this.cellSize, 6);
    }
  }

  animatePlacement(row: number, col: number): void {
    const cell = this.cells[row][col];
    this.scene.tweens.add({
      targets: cell,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }
}

export class LetterSelector extends Phaser.GameObjects.Container {
  private onSelect?: (letter: 'S' | 'O') => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const sBtn = this.createLetterBtn('S', -40);
    const oBtn = this.createLetterBtn('O', 40);
    this.add([sBtn, oBtn]);
    scene.add.existing(this);
  }

  private createLetterBtn(letter: 'S' | 'O', offsetX: number): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(offsetX, 0);
    const size = 56;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a2a3a, 1);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 10);
    bg.lineStyle(2, Theme.white, 0.8);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 10);

    const text = this.scene.add.text(0, 0, letter, {
      fontFamily: Theme.fontFamily,
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setResolution(window.devicePixelRatio || 2);
    text.setShadow(0, 0, '#ffffff', 4, true, true);

    btn.add([bg, text]);
    btn.setSize(size, size);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(Theme.cyan, 0.3);
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 10);
      bg.lineStyle(2, Theme.cyan, 1);
      bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 10);
    });

    btn.on('pointerdown', () => {
      this.onSelect?.(letter);
      this.setVisible(false);
    });

    return btn;
  }

  setSelectHandler(handler: (letter: 'S' | 'O') => void): void {
    this.onSelect = handler;
  }

  showAt(x: number, y: number): void {
    this.setPosition(x, y);
    this.setVisible(true);
  }

  show(): void { this.setVisible(true); }
  hide(): void { this.setVisible(false); }
}

export class PlayerCard extends Phaser.GameObjects.Container {
  private nameText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private indicator: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    super(scene, x, y);

    const panel = scene.add.graphics();
    panel.fillStyle(Theme.bgPanel, 0.9);
    panel.fillRoundedRect(0, 0, w, h, 10);
    panel.lineStyle(1, Theme.cyan, 0.4);
    panel.strokeRoundedRect(0, 0, w, h, 10);

    this.indicator = scene.add.circle(w - 10, 10, 5, Theme.green);
    this.indicator.setVisible(false);

    this.nameText = scene.add.text(12, 10, '', {
      fontFamily: Theme.fontFamily, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    });
    this.nameText.setResolution(window.devicePixelRatio || 2);
    this.statusText = scene.add.text(12, 30, '', {
      fontFamily: Theme.fontFamily, fontSize: '10px', color: '#888899',
    });
    this.statusText.setResolution(window.devicePixelRatio || 2);
    this.scoreText = scene.add.text(w / 2, h - 8, '0', {
      fontFamily: Theme.fontFamily, fontSize: '24px', color: '#00e5ff', fontStyle: 'bold',
    }).setOrigin(0.5, 1);
    this.scoreText.setResolution(window.devicePixelRatio || 2);

    const sosLabel = scene.add.text(w / 2, h - 32, 'SOS', {
      fontFamily: Theme.fontFamily, fontSize: '9px', color: '#666677',
    }).setOrigin(0.5);
    sosLabel.setResolution(window.devicePixelRatio || 2);

    this.add([panel, this.indicator, this.nameText, this.statusText, this.scoreText, sosLabel]);
    scene.add.existing(this);
  }

  update(name: string, score: number, status: string, isActive: boolean, color: string): void {
    this.nameText.setText(name);
    this.scoreText.setText(String(score));
    this.scoreText.setColor(color);
    this.statusText.setText(status);
    this.indicator.setVisible(isActive);
    if (isActive) {
      this.indicator.setFillStyle(Theme.green);
    }
  }
}
