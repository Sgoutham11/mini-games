import Phaser from 'phaser';
import { Theme } from '../config';
import type { GameType, LeaderboardPlayer } from '../services/LeaderboardService';

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const fmtRatio = (value: number | undefined) => (value ?? 0).toFixed(2);
const colorText = (color: number) => Phaser.Display.Color.IntegerToColor(color).rgba;

function fitChampionName(name: string): string {
  return name.length > 13 ? `${name.slice(0, 12)}...` : name;
}

function drawAngledPlate(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  stroke: number,
  alpha = 0.92
): void {
  const cut = 18;
  graphics.fillStyle(fill, alpha);
  graphics.lineStyle(2, stroke, 0.75);
  graphics.beginPath();
  graphics.moveTo(x + cut, y);
  graphics.lineTo(x + w - cut, y);
  graphics.lineTo(x + w, y + h / 2);
  graphics.lineTo(x + w - cut, y + h);
  graphics.lineTo(x + cut, y + h);
  graphics.lineTo(x, y + h / 2);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

function drawTrophyIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  accent: number,
  label: string
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const trophy = scene.add.sprite(0, 0, 'trophy');
  trophy.setDisplaySize(38, 38);
  trophy.play('trophy-shine');

  const game = scene.add.text(0, 26, label, {
    fontFamily: Theme.fontFamily,
    fontSize: label.length > 3 ? '9px' : '10px',
    color: colorText(accent),
    fontStyle: 'bold',
  }).setOrigin(0.5);
  game.setResolution(window.devicePixelRatio || 2);

  container.add([trophy, game]);
  return container;
}

export function createBestPlayerCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  player: LeaderboardPlayer | null,
  state: 'loading' | 'ready' | 'empty' | 'error',
  accent: number
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();

  let name = 'Loading...';
  let score = 'Fetching scores';
  if (state === 'empty') {
    name = 'No champion yet';
    score = 'Play a match';
  } else if (state === 'error') {
    name = 'Unavailable';
    score = 'Try again later';
  } else if (player) {
    name = fitChampionName(player.playerName);
    score = `${player.totalWins}W  ${player.totalLosses}L  R ${fmtRatio(player.winLossRatio)}`;
  }

  const gameName = title.replace(' Champion', '').toUpperCase();
  const plateY = 2;
  drawAngledPlate(bg, -w / 2 + 4, plateY, w - 8, 40, Theme.bgCell, accent, 0.95);
  drawAngledPlate(bg, -w / 2 + 34, plateY + 34, w - 68, 22, Theme.bgPanel, accent, 0.88);

  const trophy = drawTrophyIcon(scene, 0, -44, accent, gameName);
  const playerName = scene.add.text(0, plateY + 20, name, {
    fontFamily: Theme.fontFamily,
    fontSize: '15px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const stats = scene.add.text(0, plateY + 45, score, {
    fontFamily: Theme.fontFamily,
    fontSize: '10px',
    color: '#ccccdd',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  [playerName, stats].forEach(text => text.setResolution(window.devicePixelRatio || 2));
  container.add([bg, trophy, playerName, stats]);
  return container;
}

export class LeaderboardStrip {
  readonly container: Phaser.GameObjects.Container;

  private viewport: Phaser.GameObjects.Container;
  private content: Phaser.GameObjects.Container;
  private statusText: Phaser.GameObjects.Text;
  private maskGraphics: Phaser.GameObjects.Graphics;
  private scrollHeight = 0;
  private visibleHeight = 0;
  private paused = false;
  private motionDisabled = reducedMotion();
  private readonly updateHandler: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly w: number,
    private readonly h: number,
    private readonly title: string,
    private readonly gameType: GameType,
    private readonly autoScroll = true
  ) {
    this.container = scene.add.container(x, y);
    const accent = gameType === 'BINGO' ? Theme.green : Theme.cyan;

    const bg = scene.add.graphics();
    bg.fillStyle(Theme.bgPanel, 0.92);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);

    const heading = scene.add.text(-w / 2 + 14, -h / 2 + 10, title, {
      fontFamily: Theme.fontFamily,
      fontSize: '13px',
      color: Phaser.Display.Color.IntegerToColor(accent).rgba,
      fontStyle: 'bold',
    });
    heading.setResolution(window.devicePixelRatio || 2);

    const header = this.createHeaderRow(-w / 2 + 12, -h / 2 + 32, w - 24, 16, accent);

    this.statusText = scene.add.text(0, 24, 'Loading leaderboard...', {
      fontFamily: Theme.fontFamily,
      fontSize: '11px',
      color: '#888899',
    }).setOrigin(0.5);
    this.statusText.setResolution(window.devicePixelRatio || 2);

    this.visibleHeight = h - 50;
    this.viewport = scene.add.container(-w / 2 + 12, -h / 2 + 50);
    this.content = scene.add.container(0, 0);
    this.viewport.add(this.content);

    this.maskGraphics = scene.add.graphics();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(x - w / 2 + 10, y - h / 2 + 48, w - 20, this.visibleHeight);
    this.maskGraphics.setVisible(false);
    this.viewport.setMask(this.maskGraphics.createGeometryMask());

    const hit = scene.add.zone(0, 10, w, h - 20).setOrigin(0.5).setInteractive();
    hit.on('pointerover', () => this.paused = true);
    hit.on('pointerout', () => this.paused = false);
    hit.on('pointerdown', () => this.paused = true);
    hit.on('pointerup', () => this.paused = false);
    hit.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => {
      this.paused = true;
      this.content.y = Phaser.Math.Clamp(
        this.content.y - dy * 0.35,
        -Math.max(0, this.scrollHeight - this.visibleHeight),
        0
      );
    });

    this.container.add([bg, heading, header, this.viewport, this.statusText, hit]);
    this.updateHandler = () => this.updateScroll();
    scene.events.on('update', this.updateHandler);
    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  setLoading(): void {
    this.content.removeAll(true);
    this.scrollHeight = 0;
    this.statusText.setText('Loading leaderboard...');
    this.statusText.setVisible(true);
  }

  setError(): void {
    this.content.removeAll(true);
    this.scrollHeight = 0;
    this.statusText.setText('Leaderboard unavailable');
    this.statusText.setVisible(true);
  }

  setPlayers(players: LeaderboardPlayer[], emptyMessage: string): void {
    this.content.removeAll(true);
    this.content.y = 0;
    const visiblePlayers = players.slice(0, 10);
    if (visiblePlayers.length === 0) {
      this.scrollHeight = 0;
      this.statusText.setText(emptyMessage);
      this.statusText.setVisible(true);
      return;
    }

    this.statusText.setVisible(false);
    const rowH = Math.floor(this.visibleHeight / 3);
    visiblePlayers.forEach((player, index) => {
      this.content.add(this.createPlayerRow(0, index * rowH, this.w - 24, rowH, player));
    });
    this.scrollHeight = visiblePlayers.length * rowH;

    if (visiblePlayers.length > 3 && !this.motionDisabled) {
      visiblePlayers.forEach((player, index) => {
        this.content.add(this.createPlayerRow(0, this.scrollHeight + index * rowH, this.w - 24, rowH, player));
      });
    }
  }

  destroy(): void {
    this.scene.events.off('update', this.updateHandler);
    this.maskGraphics.destroy();
    this.container.destroy();
  }

  private createHeaderRow(
    x: number,
    y: number,
    w: number,
    h: number,
    accent: number
  ): Phaser.GameObjects.Container {
    const header = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(Theme.bgCell, 0.78);
    bg.fillRoundedRect(0, 0, w, h, 5);

    const labels: Array<[string, number, number?]> = [
      ['RANK', 8],
      ['PLAYER', 54],
      ['GAMES', w - 172, 0.5],
      ['W', w - 122, 0.5],
      ['L', w - 82, 0.5],
      ['RATIO', w - 8, 1],
    ];

    const texts = labels.map(([label, lx, originX = 0]) => this.scene.add.text(lx, h / 2, label, {
      fontFamily: Theme.fontFamily,
      fontSize: '8px',
      color: Phaser.Display.Color.IntegerToColor(accent).rgba,
      fontStyle: 'bold',
    }).setOrigin(originX, 0.5));
    texts.forEach(text => text.setResolution(window.devicePixelRatio || 2));
    header.add([bg, ...texts]);
    return header;
  }

  private createPlayerRow(
    x: number,
    y: number,
    w: number,
    h: number,
    player: LeaderboardPlayer
  ): Phaser.GameObjects.Container {
    const row = this.scene.add.container(x, y);
    const accent = this.gameType === 'BINGO' ? Theme.green : Theme.cyan;
    const bg = this.scene.add.graphics();
    const leftShade = player.rank % 2 === 1 ? Theme.bgCell : 0x171722;
    bg.fillGradientStyle(leftShade, Theme.bgPanel, leftShade, Theme.bgPanel, 0.86, 0.86, 0.72, 0.72);
    bg.fillRoundedRect(0, 1, w, h - 2, 6);

    const centerY = h / 2;
    const rank = this.scene.add.text(8, centerY, String(player.rank).padStart(2, '0'), {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: Phaser.Display.Color.IntegerToColor(accent).rgba,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const name = this.scene.add.text(54, centerY, this.fitName(player.playerName), {
      fontFamily: Theme.fontFamily,
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const games = this.scene.add.text(w - 172, centerY, String(player.totalGames).padStart(2, '0'), {
      fontFamily: Theme.fontFamily,
      fontSize: '11px',
      color: '#ccccdd',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    const wins = this.scene.add.text(w - 122, centerY, String(player.totalWins).padStart(2, '0'), {
      fontFamily: Theme.fontFamily,
      fontSize: '11px',
      color: '#ccccdd',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    const losses = this.scene.add.text(w - 82, centerY, String(player.totalLosses).padStart(2, '0'), {
      fontFamily: Theme.fontFamily,
      fontSize: '11px',
      color: '#ccccdd',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    const ratio = this.scene.add.text(w - 8, centerY, fmtRatio(player.winLossRatio), {
      fontFamily: Theme.fontFamily,
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    [rank, name, games, wins, losses, ratio].forEach(text => text.setResolution(window.devicePixelRatio || 2));
    row.add([bg, rank, name, games, wins, losses, ratio]);
    return row;
  }

  private updateScroll(): void {
    if (!this.autoScroll || this.paused || this.motionDisabled || this.scrollHeight <= this.visibleHeight) return;
    this.content.y -= 0.09;
    if (this.content.y <= -this.scrollHeight) {
      this.content.y = 0;
    }
  }

  private fitName(name: string): string {
    return name.length > 12 ? `${name.slice(0, 11)}...` : name;
  }
}
