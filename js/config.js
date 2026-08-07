export const CONFIG = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 628,
  WALL_LEFT: 64,
  WALL_RIGHT: 1216,

  GRAVITY: 2800,

  PLAYER: {
    SPEED: 360,
    ACCEL: 3000,
    AIR_ACCEL: 1400,
    FRICTION: 2400,
    JUMP_VEL: 980,
    COYOTE_TIME: 0.10,
    JUMP_BUFFER: 0.12,
    MAX_HEALTH: 100,
    HURT_INVULN: 0.5,
    PUNCH: {
      DAMAGE: 9,
      REACH: 78,
      HEIGHT: 70,
      WINDUP: 0.05,
      ACTIVE: 0.10,
      RECOVER: 0.16,
      COOLDOWN: 0.02,
      KNOCKBACK: 320,
      HIT_PAUSE: 0.055,
    },
    KICK: {
      DAMAGE: 16,
      REACH: 104,
      HEIGHT: 90,
      WINDUP: 0.08,
      ACTIVE: 0.12,
      RECOVER: 0.26,
      COOLDOWN: 0.05,
      KNOCKBACK: 560,
      HIT_PAUSE: 0.085,
    },
  },

  ENEMY: {
    SPEED: 150,
    HEALTH: 34,
    DAMAGE: 10,
    ATTACK_REACH: 86,
    ATTACK_WINDUP: 0.34,
    ATTACK_ACTIVE: 0.12,
    ATTACK_RECOVER: 0.34,
    KNOCKBACK: 380,
    MAX_ALIVE: 6,
  },

  COMBO_WINDOW: 2.2,
  COMBO_TIERS: [5, 10, 15, 20, 30],   // milestone combos -> bonus + banner
  COMBO_TIER_BONUS: 100,              // flat score bonus per milestone

  // Boss waves — every BOSS_WAVE_EVERY-th wave spawns a single elite boss
  // with a telegraphed ground-slam that emits shockwaves the player must jump.
  BOSS: {
    WAVE_EVERY: 5,
    HEALTH: 220,
    DAMAGE: 18,
    SPEED: 95,
    SCALE: 1.6,
    ATTACK_REACH: 120,
    SCORE: 1500,
    SLAM_INTERVAL: 3.4,           // seconds between slams (phase 1)
    SLAM_INTERVAL_ENRAGED: 2.2,   // phase 2 (<=50% hp)
    SLAM_WINDUP: 0.7,             // telegraph duration — the must-jump cue
    SLAM_LEAP_VX: 360,
    SLAM_LEAP_VY: 760,
    SLAM_RECOVER: 0.55,
    ENRAGE_AT: 0.5,               // hp fraction that triggers phase 2 + minions
    ENRAGE_SUMMONS: 2,            // grunts spawned on enrage
    SHOCKWAVE_SPEED: 430,
    SHOCKWAVE_LIFE: 2.6,
    SHOCKWAVE_DAMAGE: 12,
    SHOCKWAVE_CLEAR: 34,          // feet must rise this many px to jump over
  },
};

// Difficulty presets — multiplied into enemy stats at spawn + player HP.
export const DIFFICULTY = {
  easy:   { label: 'EASY',   enemyHp: 0.80, enemySpeed: 0.90, enemyDmg: 0.80, aggr: 0.85, playerHp: 120, color: '#6bff9e' },
  normal: { label: 'NORMAL', enemyHp: 1.00, enemySpeed: 1.00, enemyDmg: 1.00, aggr: 1.00, playerHp: 100, color: '#35e1ff' },
  hard:   { label: 'HARD',   enemyHp: 1.20, enemySpeed: 1.10, enemyDmg: 1.20, aggr: 1.20, playerHp: 90,  color: '#ff6f5c' },
};

export const COLORS = {
  bgTop: 0x10131f,
  bgBottom: 0x1b2238,
  ground: 0x0c0f18,
  groundLine: 0x35506e,
  player: {
    limb: 0xeaf4ff,
    joint: 0xbfe3ff,
    head: 0xffffff,
    accent: 0x35e1ff,
    fist: 0xffe26b,
  },
  enemy: {
    limb: 0xff6f5c,
    joint: 0xffb4a8,
    head: 0xffd2c9,
    accent: 0xff3b30,
    fist: 0xff8a3d,
  },
  enemyBrute: {
    limb: 0xb06bff,
    joint: 0xd9b3ff,
    head: 0xecd9ff,
    accent: 0x8b2fff,
    fist: 0xd36bff,
  },
  enemyRunner: {
    limb: 0x6bff9e,
    joint: 0xb3ffd2,
    head: 0xd9ffe9,
    accent: 0x16c45a,
    fist: 0x9aff6b,
  },
};
