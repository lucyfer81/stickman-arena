import { CONFIG } from '../config.js';

// A glowing pickup. Three types share one entity: health (cyan cross, +HP),
// rage (red/orange bolt, temporary buff), score (gold gem, instant points).
// The scene reads `type` + `_collected` on collision and applies the effect.
const STYLE = {
  health: { glow: 0x35e1ff, body: 0x0a1220, edge: 0x35e1ff, mark: 0xeaf4ff },
  rage:   { glow: 0xff8a3d, body: 0x1a0a08, edge: 0xff3b30, mark: 0xffe26b },
  score:  { glow: 0xffd23f, body: 0x14110a, edge: 0xffd23f, mark: 0xffffff },
};

export class Pickup extends Phaser.GameObjects.Graphics {
  constructor(scene, x, y, type = 'health', opts = {}) {
    super(scene);
    this.x = x;
    this.y = y;
    this.type = type;
    this.st = STYLE[type] || STYLE.health;
    // default: a little upward pop out of a fallen enemy. `drop: true` makes a
    // supply crate fall from the sky instead.
    this.vy = opts.drop ? 60 : -260;
    this.vx = opts.drop ? 0 : (Math.random() - 0.5) * 120;
    this.onGround = false;
    this.life = CONFIG.CONTENT.PICKUP.LIFE;
    this.dead = false;
    this.t = opts.drop ? -Math.random() : 0; // stagger flicker for multi-drops
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
    if (Math.abs(dx) < 42 && Math.abs(dy) < 74) {
      this.dead = true;
      this._collected = true;
    }

    // draw — type-specific silhouette so the player can read the drop at a glance
    const bob = this.onGround ? Math.sin(Math.max(0, this.t) * 4) * 4 : 0;
    const blink = this.life < 3 ? (Math.sin(this.t * 16) > 0 ? 1 : 0.3) : 1;
    const g = this;
    g.clear();
    const R = this.type === 'score' ? 12 : 13;
    const s = this.st;
    // glow
    g.fillStyle(s.glow, 0.18 * blink);
    g.fillCircle(0, bob, R + 8 + Math.sin(this.t * 5) * 2);
    if (this.type === 'score') {
      // gold gem (diamond)
      g.fillStyle(s.body, 0.95 * blink);
      const pts = [[0, -R], [R, 0], [0, R], [-R, 0]];
      g.fillPoints(pts.map((p) => ({ x: p[0], y: p[1] + bob })), true);
      g.lineStyle(3, s.edge, blink);
      g.strokePoints(pts.map((p) => ({ x: p[0], y: p[1] + bob })), true);
      g.fillStyle(s.mark, blink);
      g.fillCircle(0, bob, R * 0.35);
    } else if (this.type === 'rage') {
      // rage capsule with a lightning bolt
      g.fillStyle(s.body, 0.95 * blink);
      g.fillRoundedRect(-R, -R + bob, R * 2, R * 2, 6);
      g.lineStyle(3, s.edge, blink);
      g.strokeRoundedRect(-R, -R + bob, R * 2, R * 2, 6);
      g.fillStyle(s.mark, blink);
      g.beginPath();
      g.moveTo(2, -9 + bob); g.lineTo(-5, 1 + bob); g.lineTo(-1, 1 + bob);
      g.lineTo(-3, 9 + bob); g.lineTo(5, -2 + bob); g.lineTo(1, -2 + bob);
      g.closePath(); g.fillPath();
    } else {
      // health capsule + plus
      g.fillStyle(s.body, 0.95 * blink);
      g.fillRoundedRect(-R, -R + bob, R * 2, R * 2, 6);
      g.lineStyle(3, s.edge, blink);
      g.strokeRoundedRect(-R, -R + bob, R * 2, R * 2, 6);
      g.fillStyle(s.mark, blink);
      g.fillRect(-2, -8 + bob, 4, 16);
      g.fillRect(-8, -2 + bob, 16, 4);
    }
    g.alpha = 1;

    if (this.dead) this._destroy();
  }

  _destroy() { this.destroy(); }
}
