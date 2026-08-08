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
      DAMAGE: 11,
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
      RECOVER_WHIFF: 0.42,   // longer endlag when a kick misses -> punishable
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
    // PACK PRESSURE: a skilled player can stunlock a single file of enemies and
    // never lose. Crowds should escalate — once SWARM_THRESHOLD enemies are
    // alive, each extra enemy adds aggression (faster swings) + speed, capped.
    // This rewards killing fast to prevent a swarm and threatens passive play,
    // without touching 1-2-enemy fights (where casuals live). Gated to wave >=
    // MIN_WAVE so the first-minute teaching beats stay gentle.
    SWARM: {
      THRESHOLD: 3,      // alive count at which pressure starts building
      MIN_WAVE: 3,       // don't apply during the gentle opening waves
      AGGR_PER: 0.10,    // aggression added per enemy beyond the threshold
      SPEED_PER: 0.07,   // move-speed added per enemy beyond the threshold
      MAX_BONUS: 0.35,   // hard cap so a full crowd stays fair
    },
  },

  COMBO_WINDOW: 2.2,
  COMBO_TIERS: [5, 10, 15, 20, 30],   // milestone combos -> bonus + banner
  COMBO_TIER_BONUS: 100,              // flat score bonus per milestone
  // COMBO BRIDGE: a kill grants extra combo time so the kill -> next-enemy flow
  // (the core fun) doesn't drop the chain. Telemetry showed casuals stalling at
  // best-combo 9 — just short of the x10 milestone — because the 2.2s window
  // couldn't bridge the gap between a dead enemy and the next one walking up.
  COMBO_KILL_BRIDGE: 0.9,             // extra seconds added to the window on a kill

  // First-minute retention tuning. Goal: cut the opening "dead time" (enemies
  // walking in from the walls), give a teachable first contact, and surface a
  // goal — without touching the wave-5 boss or the difficulty/skins systems.
  RETENTION: {
    // waves where spawns appear on an inner band (closer to mid) instead of walls
    INNER_SPAWN_WAVES: 3,
    INNER_SPAWN_OFFSET: 300,      // px in from each wall during early waves
    EARLY_WAVE_BREAK: 0.7,        // between-wave gap for early waves (was 1.1)
    EARLY_WAVE_BREAK_WAVES: 3,
    LATE_WAVE_BREAK: 1.1,
    EARLY_SPAWN_GAP: [0.22, 0.45],// gap between spawns in early waves (was 0.3-0.65)
    LATE_SPAWN_GAP: [0.30, 0.65],
    WAVE1_FIRST_SPAWN: 0.15,      // spawnTimer at wave-1 start (was 0.3)
    EARLY_AGR_FLOOR: 0.95,        // aggrMul floor for early waves (was 0.8)
    // teaching hints (UIScene) — gated to early waves so they don't clutter
    TEACH_WAVES: 2,
    TEACH_APPROACH_DIST: 260,     // show pre-contact pointer when nearest enemy within this
    TEACH_AFK_DIST: 110,          // "enemy is on you" threshold for the AFK lifeline
    TEACH_AFK_GRACE: 1.6,         // seconds at close range with no attack before lifeline fires
    // FIRST BLOOD — celebrate the run's first (non-boss) kill
    FIRST_BLOOD_SLOWMO: 0.30,
    FIRST_BLOOD_PAUSE: 0.12,
    // vanguard mini-elite — one early duel, wave 2 first spawn only
    VANGUARD_WAVE: 2,
    // FIRST-TIME ASSIST: wave 1's opening enemy is a "training dummy" — it
    // approaches but holds its swing until the player hits it first OR this grace
    // expires. AFK/confused first-timers were bleeding out 0-score in wave 1
    // (audit). The truce gives them room to see the J-pointer, land a punch, and
    // earn the FIRST BLOOD celebration — teaching the core loop with a guaranteed
    // early win instead of a confused death.
    FIRST_ENEMY_PASSIVE_GRACE: 5.0,  // seconds the dummy holds its swing
    // DEAD TIME: wave-4+ enemies spawn at the walls and walk ~560px to mid (~3.8s
    // of nothing-to-do). A short "sprint-in" entrance closes that gap fast so the
    // action stays dense past the early game, while preserving the "pressure from
    // the edges" flank feel. Only the approach (pre-commitRange) is boosted, so a
    // sprinting enemy still settles to normal speed once in the fight.
    SPRINT_IN: { TIME: 0.6, BOOST: 2.0 },  // seconds of entrance sprint / speed multiplier
  },

  // ---- SECOND WIND ("The Broken") — surprising comeback mechanic ----
  // Once per run, lethal damage (0 HP) does NOT end the game. The stickman
  // shatters (right arm detaches + screen desaturates) and enters a short,
  // high-risk window: 1 HP, double damage, faster. Kill to extend / drop
  // heals; reach a health pickup to REFORM and keep the run alive. Rarity
  // (once per run) keeps it a memorable story, not a crutch.
  LASTSTAND: {
    DURATION: 6.0,            // seconds in the broken window
    KILL_TIME_BONUS: 1.2,     // seconds added per kill during broken
    KILL_HEAL_CHANCE: 0.55,   // chance a broken-window kill drops health
    DMG_MUL: 2.0,             // outgoing damage multiplier while broken
    SPEED_MUL: 1.3,           // move-speed multiplier while broken
    ENTRY_INVULN: 1.0,        // brief i-frames on shatter so the killing blow
                              // doesn't instantly re-kill at 1 HP
    REFORM_HP_FRAC: 0.40,     // HP fraction restored on a successful reform
    REFORM_SCORE_BONUS: 750,  // score reward for pulling off a reform
    REFORM_SLOWMO: 0.35,      // slow-mo seconds on the reform climax
  },

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
    NAME: { slammer: 'THE SLAMMER', caster: 'THE ORACLE' },
    SLAM_INTERVAL: 3.4,           // seconds between slams (phase 1)
    SLAM_INTERVAL_ENRAGED: 2.2,   // phase 2 (<=50% hp)
    SLAM_WINDUP: 0.7,             // telegraph duration — the must-jump cue
    SLAM_LEAP_VX: 360,
    SLAM_LEAP_VY: 760,
    SLAM_RECOVER: 0.55,
    ENRAGE_AT: 0.5,               // hp fraction that triggers phase 2 + minions
    ENRAGE_SUMMONS: 2,            // grunts spawned on enrage
    ENRAGE_SUMMONS_KIND: { slammer: 'grunt', caster: 'leaper' }, // caster's adds punish jump-dodging
    SHOCKWAVE_SPEED: 430,
    SHOCKWAVE_LIFE: 2.6,
    SHOCKWAVE_DAMAGE: 12,
    SHOCKWAVE_CLEAR: 34,          // feet must rise this many px to jump over
    // ---- Boss variant B: "The Oracle" — a ranged caster that alternates with
    // the slammer (even boss-index waves: 10, 20, 30...). Same HP bar + enrage
    // + kill payoff, but its special is a telegraphed projectile BARRAGE (lobbed,
    // dodgeable by moving/jumping) instead of a ground-slam. The counter is to
    // close distance and punish the recover window — a different fight shape.
    CAST: {
      WINDUP: 0.60,               // telegraph (glow ramps; the must-dodge cue)
      RECOVER: 0.70,              // vulnerable window after releasing
      INTERVAL: 2.6,              // seconds between barrages (phase 1)
      INTERVAL_ENRAGED: 1.8,      // phase 2 (<=50% hp)
      SHOTS: 3,                   // projectiles per barrage (phase 1)
      SHOTS_ENRAGED: 5,           // projectiles per barrage (phase 2)
      SPREAD: 150,                // px horizontal spread, centered on the player
      PROJECTILE_DMG: 11,
      RANGE: 760,                 // max range to start a barrage
    },
  },

  // ---- content variety (round 5) ----
  // New enemy archetypes + the systems they touch: a hazard layer (ground
  // fire from bombers / meteor storms), a projectile layer (ranger throws),
  // a multi-type pickup, and a rare-event director that remixes waves so no
  // two runs play the same. All built on the existing shockwave array pattern.
  CONTENT: {
    // shielder — frontal guard blocks light hits; a kick (heavy) breaks guard.
    SHIELDER: {
      GUARD_BREAK_TIME: 1.1,   // seconds guard is down after a heavy hit
      GUARD_SHOVE: 60,         // tiny chip shove on a blocked light hit
    },
    // bomber — volatile; detonates a ground fire zone on death or on contact.
    BOMBER: {
      FUSE_RANGE: 78,          // distance to player that starts the fuse
      FUSE_TIME: 0.6,          // telegraph before detonation
      BLAST_RADIUS: 96,        // knockback radius on detonation
      BLAST_KNOCKBACK: 520,
      FIRE_RADIUS: 70,         // ground fire zone half-width
      FIRE_LIFE: 3.2,          // how long the fire lingers
      FIRE_DPS: 26,            // damage/sec to anything standing in it
      FIRE_DMG_PLAYER: 14,     // contact hit on the player from the blast itself
    },
    // ranger — kites and lobs projectiles; forces the player to close distance.
    RANGER: {
      KITE_RANGE: 320,         // tries to keep at least this far from the player
      THROW_RANGE: 560,        // max range to start a throw
      THROW_CD: [1.6, 2.6],    // seconds between throws
      THROW_WINDUP: 0.5,
      PROJECTILE_SPEED: 460,
      PROJECTILE_ARC: -420,    // initial upward velocity (lobbed arc)
      PROJECTILE_DMG: 10,
      PROJECTILE_RADIUS: 12,   // collision radius
      PROJECTILE_LIFE: 3.0,
    },
    // hazard layer (ground fire) — shared by bomber blasts + meteor event.
    HAZARD: {
      TICK: 0.5,               // damage tick interval
    },
    // meteor storm event — periodic falling strikes during an event wave.
    METEOR: {
      INTERVAL: [1.4, 2.6],    // seconds between meteors
      WARN_TIME: 0.7,          // ground marker telegraph before impact
      RADIUS: 60,
      KNOCKBACK: 460,
      DAMAGE: 16,
    },
    // multi-type pickups.
    PICKUP: {
      RAGE_TIME: 8.0,          // rage buff duration
      RAGE_DMG_MUL: 1.6,       // player attack damage multiplier while raging
      RAGE_SCORE_MUL: 2.0,     // score multiplier while raging
      SCORE_BONUS: 500,        // instant score from a gold score-bomb pickup
      LIFE: 9,
      // MAGNET — once the player is within range the pickup locks on and flies
      // in. Telemetry (Round 10 audit) showed healed=0 for EVERY persona: drops
      // spawn on the corpse and players walk away from all of them. This is the
      // root fix that makes the health/rage loop actually engage, and it makes
      // Second Wind's "kill -> heal -> reform" path reachable in real play.
      MAGNET_RANGE: 150,       // px — within this, pickup starts homing
      MAGNET_SPEED: 760,       // cruise speed once locked on (px/s)
      MAGNET_STEER: 22,        // velocity-blend rate (1/s) — kills the spawn-pop
                               // and turns the drop toward the player fast
    },
    // rare-event director — remixes one wave occasionally for variety.
    EVENTS: {
      CHANCE: 0.20,            // probability a non-boss wave (after wave 2) is an event wave
      MIN_WAVE: 3,             // earliest wave an event can fire
    },
  },

  // ---- GAME FEEL (juice pass) ----
  // Pure feedback tuning — no mechanic/damage/timing changes. Magnitudes are
  // small by design: stacked across a combo they build intensity without nausea.
  FEEL: {
    // camera punch-zoom: boost snaps up on impact, eases back exponentially.
    // camBoost decays via boost *= exp(-dt / TAU); applied as zoom = 1 + boost.
    ZOOM: {
      HIT:        0.018,   // any landed hit
      HEAVY:      0.034,   // kick / heavy-knockback hit (kb > 400)
      HURT:       0.030,   // player took a hit
      KILL:       0.050,   // enemy K.O.
      BOSS_KILL:  0.095,   // boss death — the run's strongest feedback peak
      SLAM:       0.045,   // boss ground-slam impact
      BLAST:      0.052,   // bomber / meteor detonation
      TAU:        0.075,   // exponential time-constant (smaller = snappier return)
      MAX:        0.12,    // hard cap so long combos can't over-zoom
    },
    // directional camera shove (px, recoils opposite the blow). Clamped to the
    // headroom the current zoom buys so it never reveals world edges.
    SHOVE: {
      HIT:    4,
      HEAVY:  8,
      KILL:   12,
      BOSS:   18,
      DOWN:   10,   // +y shove on big downward/slam impacts (sells weight)
    },
    // expanding impact ring drawn from the strike point.
    RING: {
      HIT:        { life: 0.22, maxR: 46, width: 4 },
      HEAVY:      { life: 0.28, maxR: 66, width: 5 },
      HURT:       { life: 0.26, maxR: 58, width: 5 },
      KILL:       { life: 0.36, maxR: 96, width: 6 },
      BOSS_KILL:  { life: 0.52, maxR: 170, width: 8 },
      SLAM:       { life: 0.40, maxR: 120, width: 6 },
      BLAST:      { life: 0.40, maxR: 130, width: 6 },
    },
    // extra hitstop (s) layered on top of the attack's base HIT_PAUSE for weight.
    PAUSE: {
      KILL:      0.035,   // a normal K.O.
      HEAVY:     0.020,   // heavy connecting hit
    },
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
