import Phaser from 'phaser';
import { GameConfig } from './config';
import { telegram } from './telegram/TelegramService';
import { BootScene } from './scenes/BootScene';
import { GameSelectionScene } from './scenes/GameSelectionScene';
import { MenuScene } from './scenes/MenuScene';
import { SinglePlayerSetupScene } from './scenes/SinglePlayerSetupScene';
import { LocalSetupScene } from './scenes/LocalSetupScene';
import { OnlineLobbyScene } from './scenes/OnlineLobbyScene';
import { WaitingRoomScene } from './scenes/WaitingRoomScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
telegram.init();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GameConfig.width,
  height: GameConfig.height,
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    GameSelectionScene,
    MenuScene,
    SinglePlayerSetupScene,
    LocalSetupScene,
    OnlineLobbyScene,
    WaitingRoomScene,
    GameScene,
    ResultScene
  ],
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);
