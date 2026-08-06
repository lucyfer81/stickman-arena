import { CONFIG, COLORS } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // procedural textures
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('dot', 16, 16);
    g.clear();

    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(6, 6, 6);
    g.generateTexture('spark', 12, 12);
    g.destroy();

    // soft vignette texture
    const v = this.make.graphics({ add: false });
    const w = CONFIG.WIDTH, h = CONFIG.HEIGHT;
    for (let i = 0; i < 60; i++) {
      v.fillStyle(0x000000, 0.012);
      v.fillRect(0, 0, w, h);
      // not a real radial; we'll do overlay via CSS-like rectangles
    }
    v.generateTexture('vignette', w, h);
    v.destroy();

    this.scene.start('Title');
  }
}
