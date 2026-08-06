import { CONFIG } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { AudioManager } from './systems/AudioManager.js';
import { Meta } from './systems/Meta.js';

const audio = new AudioManager();
window.__audio = audio;
window.__meta = Meta;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0e16',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CONFIG.WIDTH,
    height: CONFIG.HEIGHT,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 3,
  },
  physics: { default: 'arcade' },
  scene: [BootScene, TitleScene, GameScene, UIScene, GameOverScene],
};

const game = new Phaser.Game(config);
if (typeof window !== 'undefined') window.__game = game;
game.registry.set('audio', audio);

// resume audio on first interaction
const resumeOnce = () => {
  audio.resume();
  window.removeEventListener('pointerdown', resumeOnce);
  window.removeEventListener('keydown', resumeOnce);
};
window.addEventListener('pointerdown', resumeOnce);
window.addEventListener('keydown', resumeOnce);

window.addEventListener('beforeunload', () => game.destroy(true));
