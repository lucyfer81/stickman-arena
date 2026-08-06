import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

// A glowing health pickup that drops from defeated enemies.
export class Pickup extends Phaser.GameObjects.Graphics {
  constructor(scene, x, y) {
    super(scene);
    this.x = x;
    this.y = y;
    this.vy = -260;
    this.vx = (Math.random() - 0.5) * 120;
    this.onGround = false;
    this.life = 9;
    this.dead = false;
    this.t = 0;
    this.setDepth(15);
    scene.add.existing(this);
  }

  update(dt, player) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this._destroy(); return; }
    if (!this.onGround) {
      this.vy += CONFIG.GRAVITY * 0.6 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= CONFIG.GROUND_Y - 6) { this.y = CONFIG.GROUND_Y - 6; this.vy = 0; this.vx = 0; this.onGround = true; }
      if (this.x < CONFIG.WALL_LEFT) this.x = CONFIG.WALL_LEFT;
      if (this.x > CONFIG.WALL_RIGHT) this.x = CONFIG.WALL_RIGHT;
    }

    // collect
    const dx = this.x - player.x;
    const dy = this.y - (player.y - 60);
    if (Math.abs(dx) < 40 && Math.abs(dy) < 70) {
      this.dead = true;
      this._collected = true;
    }

    // draw
    const bob = this.onGround ? Math.sin(this.t * 4) * 4 : 0;
    const blink = this.life < 3 ? (Math.sin(this.t * 16) > 0 ? 1 : 0.3) : 1;
    this.clear();
    const g = this;
    const R = 13;
    // glow
    g.fillStyle(0x35e1ff, 0.18 * blink);
    g.fillCircle(0, bob, R + 8 + Math.sin(this.t * 5) * 2);
    // capsule
    g.fillStyle(0x0a1220, 0.95 * blink);
    g.fillRoundedRect(-R, -R + bob, R * 2, R * 2, 6);
    g.lineStyle(3, 0x35e1ff, blink);
    g.strokeRoundedRect(-R, -R + bob, R * 2, R * 2, 6);
    // plus
    g.fillStyle(0xeaf4ff, blink);
    g.fillRect(-2, -8 + bob, 4, 16);
    g.fillRect(-8, -2 + bob, 16, 4);
    g.alpha = 1;

    if (this.dead) this._destroy();
  }

  _destroy() { this.destroy(); }
}
